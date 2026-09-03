// Query helpers for table: production
import { makeCrud } from './_base.js';

const crud = makeCrud('production');

export const productionApi = {
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
  getByAnimalId: (animalId, options) => crud.findBy('animal_id', animalId, options),  // -> row[]
  getByMouvementTroupeauId: (mouvementTroupeauId, options) => crud.findBy('mouvement_troupeau_id', mouvementTroupeauId, options),  // -> row[]
};

export default productionApi;
