// Query helpers for table: reproduction
import { makeCrud } from './_base.js';

const crud = makeCrud('reproduction');

export const reproductionApi = {
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
  getByBrebisId: (brebisId, options) => crud.findBy('brebis_id', brebisId, options),  // -> row[]
  getByBelierId: (belierId, options) => crud.findBy('belier_id', belierId, options),  // -> row[]
};

export default reproductionApi;
