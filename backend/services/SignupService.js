// server/services/SignupService.js
// Inscription en 2 étapes (Modèle 1 : vérif AVANT création).
//   demarrerInscription  → valide, stocke pending_signup, envoie le code (RIEN de réel créé)
//   confirmerInscription → vérifie le code, crée utilisateur + ferme + session, purge pending
import bcrypt from "bcryptjs";
import { db, utilisateurApi, fermeApi, sessionApi } from "../tables/index.js";
import { hashPassword } from "./AuthService.js";
import { genererUsername } from "./username.js";
import { signupAdmin, initNotifications } from "./utilisateur.js";
import { envoyerCodeVerification } from "./EmailService.js"; // ⚠️ à implémenter (Resend/Brevo)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const badRequest = (m) => Object.assign(new Error(m), { status: 400 });
const conflit    = (m) => Object.assign(new Error(m), { status: 409 });

const CODE_TTL_MIN   = 20;
const MAX_TENTATIVES = 5;
const SESSION_TTL_DAYS = 7;

const genererCode = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
const dansMinutes = (m) => new Date(Date.now() + m * 60_000).toISOString();
const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_DAYS * 864e5).toISOString();

// ── ÉTAPE 1 : démarrer (aucune création réelle) ─────────────────────────────
export async function demarrerInscription(payload, { ip } = {}) {
  const {
    nom, email, motDePasse, telephone,
    fermeNom, numeroRegistre, numeroPatente, numeroIFU,
    telephoneContact, emailContact, telephoneSecondaire, dateDebutExploitation,
  } = payload;

  // Validation
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

  // Unicité contre les tables RÉELLES (pas contre pending : un re-submit l'écrase)
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

  const code = genererCode();
  const row = {
    nom: nom.trim(),
    email: cleanEmail,
    telephone: telephone?.trim() ?? null,
    mot_de_passe_hash: await hashPassword(motDePasse), // hashé dès maintenant
    ferme_nom: fermeNom.trim(),
    numero_registre:  numeroRegistre?.trim() ?? null,
    numero_patente:   numeroPatente?.trim() ?? null,
    numero_ifu:       numeroIFU?.trim() ?? null,
    telephone_contact:    telephoneContact?.trim() ?? null,
    telephone_secondaire: telephoneSecondaire?.trim() ?? null,
    email_contact:        emailContact?.trim() ?? null,
    date_debut_exploitation: dateDebutExploitation ? new Date(dateDebutExploitation).toISOString().slice(0,10) : null,
    code_hash: await bcrypt.hash(code, 10),
    code_expiration: dansMinutes(CODE_TTL_MIN),
    tentatives: 0,
  };

  // Un seul pending par email : on écrase l'éventuel précédent (unique lower(email)).
  const existant = await db.pending_signup.getOneBy({ email: cleanEmail }, "id");
  if (existant) await db.pending_signup.update(existant.id, row);
  else          await db.pending_signup.create(row);

  await envoyerCodeVerification(cleanEmail, code); // envoie le code par email
  return { email: cleanEmail, expireDansMin: CODE_TTL_MIN };
}

// ── ÉTAPE 2 : confirmer (crée le compte réel) ───────────────────────────────
export async function confirmerInscription({ email, code }, { ip, userAgent } = {}) {
  const cleanEmail = String(email ?? "").toLowerCase().trim();
  if (!cleanEmail || !code) throw badRequest("email et code requis");

  const pending = await db.pending_signup.getOneBy({ email: cleanEmail });
  if (!pending) throw badRequest("Aucune inscription en attente. Recommencez.");

  // Expiration (20 min) = code mort + ligne morte → on purge et on refuse
  if (new Date(pending.code_expiration) < new Date()) {
    await db.pending_signup.remove(pending.id);
    throw badRequest("Code expiré. Recommencez l'inscription.");
  }
  if (pending.tentatives >= MAX_TENTATIVES) {
    await db.pending_signup.remove(pending.id);
    throw Object.assign(new Error("Trop de tentatives. Recommencez l'inscription."), { status: 429 });
  }

  const ok = await bcrypt.compare(String(code), pending.code_hash);
  if (!ok) {
    await db.pending_signup.update(pending.id, { tentatives: pending.tentatives + 1 });
    throw badRequest("Code incorrect.");
  }

  // Création réelle (best-effort ; RPC recommandée pour l'atomicité)
  const stack = [];
  try {
    const username = await genererUsername(pending.email, pending.ferme_nom); // admin : partie locale de l'email

    const utilisateur = await signupAdmin({
      nom: pending.nom,
      email: pending.email,
      username,
      mot_de_passe_hash: pending.mot_de_passe_hash,
      telephone: pending.telephone,
      role: "ADMINISTRATEUR",
      fermeId: null,
    });
    stack.push(() => utilisateurApi.remove(utilisateur.id));

    const ferme = await fermeApi.create({
      nom: pending.ferme_nom,
      date_creation: new Date().toISOString(),
      actif: true, // compte vérifié → ferme active (verif faite avant création)
      administrateur_id: utilisateur.id,
      ...(pending.numero_registre      && { numero_registre:       pending.numero_registre }),
      ...(pending.numero_patente       && { numero_patente:        pending.numero_patente }),
      ...(pending.numero_ifu           && { numero_ifu:            pending.numero_ifu }),
      ...(pending.telephone_contact    && { telephone_contact:     pending.telephone_contact }),
      ...(pending.telephone_secondaire && { telephone_secondaire:  pending.telephone_secondaire }),
      ...(pending.email_contact        && { email_contact:         pending.email_contact }),
      ...(pending.date_debut_exploitation && { date_debut_exploitation: pending.date_debut_exploitation }),
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

    // Succès → supprimer TOUTES les lignes pending de cet email
    await db.pending_signup.remove(pending.id);

    const { mot_de_passe_hash, ...safeUser } = utilisateur;
    return { utilisateur: { ...safeUser, username }, ferme_id: ferme.id, sessionId: session.id };
  } catch (e) {
    for (const undo of stack.reverse()) { try { await undo(); } catch (_) {} }
    throw e;
  }
}

// ── Renvoi de code (dans la fenêtre de 20 min ; sinon recommencer) ───────────
export async function renvoyerCode({ email }) {
  const cleanEmail = String(email ?? "").toLowerCase().trim();
  const pending = await db.pending_signup.getOneBy({ email: cleanEmail });
  if (!pending) throw badRequest("Aucune inscription en attente. Recommencez.");

  const code = genererCode();
  await db.pending_signup.update(pending.id, {
    code_hash: await bcrypt.hash(code, 10),
    code_expiration: dansMinutes(CODE_TTL_MIN),
    tentatives: 0,
  });
  await envoyerCodeVerification(cleanEmail, code);
  return { email: cleanEmail, expireDansMin: CODE_TTL_MIN };
}
