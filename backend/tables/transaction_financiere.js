// Query helpers for table: transaction_financiere
import { makeCrud } from './_base.js';
import supabase from '../supabaseClient.js';

const crud = makeCrud('transaction_financiere');
const COL_DATE = "date_transaction";
export const transactionFinanciereApi = {
  // --- generic CRUD ---
  list:   crud.list,    // ({ select, limit, offset, orderBy, ascending, filters }) -> { data, count }
  get:    crud.get,     // (id) -> row
  create: crud.create,  // (values | values[]) -> row | rows
  update: crud.update,  // (id, patch) -> row
  remove: crud.remove,  // (id) -> true
  count:  crud.count,   // (filters?) -> number
  findByIn: crud.findByIn,
  getOneBy: crud.getOneBy, //(filters,select?) -> row
  getBy:crud.getBy,
  findBy:crud.findBy,
  findOneBy:crud.findOneBy,

  // --- relationship lookups ---
  getByFermeId: (fermeId, options) => crud.findBy('ferme_id', fermeId, options),  // -> row[]
  getByUtilisateurId: (utilisateurId, options) => crud.findBy('utilisateur_id', utilisateurId, options),  // -> row[]
  getByMedicamentId: (medicamentId, options) => crud.findBy('medicament_id', medicamentId, options),  // -> row[]
  getByAlimentId: (alimentId, options) => crud.findBy('aliment_id', alimentId, options),  // -> row[]
  getTransactionFerme: async function (fermeId, { dateDebut, dateFin } = {},type="COUT") {
  if (!fermeId) {
    const err = new Error("fermeId manquant.");
    err.status = 400;
    throw err;
  }

  // Normalisation + validation des bornes (garde contre chaîne vide / date invalide).
  const debut = dateDebut ? String(dateDebut).slice(0, 10) : null;
  const fin = dateFin ? String(dateFin).slice(0, 10) : null;
  for (const [nom, val] of [["dateDebut", debut], ["dateFin", fin]]) {
    if (val && Number.isNaN(new Date(val).getTime())) {
      const err = new Error(`${nom} invalide.`);
      err.status = 400;
      throw err;
    }
  }

  const COLONNES = "*";

  // Applique la période à un query builder (après ses propres filtres).
  const avecPeriode = (q) => {
    if (debut) q = q.gte(COL_DATE, debut);
    if (fin) q = q.lt(COL_DATE, jourSuivant(fin)); // borne haute exclusive
    return q;
  };

  const [directes, paiements, achatsAliment, achatsMedicament] = await Promise.all([
    avecPeriode(
      supabase.from("transaction_financiere").select(COLONNES).eq("ferme_id", fermeId)
      .eq("type",type)
    ),
    avecPeriode(
      supabase
        .from("transaction_financiere")
        .select(`${COLONNES}, utilisateur:utilisateur_id!inner(ferme_id)`)
        .eq("utilisateur.ferme_id", fermeId)
        .eq("type",type)
    ),  
    avecPeriode(
      supabase
        .from("transaction_financiere")
        .select(`${COLONNES}, aliment:aliment_id!inner(ferme_id)`)
        .eq("aliment.ferme_id", fermeId)
        .eq("type",type)
    ),
    avecPeriode(
      supabase
        .from("transaction_financiere")
        .select(`${COLONNES}, medicament:medicament_id!inner(ferme_id)`)
        .eq("medicament.ferme_id", fermeId)
        .eq("type",type)
    ),
  ]);

  for (const r of [directes, paiements, achatsAliment, achatsMedicament]) {
    if (r.error) {
      const err = new Error(`Lecture des transactions impossible : ${r.error.message}`);
      err.status = 500;
      throw err;
    }
  }

  const parId = new Map();
  for (const ligne of [
    ...directes.data,
    ...paiements.data,
    ...achatsAliment.data,
    ...achatsMedicament.data,
  ]) {
    const { utilisateur, aliment, medicament, ...tx } = ligne;
    parId.set(tx.id, tx);
  }

  const transactions = [...parId.values()];
  transactions.sort((a, b) =>
    String(b[COL_DATE] ?? "").localeCompare(String(a[COL_DATE] ?? ""))
  );

  return transactions;
}
};

export default transactionFinanciereApi;
