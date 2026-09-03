// Query helpers for table: naissance
import { makeCrud } from './_base.js';

const crud = makeCrud('naissance');

export const naissanceApi = {
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
  getByGestationId: (gestationId, options) => crud.findOneBy('gestation_id', gestationId, options),  // -> row | null (unique)
};

export default naissanceApi;
