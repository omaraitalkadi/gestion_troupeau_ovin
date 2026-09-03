// Query helpers for table: statistique
import { makeCrud } from './_base.js';

const crud = makeCrud('statistique');

export const statistiqueApi = {
  // --- generic CRUD ---
  list:   crud.list,    // ({ select, limit, offset, orderBy, ascending, filters }) -> { data, count }
  get:    crud.get,     // (id) -> row
  create: crud.create,  // (values | values[]) -> row | rows
  update: crud.update,  // (id, patch) -> row
  remove: crud.remove,  // (id) -> true
  count:  crud.count,   // (filters?) -> number

  // --- relationship lookups ---
  getByRapportId: (rapportId, options) => crud.findBy('rapport_id', rapportId, options),  // -> row[]
};

export default statistiqueApi;
