// Query helpers for table: session
import { makeCrud } from './_base.js';

const crud = makeCrud('session');

export const sessionApi = {
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
  getByUtilisateurId: (utilisateurId, options) => crud.findBy('utilisateur_id', utilisateurId, options),  // -> row[]
  getByToken: (token, options) => crud.findOneBy('token', token, options),  // -> row | null (unique)
};

export default sessionApi;
