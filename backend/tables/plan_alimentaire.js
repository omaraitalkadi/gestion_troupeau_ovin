// Query helpers for table: plan_alimentaire
import { makeCrud } from './_base.js';
import supabase from '../supabaseClient.js';
const crud = makeCrud('plan_alimentaire');

export const planAlimentaireApi = {
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
  listByFerme: async (fermeId, { lotId } = {}) => {
    let q = supabase
      .from("plan_alimentaire")
      .select("*, lignes:ligne_plan_alimentaire(*, aliment:aliment(id, nom, cout_unitaire, quantite_stock))")
      .eq("ferme_id", fermeId);

    if (lotId) q = q.eq("lot_id", lotId);


    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
};

export default planAlimentaireApi;
