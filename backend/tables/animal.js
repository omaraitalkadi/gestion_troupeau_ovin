// Query helpers for table: animal
import { makeCrud } from './_base.js';

const crud = makeCrud('animal');

export const animalApi = {
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
  getByLotId: (lotId, options) => crud.findBy('lot_id', lotId, options),  // -> row[]
  getByMereId: (mereId, options) => crud.findBy('mere_id', mereId, options),  // -> row[]
  getByPereId: (pereId, options) => crud.findBy('pere_id', pereId, options),  // -> row[]
  getByReproductionOrigineId: (reproductionOrigineId, options) => crud.findBy('reproduction_origine_id', reproductionOrigineId, options),  // -> row[]
  getByNumeroRfid: (numero_rfid, ferme_id) => crud.getOneBy({numero_rfid,ferme_id}),  // -> row | null (unique)
  getByNumeroLegal: (numero_legal, ferme_id) => crud.getOneBy({numero_legal,ferme_id}),  // -> row | null (unique)
  getDescendants: async (id) => {
    const { data, error } = await supabase.rpc('animal_descendants', { p_id: id });
    if (error) throw error;
    return data;
  },

  // Toute la lignée parentale, bornée à la ferme.
  getAscendants: async (id, ferme_id) => {
    const { data, error } = await supabase.rpc('animal_ascendants', {
      p_id: id, p_ferme_id: ferme_id,
    });
    if (error) throw error;
    return data;
  },
};

export default animalApi;
