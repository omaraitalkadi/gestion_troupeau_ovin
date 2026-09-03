// Query helpers for table: campagne_vaccination
import { makeCrud } from './_base.js';

const crud = makeCrud('campagne_vaccination');

export const campagneVaccinationApi = {
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
  getByMedicamentId: (medicamentId, options) => crud.findBy('medicament_id', medicamentId, options),  // -> row[]
  getByUtilisateurId: (utilisateurId, options) => crud.findBy('utilisateur_id', utilisateurId, options),  // -> row[]
};

export default campagneVaccinationApi;
