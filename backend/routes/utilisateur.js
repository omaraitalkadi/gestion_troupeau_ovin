// server/routes/utilisateur.js
// Monté : app.use("/api/utilisateur", authenticate, utilisateurRouter);
// authenticate renseigne req.user = { id, role, ferme_id, ... } et req.fermeId.
import express from "express";
import { utilisateurApi, fermeApi, lotApi, animalApi } from "../tables/index.js";
import {
  listerUtilisateurs,
  getUtilisateurComplet,
  getCataloguePermissions,
  creerEmploye,
  reinitialiserMotDePasseEmploye,
  changerStatut,
  mettreAJourPermissions,
  mettreAJourNotifications,
  getUtilisateurDetail
} from "../services/utilisateur.js";
import { constrainedMemory } from "node:process";

const router = express.Router();
const fermeDe = (req) => req.user.ferme_id;

function publicUser(u) {
  if (!u) return null;
  const { mot_de_passe_hash, ...safe } = u;
  return safe;
}

// "M"/"F", "Mâle"/"Femelle", "male"/"female", 1/2… → "M" | "F" | null
const normSexe = (s) => {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("m") || v === "1") return "M";
  if (v.startsWith("f") || v === "2") return "F";
  return null;
};

// Réserve une route à l'administrateur (propriétaire de la ferme).
function exigerAdmin(req, res, next) {
  if (req.user?.role !== "ADMINISTRATEUR")
    return res.status(403).json({ error: "Réservé à l'administrateur." });
  next();
}


async function memeFerme(req, res, next) {
  try {
    const cible = await getUtilisateurComplet(req.params.id);
    if (!cible) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (cible.ferme_id !== fermeDe(req))
      return res.status(403).json({ error: "Utilisateur hors de votre ferme." });
    // L'admin ne se gère pas lui-même via ces routes employé.
    if (cible.id === req.user.id || cible.role === "ADMINISTRATEUR")
      return res.status(403).json({ error: "Action non autorisée sur ce compte." });
    req.cible = cible;
    next();
  } catch (err) {
    next(err);
  }
}


async function buildUserDashboard(user) {
  let ferme = null;
  if (user.ferme_id) ferme = await fermeApi.get(user.ferme_id).catch(() => null);
  if (!ferme) {
    const owned = await fermeApi.getByAdministrateurId(user.id);
    ferme = owned?.[0] ?? null;
  }

  let lots = [];
  if (ferme) {
    lots = await lotApi.getByFermeId(ferme.id, { orderBy: "nom" });
    const { data: animals } = await animalApi.list({
      select: "id,lot_id,race,sexe",
      filters: { ferme_id: ferme.id },
      limit: 100000,
    });

    const byLot = new Map();
    for (const a of animals ?? []) {
      if (!a.lot_id) continue;
      let e = byLot.get(a.lot_id);
      if (!e) { e = { count: 0, males: 0, females: 0, races: new Set() }; byLot.set(a.lot_id, e); }
      e.count += 1;
      const sx = normSexe(a.sexe);
      if (sx === "M") e.males += 1; else if (sx === "F") e.females += 1;
      if (a.race) e.races.add(a.race);
    }

    lots = lots.map((l) => {
      const e = byLot.get(l.id);
      return {
        ...l,
        animalCount: e ? e.count : 0,
        maleCount:   e ? e.males : 0,
        femaleCount: e ? e.females : 0,
        races:       e ? [...e.races].sort() : [],
      };
    });
  }

  return { user: publicUser(user), ferme, lots };
}

// ── Profil courant (tous rôles) — AVANT /:id pour ne pas être capturé ────────
router.get("/me", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ error: "Aucun utilisateur" });
  res.json(await buildUserDashboard(user));
});

router.get("/moi", async (req, res, next) => {
  try { res.json({ data: await getUtilisateurComplet(req.user.id) }); }
  catch (err) { next(err); }
});

router.get("/mon-profil", async (req, res, next) => {
  try { res.json({ data: await getUtilisateurComplet(req.user.id) }); }
  catch (err) { next(err); }
});

// ── Catalogue des permissions (admin) ───────────────────────────────────────
router.get("/permissions/catalogue", exigerAdmin, async (req, res, next) => {
  try { res.json({ data: await getCataloguePermissions() }); }
  catch (err) { next(err); }
});

// ── Liste des employés de la ferme (admin) ──────────────────────────────────
router.get("/", exigerAdmin, async (req, res, next) => {
  try { res.json({ data: await listerUtilisateurs(fermeDe(req)) }); }
  catch (err) { next(err); }
});

// ── Créer un employé (admin) ─────────────────────────────────────────────────
// Body : { nom, telephone?, role }  — PLUS de motDePasse (généré côté serveur).
// Réponse : { data: { …user, username, motDePasseTemporaire } }
//   → l'UI affiche username + mot de passe pour copie/communication (UNE fois).
router.post("/", exigerAdmin, async (req, res, next) => {
  try {
    const { nom, telephone, role, permissions, notifications } = req.body;

    const errors = [];
    if (!nom?.trim()) errors.push("nom est obligatoire");
    if (!role)        errors.push("role est obligatoire");
    if (errors.length) return res.status(400).json({ errors });

    const employe = await creerEmploye({ nom, telephone, role, fermeId: fermeDe(req) ,permissions,notifications});
    res.status(201).json({ data: employe }); // { …, username, motDePasseTemporaire }
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Détail d'un utilisateur (admin) ─────────────────────────────────────────
router.get("/:id", exigerAdmin, memeFerme, async (req, res) => {
  const u=await getUtilisateurDetail(req.params.id);
  console.log(u)
  res.json({ data: u });
});

// ── Réinitialiser le mot de passe d'un employé (admin) ──────────────────────
// body : { nouveauMdp }. Force le changement au prochain login.
router.patch("/:id/reset-password", exigerAdmin, memeFerme, async (req, res, next) => {
  try {
    const { nouveauMdp } = req.body;
    if (!nouveauMdp || nouveauMdp.length < 8)
      return res.status(400).json({ error: "nouveauMdp: minimum 8 caractères" });
    if (req.cible.role === "ADMINISTRATEUR")
      return res.status(400).json({ error: "L'administrateur réinitialise son mot de passe par email." });

    const r = await reinitialiserMotDePasseEmploye(req.params.id, nouveauMdp, fermeDe(req));
    res.json({ data: r, message: "Mot de passe réinitialisé. L'employé devra le changer à la prochaine connexion." });
  } catch (err) { next(err); }
});

// ── Activer / désactiver (admin) ────────────────────────────────────────────
router.patch("/:id/statut", exigerAdmin, memeFerme, async (req, res, next) => {
  try {
    const { actif } = req.body;
    if (typeof actif !== "boolean")
      return res.status(400).json({ error: "actif (boolean) requis." });
    if (req.params.id === req.user.id && actif === false)
      return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    res.json({ data: await changerStatut(req.params.id, actif) });
  } catch (err) { next(err); }
});

// ── Matrice de permissions (admin) ──────────────────────────────────────────
router.put("/:id/permissions", exigerAdmin, memeFerme, async (req, res, next) => {
  try {
    if (req.cible.role === "ADMINISTRATEUR")
      return res.status(400).json({ error: "L'administrateur possède tous les droits." });
    const { permissions } = req.body;
    if (!Array.isArray(permissions))
      return res.status(400).json({ error: "permissions (array) requis." });
    res.json({ data: await mettreAJourPermissions(req.params.id, permissions) });
  } catch (err) { next(err); }
});

// ── Préférences de notification (admin) ─────────────────────────────────────
router.put("/:id/notifications", exigerAdmin, memeFerme, async (req, res, next) => {
  try {
    const { notifications } = req.body;
    if (!Array.isArray(notifications))
      return res.status(400).json({ error: "notifications (array) requis." });
    res.json({ data: await mettreAJourNotifications(req.params.id, notifications) });
  } catch (err) { next(err); }
});

export default router;