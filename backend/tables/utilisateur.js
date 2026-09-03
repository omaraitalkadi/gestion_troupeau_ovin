// Query helpers for table: utilisateur
import { makeCrud } from './_base.js';

const crud = makeCrud('utilisateur');

export const utilisateurApi = {
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
  getByEmail: (email, options) => crud.findOneBy('email', email, options),  // -> row | null (unique)
};

export default utilisateurApi;
