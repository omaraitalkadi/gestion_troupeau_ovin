// middleware/appartenance.js
//
// Contrôle d'appartenance à la ferme — deux surfaces :
//   • assertAppartient(...)      helper appelé DANS les services (validation de FK)
//   • verifierAppartenance(...)  fabrique de middleware (garde une route + charge la ligne)
//
// Les deux s'appuient sur un REGISTRE déclaratif (APPARTENANCE) qui décrit, pour
// chaque table, COMMENT elle atteint la ferme :
//   • { direct: "ferme_id" }             → la colonne est portée par la ligne
//   • { through: "brebis_id", table }    → la ligne pointe (FK) vers une table qui,
//                                           elle, sait résoudre sa ferme
// Les règles `through` se composent : la résolution remonte la chaîne
// récursivement (reproduction → animal → ferme ; gestation → reproduction → …).
// Ajouter une table sans ferme_id direct = AJOUTER UNE LIGNE au registre.

import { db } from "../tables/index.js";
import { APPARTENANCE } from "./appartenance_registry.js";



// ── OUTILS INTERNES ──────────────────────────────────────────
const notFound = (label) =>
  Object.assign(new Error(`${label} introuvable`), { status: 404 });

function regleDe(table) {
  const regle = APPARTENANCE[table];
  if (!regle)
    throw new Error(`Appartenance: aucune règle déclarée pour la table "${table}"`);
  if (!db[table]?.getOneBy)
    throw new Error(`Appartenance: table "${table}" absente ou sans getOneBy`);
  return regle;
}

// Ajoute `col` au select s'il manque (et si le select n'est pas déjà "*").
function withCol(select, col) {
  const cols = select.split(",").map((s) => s.trim());
  if (cols.includes("*") || cols.includes(col)) return select;
  return `${select}, ${col}`;
}

/**
 * Charge la ligne de 1er niveau de `table` (id = id) SI elle appartient — en
 * remontant la chaîne de FK déclarée — à `ferme_id`. Sinon renvoie null.
 *
 * - Cas direct   : UNE requête bornée à la ferme (la BD filtre ; aucune ligne
 *                  d'une autre ferme n'est chargée en mémoire).
 * - Cas indirect : on charge la ligne (elle n'a pas de ferme_id), on lit sa FK,
 *                  puis on délègue récursivement à la table parente.
 *
 * @returns {Promise<object|null>} la ligne de 1er niveau, ou null (introuvable
 *          ou hors ferme, indistinctement — pas de fuite d'existence).
 */
async function chargerSiAppartient(table, id, ferme_id, select = "id") {
  const regle = regleDe(table);

  if (regle.direct) {
    return db[table].getOneBy({ id, [regle.direct]: ferme_id }, select);
  }

  const row = await db[table].getOneBy({ id }, withCol(select, regle.through));
  if (!row) return null;

  const fk = row[regle.through];
  if (fk == null) return null; // FK obligatoire absente → incohérent → traité comme introuvable

  const parentAppartient = await chargerSiAppartient(regle.table, fk, ferme_id);
  return parentAppartient ? row : null;
}

// ── HELPER SERVICE ───────────────────────────────────────────
/**
 * Vérifie qu'une ressource référencée (FK venue du client) appartient à la
 * ferme courante. À appeler AVANT toute écriture qui la référence.
 *
 * @param {string} table
 * @param {string|null} id       null/undefined => rien à vérifier (FK optionnelle / effacement)
 * @param {string} ferme_id
 * @param {object} [opts]
 * @param {string} [opts.label]  libellé pour le message d'erreur
 * @param {string} [opts.select] colonnes de la ligne renvoyée (défaut "id")
 * @returns {Promise<object|null>} la ligne de 1er niveau (réutilisable), ou null si id absent
 */
export async function assertAppartient(table, id, ferme_id, { label, select = "id" } = {}) {
  if (id == null) return null;
  const row = await chargerSiAppartient(table, id, ferme_id, select);
  if (!row) throw notFound(label ?? table);
  return row;
}

// ── FABRIQUE DE MIDDLEWARE ───────────────────────────────────
/**
 * Garde une route : charge la ressource visée par req.params[param], vérifie
 * son appartenance (chaîne comprise), l'attache à req[attachAs], puis passe la
 * main. 404 indistinct pour "absente" et "hors ferme".
 */
export function verifierAppartenance(
  table,
  { param = "id", attachAs = table, select = "*" } = {}
) {
  regleDe(table); // échoue au boot, pas à la requête

  return async (req, res, next) => {
    try {
      const id = req.params[param];
      if (!id) return res.status(400).json({ error: `${param} manquant` });

      const ferme_id = req.user?.ferme_id;
      if (!ferme_id) return res.status(403).json({ error: "Ferme non résolue" });

      const row = await chargerSiAppartient(table, id, ferme_id, select);
      if (!row) return res.status(404).json({ error: "Ressource introuvable" });

      req[attachAs] = row;
      next();
    } catch (e) {
      next(e);
    }
  };
}


