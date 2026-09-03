// services/FinanceService.js
//
// Brique de base : creerTransactionFinanciere(...) — le SEUL endroit qui insère
// dans transaction_financiere. Vente, achat, consultation, dépense de ferme…
// passent tous par elle.
//
// RÈGLE ferme_id / utilisateur_id sur la transaction :
//   • On les renseigne UNIQUEMENT quand la transaction se suffit à elle-même :
//       ferme_id       → dépense/recette de ferme SANS entité (loyer, élec, matériel…)
//       utilisateur_id → rattachée à un utilisateur précis (salaire, remboursement)
//   • Sinon (achat, vente, consultation…) les DEUX restent null : la ferme est
//     atteinte par la référence INDIRECTE (ligne_achat / mouvement_troupeau /
//     transaction_animaux / consultation_veterinaire). getTransactionFerme(...)
//     agrège direct + indirect.
//
// Écriture multi-tables best-effort (CompensationStack). La vraie solution
// production reste une RPC Postgres transactionnelle (voir bas de fichier).

import { db } from "../tables/index.js";
import { getAlimentById } from "./AlimentationService.js";
import { getMedicamentById } from "./MedicamentService.js";

// ── petits utilitaires ─────────────────────────────────────────────────
const today      = () => new Date().toISOString().slice(0, 10);
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

// ⚠️ 7 décimales malgré le nom (impl. d'origine conservée pour ne pas changer
//    les montants existants). Passe à 1e4 si tu veux réellement 4 décimales.
const arrondi4   = (n) => Math.round(n * 1e7) / 1e7;

function coutMoyenPondere(qAncien, puAncien, qNouveau, puNouveau) {
  const stockAncien = qAncien > 0 ? qAncien : 0;
  const coutAncien  = puAncien != null ? puAncien : 0;
  const total = stockAncien + qNouveau;
  if (total <= 0) return puNouveau;            // garde-fou : jamais de /0
  return (stockAncien * coutAncien + qNouveau * puNouveau) / total;
}

// ── Patron de compensation (best-effort). Remplace par ton import partagé. ──
class CompensationStack {
  #actions = [];
  push(desc, fn) { this.#actions.push({ desc, fn }); }
  async rollback() {
    const echecs = [];
    while (this.#actions.length) {                 // LIFO
      const { desc, fn } = this.#actions.pop();
      try { await fn(); } catch (e) { echecs.push(`${desc}: ${e.message}`); }
    }
    return echecs;
  }
}

// ════════════════════════════════════════════════════════════════════════
//  creerTransactionFinanciere — brique de base réutilisable
// ════════════════════════════════════════════════════════════════════════
const TYPES_TRANSACTION = ["REVENUE", "COUT"]; // enum TypeTransactionFinanciere

/**
 * Crée UNE ligne transaction_financiere.
 *
 * Colonnes portées par la table :
 *   OBLIGATOIRE  type              "REVENUE" | "COUT"
 *   OBLIGATOIRE  montant           number >= 0 (MAD, magnitude ; sens porté par `type`)
 *   OPTIONNEL    date_transaction  défaut = aujourd'hui (YYYY-MM-DD)
 *   OPTIONNEL    description
 *
 * LIENS DIRECTS — à ne renseigner QUE si la transaction est en elle-même :
 *   ferme_id        Ferme "0..1"       → dépense/recette de ferme sans entité
 *   utilisateur_id  Utilisateur "0..1" → rattachée à un utilisateur précis
 *
 * FK portées par d'AUTRES tables (⇒ NE PAS créer ici ; on les pose après en
 * référençant transaction.id) :
 *   mouvement_troupeau.transaction_financiere_id      (0..1 ↔ 0..1)
 *   ligne_achat.transaction_id                        (1 ↔ 0..1)
 *   transaction_animaux.transaction_financiere_id     (1 ↔ 1)
 *   consultation_veterinaire.transaction_financiere_id(1 ↔ 1)
 *
 * @returns {Promise<object>} la transaction créée
 */
export async function creerTransactionFinanciere({
  type,
  montant,
  ferme_id = null,
  utilisateur_id = null,   // ⚠️ si ta colonne d'audit s'appelle `cree_par`, renomme ci-dessous
  date_transaction,
  description = null,
  aliment_id,
  medicament_id,
}) {
  if (!TYPES_TRANSACTION.includes(type))
    throw badRequest(`type doit être ${TYPES_TRANSACTION.join(" | ")}.`);
  if (typeof montant !== "number" || !Number.isFinite(montant) || montant < 0)
    throw badRequest("montant doit être un nombre positif ou nul (MAD).");

  return db.transactionFinanciere.create({
    type,
    montant,
    date_transaction: date_transaction ?? today(),
    description: (typeof description === "string" && description.trim()) ? description.trim() : null,
    ferme_id,
    utilisateur_id,        // ← renomme en `cree_par` si c'est ta convention
    aliment_id,
    medicament_id
  });
}

/**
 * Dépense (ou recette) de ferme NON rattachée à une entité — le SEUL cas où
 * ferme_id est porté directement par la transaction (loyer, électricité,
 * entretien, matériel, subvention…).
 *
 * @param {object} p
 * @param {"REVENUE"|"COUT"} [p.type="COUT"]
 * @param {number} p.montant
 * @param {string} p.ferme_id            OBLIGATOIRE (dérivé serveur)
 * @param {string} [p.utilisateur_id]    si la dépense concerne un utilisateur précis
 * @param {string} [p.date_transaction]
 * @param {string} [p.description]
 */
export async function enregistrerDepenseFerme({
  type = "COUT", montant, ferme_id, utilisateur_id = null, date_transaction, description,
}) {
  if (!ferme_id) throw badRequest("ferme_id est obligatoire.");
  return creerTransactionFinanciere({ type, montant, ferme_id, utilisateur_id, date_transaction, description });
}

// ════════════════════════════════════════════════════════════════════════
//  ACHATS (aliment / médicament) — cœur unique
// ════════════════════════════════════════════════════════════════════════
// Tout ce qui diffère entre un achat d'aliment et de médicament :
const ACHAT_CONFIG = {
  aliment: {
    champId:     "aliment_id",
    ligneFk:     "aliment_id",
    module:      "aliment",          // db[module]
    getById:     getAlimentById,
    champStock:  "quantite_stock",
    champCout:   "cout_unitaire",
    uniteSaisie: "kg",
    description: (e, q) => `Achat aliment — ${e.nom} (${q} kg)`,
  },
  medicament: {
    champId:     "medicament_id",
    ligneFk:     "medicament_id",
    module:      "medicament",
    getById:     getMedicamentById,
    champStock:  "quantite_en_stock",
    champCout:   "prix_unitaire",
    uniteSaisie: "unités",
    description: (e, q) => `Achat médicament — ${e.nom_commercial} (${q} ${e.unite_mesure ?? ""})`.trim(),
  },
};

// Number("") === 0 : on valide que ce sont bien des nombres finis AVANT de comparer.
function validerAchat(payload, cfg) {
  const erreurs = [];

  const entiteId = payload[cfg.champId];
  if (!entiteId || typeof entiteId !== "string")
    erreurs.push(`${cfg.champId} est obligatoire.`);

  const quantite = payload.quantite;
  if (typeof quantite !== "number" || !Number.isFinite(quantite) || quantite <= 0)
    erreurs.push(`quantite doit être un nombre strictement positif (${cfg.uniteSaisie}).`);

  const montant = payload.montant;
  if (typeof montant !== "number" || !Number.isFinite(montant) || montant < 0)
    erreurs.push("montant doit être un nombre positif ou nul (MAD).");

  // ferme_id sert UNIQUEMENT à vérifier l'appartenance de l'entité (pas sur la transaction).
  if (!payload.ferme_id)
    erreurs.push("ferme_id est obligatoire ");

  if (erreurs.length) throw badRequest(erreurs.join(" "));

  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim() : null;

  return { entiteId, quantite, montant, description, ferme_id: payload.ferme_id };
}

async function enregistrerAchat(kind, payload) {
  const cfg = ACHAT_CONFIG[kind];
  const { entiteId, quantite, montant, description, ferme_id } = validerAchat(payload, cfg);

  // Existence + appartenance ferme (getById DOIT scoper par ferme_id, cf. getAnimalById).
  // ferme_id ne sert QU'ICI — il n'est PAS porté par la transaction (lien indirect via ligne_achat).
  const entite = await cfg.getById(entiteId);

  const prixUnitaire = montant / quantite;
  const stockActuel  = Number(entite[cfg.champStock] ?? 0);
  const coutActuel   = entite[cfg.champCout] != null ? Number(entite[cfg.champCout]) : null;
  const nouveauCout  = coutMoyenPondere(stockActuel, coutActuel, quantite, prixUnitaire);

  const stack = new CompensationStack();
  try {
    // 1️⃣ Transaction financière (COUT) — SANS ferme_id : atteinte via ligne_achat → entité → ferme.
    const transaction = await creerTransactionFinanciere({
      type: "COUT",
      montant,
      description: description ?? cfg.description(entite, quantite),
      [cfg.ligneFk]:entiteId,
    });
    stack.push("suppression transaction", () => db.transactionFinanciere.remove(transaction.id));

    // 2️⃣ Ligne d'achat (branche du XOR aliment/médicament) — porte le lien vers la ferme.
    const ligne = await db.ligneAchat.create({
      [cfg.ligneFk]:    entiteId,
      transaction_id:   transaction.id,
      quantite_achetee: quantite,
      prix_unitaire:    prixUnitaire,
    });
    stack.push("suppression ligne_achat", () => db.ligneAchat.remove(ligne.id));

    // 3️⃣ Entrée en stock + coût moyen pondéré.
    //    Dernière écriture (un UPDATE) : si elle échoue → rollback des 2 inserts.
    const entiteMaj = await db[cfg.module].update(entiteId, {
      [cfg.champStock]: stockActuel + quantite,
      [cfg.champCout]:  nouveauCout,
    });

    return { transaction, ligne_achat: ligne, [kind]: entiteMaj };
  } catch (e) {
    const echecs = await stack.rollback();
    if (echecs.length) e.message += ` | rollback incomplet: ${echecs.join("; ")}`;
    throw e;
  }
}

export const enregistrerAchatAliment    = (payload) => enregistrerAchat("aliment", payload);
export const enregistrerAchatMedicament = (payload) => enregistrerAchat("medicament", payload);

// ════════════════════════════════════════════════════════════════════════
//  Lecture
// ════════════════════════════════════════════════════════════════════════
// getTransactionFerme doit UNION-ner : ferme_id direct + tous les liens
// indirects (ligne_achat, mouvement_troupeau, transaction_animaux,
// consultation_veterinaire), dédupliqués. Candidat idéal à une vue / RPC SQL.
export async function getTransactions(filters = {}) {
  const { ferme_id, date_limit } = filters;
  if (!ferme_id) throw badRequest("ferme_id est obligatoire.");

  return db.transactionFinanciere.list({
    filters: { ferme_id },                                   // seule colonne réelle en égalité
    gte: date_limit ? { date_transaction: date_limit } : undefined, // borne de date (>=)
  });
}

/*
 * ── RPC Postgres recommandée en production (achat atomique) ────────────
 * create or replace function enregistrer_achat_aliment(
 *   p_aliment_id uuid, p_quantite numeric, p_montant numeric, p_description text
 * ) returns json language plpgsql as $$
 * declare v_tx_id uuid; v_pu numeric := round(p_montant / p_quantite, 4);
 * begin
 *   -- pas de ferme_id : la ferme est atteinte via ligne_achat → aliment
 *   insert into transaction_financiere (type, montant, date_transaction, description)
 *     values ('COUT', p_montant, current_date, p_description) returning id into v_tx_id;
 *   insert into ligne_achat (aliment_id, transaction_id, quantite_achetee, prix_unitaire)
 *     values (p_aliment_id, v_tx_id, p_quantite, v_pu);
 *   update aliment set quantite_stock = quantite_stock + p_quantite, cout_unitaire = v_pu
 *     where id = p_aliment_id;
 *   return json_build_object('transaction_id', v_tx_id);
 * end $$;
 * // service : supabase.rpc('enregistrer_achat_aliment', {...})
 */


 
export async function getTransactionsFerme({ ferme_id, type, date_limit, date_from, date_to } = {}) {
  if (!ferme_id) throw badRequest("ferme_id est obligatoire.");
 
  // 1) ids des entités appartenant à la ferme
  const [aliments, medicaments, utilisateurs] = await Promise.all([
    db.aliment.findBy("ferme_id", ferme_id, { select: "id" }),
    db.medicament.findBy("ferme_id", ferme_id, { select: "id" }),
    db.utilisateur.findBy("ferme_id", ferme_id, { select: "id" }),
  ]);

  const alimentIds     = aliments.map((a) => a.id);
  const medicamentIds  = medicaments.map((m) => m.id);
  const utilisateurIds = utilisateurs.map((u) => u.id);
 
  // 2) transactions par chaque voie (OR logique via requêtes séparées)
  const [directes, parAliment, parMedicament, parUtilisateur] = await Promise.all([
    db.transactionFinanciere.findBy("ferme_id", ferme_id),
    alimentIds.length     ? db.transactionFinanciere.findByIn("aliment_id", alimentIds)         : [],
    medicamentIds.length  ? db.transactionFinanciere.findByIn("medicament_id", medicamentIds)   : [],
    utilisateurIds.length ? db.transactionFinanciere.findByIn("utilisateur_id", utilisateurIds) : [],
  ]);
 
  // 3) dédup par id (une transaction peut matcher plusieurs voies)
  const parId = new Map();
  for (const t of [...directes, ...parAliment, ...parMedicament, ...parUtilisateur]) {
    parId.set(t.id, t);
  }
  let data = [...parId.values()];
 
  // 4) filtres additionnels (en JS : évite d'alourdir chaque requête)
  if (type)      data = data.filter((t) => t.type === type);
  if (date_from) data = data.filter((t) => t.date_transaction >= date_from);
  if (date_to)   data = data.filter((t) => t.date_transaction <= date_to);
  if (date_limit) data = data.filter((t) => t.date_transaction >= date_limit); // >= borne (30j…)
 
  // 5) tri par date décroissante
  data.sort((a, b) => (a.date_transaction < b.date_transaction ? 1 : -1));


  return data;
}
 