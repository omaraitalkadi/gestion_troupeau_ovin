// Query helpers for table: vaccination
import { makeCrud } from './_base.js';

const crud = makeCrud('vaccination');

export const vaccinationApi = {
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
  getByDossierMedicalId: (dossierMedicalId, options) => crud.findBy('dossier_medical_id', dossierMedicalId, options),  // -> row[]
  getByCampagneId: (campagneId, options) => crud.findBy('campagne_id', campagneId, options),  // -> row[]
  getByMedicamentId: (medicamentId, options) => crud.findBy('medicament_id', medicamentId, options),  // -> row[]
  getByVeterinaireId: (veterinaireId, options) => crud.findBy('veterinaire_id', veterinaireId, options),  // -> row[]
  getByOperateurId: (operateurId, options) => crud.findBy('operateur_id', operateurId, options),  // -> row[]
};

export default vaccinationApi;
