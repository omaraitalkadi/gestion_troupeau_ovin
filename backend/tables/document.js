// Query helpers for table: document
import { makeCrud } from './_base.js';

const crud = makeCrud('document');

export const documentApi = {
  // --- generic CRUD ---
  list:   crud.list,    // ({ select, limit, offset, orderBy, ascending, filters }) -> { data, count }
  get:    crud.get,     // (id) -> row
  create: crud.create,  // (values | values[]) -> row | rows
  update: crud.update,  // (id, patch) -> row
  remove: crud.remove,  // (id) -> true
  count:  crud.count,   // (filters?) -> number
  getOneBy: crud.getOneBy, //(filters,select?) -> row

  // --- relationship lookups ---
  getByAnimalId: (animalId, options) => crud.findBy('animal_id', animalId, options),  // -> row[]
};

export default documentApi;
