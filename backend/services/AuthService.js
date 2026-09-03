// server/services/AuthService.js
// Toute l'I/O passe par les primitives des modules table (utilisateurApi,
// sessionApi) — plus de supabase.from direct ici.
import bcrypt from "bcryptjs";
import { utilisateurApi, sessionApi, fermeApi } from "../tables/index.js";
import { signupAdmin, initNotifications } from "./utilisateur.js";

const SESSION_TTL_DAYS = 7;
const badRequest  = (msg) => Object.assign(new Error(msg), { status: 400 });


const unauthorized = (msg) => Object.assign(new Error(msg), { status: 401 });



const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const conflit  = (msg) => Object.assign(new Error(msg), { status: 409 });

/**
 * Crée admin + ferme + session (auto-login), atomique best-effort.
 * @returns {{ utilisateur, ferme, sessionId }}
 */
export async function signup(payload, { ip, userAgent } = {}) {
  const {
    nom, email, motDePasse, telephone,
    fermeNom, numeroRegistre, numeroPatente, numeroIFU,
    telephoneContact, emailContact, telephoneSecondaire, dateDebutExploitation,
  } = payload;

  // 1) Validation (aucune I/O)
  const errors = [];
  if (!nom?.trim())      errors.push("nom est obligatoire");
  if (!fermeNom?.trim()) errors.push("fermeNom est obligatoire");
  if (!email?.trim())    errors.push("email est obligatoire");
  else if (!EMAIL_RE.test(email.trim())) errors.push("email invalide");
  if (emailContact && !EMAIL_RE.test(emailContact.trim())) errors.push("emailContact invalide");
  if (dateDebutExploitation && Number.isNaN(new Date(dateDebutExploitation).getTime()))
    errors.push("dateDebutExploitation invalide");
  if (!motDePasse || typeof motDePasse !== "string") errors.push("motDePasse est obligatoire");
  else {
    if (motDePasse.length < 8)     errors.push("motDePasse: minimum 8 caractères");
    if (!/[A-Z]/.test(motDePasse)) errors.push("motDePasse: au moins une majuscule");
    if (!/[0-9]/.test(motDePasse)) errors.push("motDePasse: au moins un chiffre");
  }
  if (errors.length) throw Object.assign(new Error(errors[0]), { status: 400, errors });

  const cleanEmail = email.toLowerCase().trim();

  // 2) Unicité (en parallèle)
  const [existEmail, existPatente, existIFU, existRegistre] = await Promise.all([
    utilisateurApi.findOneBy("email", cleanEmail, { select: "id" }),
    numeroPatente  ? fermeApi.findOneBy("numero_patente",  numeroPatente.trim(),  { select: "id" }) : null,
    numeroIFU      ? fermeApi.findOneBy("numero_ifu",       numeroIFU.trim(),       { select: "id" }) : null,
    numeroRegistre ? fermeApi.findOneBy("numero_registre",  numeroRegistre.trim(),  { select: "id" }) : null,
  ]);
  if (existEmail)    throw conflit("Cet email est déjà utilisé.");
  if (existRegistre) throw conflit("Ce numéro de registre ONCA est déjà utilisé.");
  if (existPatente)  throw conflit("Ce numéro de patente est déjà utilisé.");
  if (existIFU)      throw conflit("Ce numéro IFU est déjà utilisé.");

  // 3) Écritures (best-effort ; RPC recommandée pour une vraie atomicité)
  const stack = [];
  try {
    const motDePasseHash = await hashPassword(motDePasse);

    const utilisateur = await signupAdmin({
      nom: nom.trim(), email: cleanEmail, mot_de_passe_hash: motDePasseHash,
      telephone: telephone?.trim() ?? null, role: "ADMINISTRATEUR", fermeId: null,
    });
    stack.push(() => utilisateurApi.remove(utilisateur.id));

    const ferme = await fermeApi.create({
      nom: fermeNom.trim(),
      date_creation: new Date().toISOString(),
      actif: false,
      administrateur_id: utilisateur.id,
      ...(numeroRegistre      && { numero_registre:       numeroRegistre.trim() }),
      ...(numeroPatente       && { numero_patente:        numeroPatente.trim() }),
      ...(numeroIFU           && { numero_ifu:            numeroIFU.trim() }),
      ...(telephoneContact    && { telephone_contact:     telephoneContact.trim() }),
      ...(telephoneSecondaire && { telephone_secondaire:  telephoneSecondaire.trim() }),
      ...(emailContact        && { email_contact:         emailContact.trim() }),
      ...(dateDebutExploitation && { date_debut_exploitation: new Date(dateDebutExploitation).toISOString() }),
    });
    stack.push(() => fermeApi.remove(ferme.id));

    await utilisateurApi.update(utilisateur.id, { ferme_id: ferme.id });
    await initNotifications(utilisateur.id, true);

    const session = await sessionApi.create({
      utilisateur_id: utilisateur.id,
      date_expiration: sessionExpiry(),
      ip_adresse: ip ?? null,
      user_agent: userAgent ?? null,
      est_active: true,
    });

    const { mot_de_passe_hash, ...safeUser } = utilisateur;
    return { utilisateur: safeUser, ferme, sessionId: session.id };
  } catch (e) {
    for (const undo of stack.reverse()) { try { await undo(); } catch (_) {} }
    throw e;
  }
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

function validerMotDePasse(mdp) {
  if (!mdp || typeof mdp !== "string" || mdp.length < 8)
    throw badRequest("Le mot de passe doit contenir au moins 8 caractères");
  if (!/[A-Z]/.test(mdp)) throw badRequest("Le mot de passe doit contenir au moins une majuscule");
  if (!/[0-9]/.test(mdp)) throw badRequest("Le mot de passe doit contenir au moins un chiffre");
}

// ── HASH (création de compte) ───────────────────────────────
export async function hashPassword(password) {
  validerMotDePasse(password);
  return bcrypt.hash(password, 12);
}

export async function login({ identifiant, type, password, ip, userAgent }) {
  const colonne = type === "employe" ? "username" : "email";
  const valeur  = type === "employe" ? identifiant.trim() : identifiant.toLowerCase().trim();
  const user = await utilisateurApi.findOneBy(colonne, valeur, {
    select: "id, username, email, nom, role, mot_de_passe_hash, must_change_password",
  });
  if (!user) throw Object.assign(new Error("Identifiants incorrects"), { status: 401 });
  const valid = await bcrypt.compare(password, user.mot_de_passe_hash);
  if (!valid) throw Object.assign(new Error("Identifiants incorrects"), { status: 401 });
  const session = await sessionApi.create({
    utilisateur_id: user.id, date_expiration: sessionExpiry(),
    ip_adresse: ip ?? null, user_agent: userAgent ?? null, est_active: true,
  });
  await utilisateurApi.update(user.id, { dernier_acces: new Date().toISOString() });
  const { mot_de_passe_hash, ...safe } = user;
  return { sessionId: session.id, user: safe, mustChangePassword: user.must_change_password === true };
}

// ── LOGOUT ──────────────────────────────────────────────────
export async function logout(sessionId) {
  if (!sessionId) return;
  // est_active:false = révocation (cohérent avec le schéma session).
  await sessionApi.update(sessionId, { est_active: false });
}

// ── VERIFY SESSION (middleware authenticate) ────────────────
export async function verifySession(sessionId) {
  if (!sessionId) return null;

  const session = await sessionApi.getOneBy(
    { id: sessionId, est_active: true },   // révoquée → ne matche pas
    "id, utilisateur_id, date_expiration"
  );
  if (!session) return null;

  // Expiration : une session périmée est invalide (et on la désactive).
  if (session.date_expiration && new Date(session.date_expiration) < new Date()) {
    await sessionApi.update(session.id, { est_active: false }).catch(() => {});
    return null;
  }

  const user = await utilisateurApi.get(session.utilisateur_id);
  if (!user) return null;

  const ferme = user.ferme_id ? await fermeApi.get(user.ferme_id) : null;

  const { mot_de_passe_hash, ...safeUser } = user;
  return { user: safeUser, ferme_id: user.ferme_id, ferme, sessionId: session.id };
}

// ── CHANGE PASSWORD ─────────────────────────────────────────
export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await utilisateurApi.get(userId, { select: "id, mot_de_passe_hash" });
  if (!user) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.mot_de_passe_hash); // bon champ
  if (!valid) throw badRequest("Mot de passe actuel incorrect");

  validerMotDePasse(newPassword);
  const hash = await bcrypt.hash(newPassword, 12);
  await utilisateurApi.update(userId, { mot_de_passe_hash: hash }); // bonne colonne

  // Révoquer toutes les sessions de l'utilisateur (déconnexion partout).
  const sessions = await sessionApi.findBy("utilisateur_id", userId, { select: "id" });
  await Promise.all(sessions.map((s) => sessionApi.update(s.id, { est_active: false })));
}