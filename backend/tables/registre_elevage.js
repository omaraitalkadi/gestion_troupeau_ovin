// Query helpers for table: registre_elevage
import { makeCrud } from './_base.js';

const crud = makeCrud('registre_elevage');

export const registreElevageApi = {
  // --- generic CRUD ---
  list:   crud.list,    // ({ select, limit, offset, orderBy, ascending, filters }) -> { data, count }
  get:    crud.get,     // (id) -> row
  create: crud.create,  // (values | values[]) -> row | rows
  update: crud.update,  // (id, patch) -> row
  remove: crud.remove,  // (id) -> true
  count:  crud.count,   // (filters?) -> number

  // --- relationship lookups ---
  getByFermeId: (fermeId, options) => crud.findBy('ferme_id', fermeId, options),  // -> row[]
};

export default registreElevageApi;
