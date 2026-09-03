// Query helpers for table: ferme
import { makeCrud } from './_base.js';

const crud = makeCrud('ferme');

export const fermeApi = {
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
  getByAdministrateurId: (administrateurId, options) => crud.findBy('administrateur_id', administrateurId, options),  // -> row[]
  getByNumeroRegistre: (numeroRegistre, options) => crud.findOneBy('numero_registre', numeroRegistre, options),  // -> row | null (unique)
  getByNumeroIfu: (numeroIfu, options) => crud.findOneBy('numero_ifu', numeroIfu, options),
  getByNumeroPatente: (numPat, options) => crud.findOneBy('numero_patente', numPat, options),  // -> row | null (unique)
  // -> row | null (unique)
};

export default fermeApi;
