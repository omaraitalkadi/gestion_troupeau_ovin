// Query helpers for table: lot
import { makeCrud } from './_base.js';

const crud = makeCrud('lot');

export const lotApi = {
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
  getByPlanAlimentaireId: (planAlimentaireId, options) => crud.findBy('plan_alimentaire_id', planAlimentaireId, options),  // -> row[]
};

export default lotApi;
