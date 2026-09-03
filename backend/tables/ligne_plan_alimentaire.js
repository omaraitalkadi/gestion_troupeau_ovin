// Query helpers for table: ligne_plan_alimentaire
import { makeCrud } from './_base.js';

const crud = makeCrud('ligne_plan_alimentaire');

export const lignePlanAlimentaireApi = {
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
  getByAlimentId: (alimentId, options) => crud.findBy('aliment_id', alimentId, options),  // -> row[]
};

export default lignePlanAlimentaireApi;
