// Query helpers for table: medicament
import { makeCrud } from './_base.js';

const crud = makeCrud('medicament');

export const medicamentApi = {
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
};

export default medicamentApi;
