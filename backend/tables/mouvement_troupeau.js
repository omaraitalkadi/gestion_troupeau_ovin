// Query helpers for table: mouvement_troupeau
import { makeCrud } from './_base.js';

const crud = makeCrud('mouvement_troupeau');

export const mouvementTroupeauApi = {
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
  getByTransactionAnimauxId: (transactionAnimauxId, options) => crud.findBy('transaction_animaux_id', transactionAnimauxId, options),  // -> row[]
  getByLotOrigineId: (lotOrigineId, options) => crud.findBy('lot_origine_id', lotOrigineId, options),  // -> row[]
  getByLotDestId: (lotDestId, options) => crud.findBy('lot_dest_id', lotDestId, options),  // -> row[]
  getByTransactionFinanciereId: (transactionFinanciereId, options) => crud.findBy('transaction_financiere_id', transactionFinanciereId, options),  // -> row[]
};

export default mouvementTroupeauApi;
