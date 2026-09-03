// Query helpers for table: distribution_alimentaire
import { makeCrud } from './_base.js';

const crud = makeCrud('distribution_alimentaire');

export const distributionAlimentaireApi = {
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
  getByPlanAlimentaireId: (planAlimentaireId, options) => crud.findBy('plan_alimentaire_id', planAlimentaireId, options),  // -> row[]
  // db/distribution.db.js  — add to distributionDb
 listByFerme:async (fermeId, { lotId, planId, dateFrom, dateTo } = {})=> {
  let q = supabase
    .from("distribution_alimentaire")
    .select(
      "*"
    )
    .eq("ferme_id", fermeId)
    .order("date_distribution", { ascending: false });

  if (lotId) q = q.eq("lot_id", lotId);
  if (planId) q = q.eq("plan_id", planId);
  if (dateFrom) q = q.gte("date_distribution", dateFrom);
  if (dateTo) q = q.lte("date_distribution", dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data;
},
};

export default distributionAlimentaireApi;
