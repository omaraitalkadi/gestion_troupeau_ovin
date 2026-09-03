// server/services/utilisateur.js
import { supabase } from "../supabaseClient.js";
import { utilisateurApi, sessionApi } from "../tables/index.js"; // utilisateurApi manquait (bug) ; sessionApi pour reset
import { hashPassword } from "./AuthService.js";
import { genererUsername } from "./username.js";
// ═══════════════════════════════════════════════════════════════════════════
//  services/utilisateur.js — REMPLACER creerEmploye + AJOUTER le générateur
//  Mot de passe temporaire généré côté serveur, rendu UNE fois (pour que
//  l'admin le communique), puis stocké HASHÉ. Alphabet lisible (sans 0/O/1/l/I)
//  → facile à dicter/recopier. Aléa cryptographique (crypto.randomInt).
// ═══════════════════════════════════════════════════════════════════════════

import { randomInt } from "node:crypto"; // ← ajouter en haut du fichier

// Mot de passe temporaire lisible, conforme (≥1 majuscule, ≥1 chiffre).
function genererMotDePasseTemp(longueur = 12) {
  const MAJ = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I, O
  const MIN = "abcdefghijkmnpqrstuvwxyz"; // sans l, o
  const CHF = "23456789";                 // sans 0, 1
  const TOUT = MAJ + MIN + CHF;
  const pick = (s) => s[randomInt(s.length)];

  // garantit au moins 1 majuscule et 1 chiffre, complète le reste aléatoirement
  const chars = [pick(MAJ), pick(CHF)];
  for (let i = chars.length; i < longueur; i++) chars.push(pick(TOUT));

  // mélange (Fisher–Yates, aléa crypto) pour ne pas figer maj/chiffre en tête
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const TYPES_ALERTE = [
  "SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE",
  "REPRODUCTION_CHALEURS", "REPRODUCTION_MISE_BAS", "REPRODUCTION_INSEMINATION",
  "GESTATION_RETARD", "STOCK_ALIMENT_FAIBLE", "STOCK_MEDICAMENT_FAIBLE",
  "MOUVEMENT_ANIMAL", "PESEE_CONTROL", "ANOMALIE_SANTE", "SAUVEGARDE",
  // NOUVEAU_COMPTE volontairement exclu
];

const ROLES_EMPLOYE = ["OPERATEUR", "VETERINAIRE", "AUTRE"];

// ─── Modèles par rôle (valeurs de départ, ajustables ensuite par l'admin) ───
const PERMISSIONS_PAR_ROLE = {
  VETERINAIRE: {
    TROUPEAU: ["LIRE"], SANTE: ["LIRE", "ECRIRE"], REPRODUCTION: ["LIRE", "ECRIRE"],
    ALIMENTATION: ["LIRE"], FINANCE: [],
  },
  OPERATEUR: {
    TROUPEAU: ["LIRE", "ECRIRE"], SANTE: ["LIRE", "ECRIRE"], REPRODUCTION: ["LIRE", "ECRIRE"],
    ALIMENTATION: ["LIRE", "ECRIRE"], FINANCE: [],
  },
  AUTRE: {
    TROUPEAU: ["LIRE"], SANTE: ["LIRE"], REPRODUCTION: ["LIRE"],
    ALIMENTATION: ["LIRE"], FINANCE: [],
  },
};

const NOTIFICATIONS_PAR_ROLE = {
  VETERINAIRE: [
    "SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE", "ANOMALIE_SANTE",
    "REPRODUCTION_CHALEURS", "REPRODUCTION_MISE_BAS", "REPRODUCTION_INSEMINATION",
    "GESTATION_RETARD", "STOCK_MEDICAMENT_FAIBLE",
  ],
  OPERATEUR: [
    "SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE",
    "REPRODUCTION_MISE_BAS", "STOCK_ALIMENT_FAIBLE", "STOCK_MEDICAMENT_FAIBLE",
    "MOUVEMENT_ANIMAL", "PESEE_CONTROL",
  ],
  AUTRE: [],
};

// ========== SIGNUP ADMIN (appelé par SignupService après vérification) ==========
// Modèle 1 : le compte est créé APRÈS vérification du code → déjà vérifié.
// La ferme est créée par l'appelant (SignupService.confirmerInscription).
export async function signupAdmin({ nom, email, username, telephone, motDePasseHash, fermeId }) {
  const { data: utilisateur, error: errProfil } = await supabase
    .from("utilisateur")
    .insert({
      ferme_id: fermeId,
      nom,
      email,
      username,                       // admin : username généré (partie locale email + ferme)
      mot_de_passe_hash: motDePasseHash,
      telephone: telephone ?? null,
      role: "ADMINISTRATEUR",
      actif: true,                    // vérifié avant création
      must_change_password: false,    // l'admin a choisi son propre mot de passe
      date_creation: new Date().toISOString(),
    })
    .select().single();
  if (errProfil) throw errProfil;

  // Notifications toutes à TRUE (pas de matrice de permissions pour l'admin)
  await initNotifications(utilisateur.id, true);
  return utilisateur;
}

// ─── Initialisations (matérialisation des matrices) ───────────
export async function initPermissions(utilisateurId, role) {
  const { data: catalogue, error: errCat } = await supabase
    .from("module_permission").select("module, action");
  if (errCat) throw errCat;

  const modele = PERMISSIONS_PAR_ROLE[role] ?? {};
  const lignes = catalogue.map((c) => ({
    utilisateur_id: utilisateurId,
    module: c.module,
    action: c.action,
    accorde: (modele[c.module] ?? []).includes(c.action),
  }));

  const { error } = await supabase.from("utilisateur_permission").insert(lignes);
  if (error) throw error;
}

// actifs : tableau de types à activer, ou true (tout activer, ex. admin).
export async function initNotifications(utilisateurId, actifs) {
  const actifsSet = actifs === true ? new Set(TYPES_ALERTE) : new Set(actifs ?? []);
  const lignes = TYPES_ALERTE.map((type_alerte) => ({
    utilisateur_id: utilisateurId,
    type_alerte,
    actif: actifsSet.has(type_alerte),
  }));

  const { error } = await supabase.from("preference_notification").insert(lignes);
  if (error) throw error;
}

// ─── Lecture ──────────────────────────────────────────────────
/** Liste des employés d'une ferme (l'admin/propriétaire exclu). */
export async function listerUtilisateurs(fermeId) {
  const { data, error } = await supabase
    .from("utilisateur")
    .select("id, nom, username, email, telephone, role, actif, must_change_password, date_creation, dernier_acces")
    .eq("ferme_id", fermeId)
    .neq("role", "ADMINISTRATEUR")
    .order("date_creation", { ascending: false });
  if (error) throw error;
  return data;
}

/** Détail d'un utilisateur + sa matrice de permissions + ses préférences. */
export async function getUtilisateurComplet(id) {
  const [{ data: utilisateur, error: e1 },
         { data: permissions, error: e2 },
         { data: notifications, error: e3 }] = await Promise.all([
    supabase.from("utilisateur")
      .select("id, nom, username, email, telephone, role, actif, must_change_password, ferme_id, date_creation, dernier_acces")
      .eq("id", id).single(),
    supabase.from("utilisateur_permission")
      .select("module, action, accorde").eq("utilisateur_id", id),
    supabase.from("preference_notification")
      .select("type_alerte, actif").eq("utilisateur_id", id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  return { ...utilisateur, permissions: permissions ?? [], notifications: notifications ?? [] };
}

/** Catalogue des permissions (pour construire la matrice côté UI). */
export async function getCataloguePermissions() {
  const { data, error } = await supabase
    .from("module_permission")
    .select("module, action, libelle, ordre")
    .order("ordre", { ascending: true });
  if (error) throw error;
  return { catalogue: data, modelesPermissions: PERMISSIONS_PAR_ROLE, modelesNotifications: NOTIFICATIONS_PAR_ROLE, typesAlerte: TYPES_ALERTE };
}



// ─── Réinitialisation du mot de passe d'un employé (par l'admin) ───────────
// Émet un nouveau mot de passe temporaire ; force le changement au prochain login.
// Ne touche PAS dernier_changement_mdp → ne consomme pas la limite mensuelle.
export async function reinitialiserMotDePasseEmploye(employeId, nouveauMdp, fermeIdAdmin) {
  const { data: cible, error } = await supabase
    .from("utilisateur").select("id, role, ferme_id").eq("id", employeId).single();
  if (error || !cible) throw Object.assign(new Error("Utilisateur introuvable."), { status: 404 });
  if (cible.ferme_id !== fermeIdAdmin)
    throw Object.assign(new Error("Utilisateur hors de votre ferme."), { status: 403 });
  if (cible.role === "ADMINISTRATEUR")
    throw Object.assign(new Error("L'administrateur réinitialise son mot de passe par email."), { status: 400 });

  const hash = await hashPassword(nouveauMdp);
  await utilisateurApi.update(employeId, { mot_de_passe_hash: hash, must_change_password: true });

  // Déconnexion forcée : révoquer les sessions de l'employé.
  const sessions = await sessionApi.findBy("utilisateur_id", employeId, { select: "id" });
  await Promise.all(sessions.map((s) => sessionApi.update(s.id, { est_active: false })));
  return { id: employeId, must_change_password: true };
}

// ─── Statut ───────────────────────────────────────────────────
export async function changerStatut(id, actif) {
  const { data, error } = await supabase
    .from("utilisateur")
    .update({ actif })
    .eq("id", id)
    .select("id, nom, username, email, role, actif")
    .single();
  if (error) throw error;
  return data;
}

// ─── Permissions ──────────────────────────────────────────────
export async function mettreAJourPermissions(id, permissions) {
  const lignes = permissions.map((p) => ({
    utilisateur_id: id, module: p.module, action: p.action,
    accorde: !!p.accorde, date_modification: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("utilisateur_permission")
    .upsert(lignes, { onConflict: "utilisateur_id,module,action" });
  if (error) throw error;

  const { data } = await supabase
    .from("utilisateur_permission")
    .select("module, action, accorde").eq("utilisateur_id", id);
  return data;
}

// ─── Notifications ────────────────────────────────────────────
export async function mettreAJourNotifications(id, preferences) {
  const lignes = preferences
    .filter((p) => p.type_alerte !== "NOUVEAU_COMPTE")
    .map((p) => ({
      utilisateur_id: id, type_alerte: p.type_alerte,
      actif: !!p.actif, date_modification: new Date().toISOString(),
    }));
  const { error } = await supabase
    .from("preference_notification")
    .upsert(lignes, { onConflict: "utilisateur_id,type_alerte" });
  if (error) throw error;

  const { data } = await supabase
    .from("preference_notification")
    .select("type_alerte, actif").eq("utilisateur_id", id);
  return data;
}









// ─── Création d'un employé ────────────────────────────────────
// Username FERME-SCOPÉ (nom choisi + ferme, suffixé si collision). Pas d'email.
// Mot de passe temporaire généré ici, renvoyé EN CLAIR une seule fois, stocké hashé.
// must_change_password = true (changement forcé au 1er login).
export async function creerEmploye({ nom, telephone, role, fermeId, permissions, notifications }) {
  if (!ROLES_EMPLOYE.includes(role))
    throw Object.assign(new Error("Rôle invalide pour un employé."), { status: 400 });

  const { data: ferme, error: errFerme } = await supabase
    .from("ferme").select("nom").eq("id", fermeId).single();
  if (errFerme) throw errFerme;

  const username = await genererUsername(nom, ferme.nom);
  const motDePasseTemporaire = genererMotDePasseTemp();
  const motDePasseHash = await hashPassword(motDePasseTemporaire);

  const utilisateur = await utilisateurApi.create({
    nom: nom.trim(), username, email: null,
    mot_de_passe_hash: motDePasseHash,
    telephone: telephone?.trim() ?? null,
    role, ferme_id: fermeId, actif: true, must_change_password: true,
    date_creation: new Date().toISOString(),
  });

  // Permissions : matrice envoyée = source de vérité ; sinon (absente) défauts du rôle.
  if (Array.isArray(permissions)) {
    await mettreAJourPermissions(utilisateur.id, permissions);
  } else {
    await initPermissions(utilisateur.id, role);
  }
  if (Array.isArray(notifications)) {
    await mettreAJourNotifications(utilisateur.id, notifications);
  } else {
    await initNotifications(utilisateur.id, NOTIFICATIONS_PAR_ROLE[role] ?? []);
  }

  const { mot_de_passe_hash, ...safe } = utilisateur;
  return { ...safe, username, motDePasseTemporaire };
}





// ═══════════════════════════════════════════════════════════════════════════
//  services/utilisateur.js — détail complet d'un utilisateur pour la page admin
//  Renvoie l'utilisateur + sa matrice de permissions + ses préférences de
//  notification, dans une forme directement exploitable par l'UI.
//
//  ⚠️ Le problème "on ne voit que le fallback" = souvent des LIGNES ABSENTES :
//     si utilisateur_permission / preference_notification n'ont pas été
//     initialisées à la création, les tableaux reviennent vides et l'UI
//     retombe sur les modèles de rôle. Cette fonction expose donc AUSSI un
//     indicateur (aInitialise*) pour distinguer "vide" de "non initialisé".
// ═══════════════════════════════════════════════════════════════════════════

// NB : réutilise le client supabase déjà importé en tête de utilisateur.js.
// (import { supabase } from "../supabaseClient.js";)

export async function getUtilisateurDetail(id) {
  const [
    { data: utilisateur, error: e1 },
    { data: permissions, error: e2 },
    { data: notifications, error: e3 },
    { data: catalogue, error: e4 },
  ] = await Promise.all([
    supabase.from("utilisateur")
      .select("id, nom, username, email, telephone, role, actif, must_change_password, ferme_id, date_creation, dernier_acces")
      .eq("id", id).single(),
    supabase.from("utilisateur_permission")
      .select("module, action, accorde")
      .eq("utilisateur_id", id),
    supabase.from("preference_notification")
      .select("type_alerte, actif")
      .eq("utilisateur_id", id),
    supabase.from("module_permission")
      .select("module, action, libelle, ordre")
      .order("ordre", { ascending: true }),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (!utilisateur) throw Object.assign(new Error("Utilisateur introuvable."), { status: 404 });

  const perms = permissions ?? [];
  const notifs = notifications ?? [];

  return {
    ...utilisateur,
    // matrice réelle (ce que l'UI doit afficher, PAS le modèle de rôle)
    permissions: perms,        // [{ module, action, accorde }]
    notifications: notifs,     // [{ type_alerte, actif }]
    // catalogue pour construire la grille même si l'utilisateur n'a aucune ligne
    catalogue: catalogue ?? [],
    // drapeaux : permet à l'UI de savoir si c'est "vide" ou "jamais initialisé"
    aInitialisePermissions: perms.length > 0,
    aInitialiseNotifications: notifs.length > 0,
  };
}