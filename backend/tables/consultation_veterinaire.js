// Query helpers for table: consultation_veterinaire
import { makeCrud } from './_base.js';

const crud = makeCrud('consultation_veterinaire');

export const consultationVeterinaireApi = {
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
  getByVeterinaireId: (veterinaireId, options) => crud.findBy('veterinaire_id', veterinaireId, options),  // -> row[]
  getByTransactionFinanciereId: (transactionFinanciereId, options) => crud.findOneBy('transaction_financiere_id', transactionFinanciereId, options),  // -> row | null (unique)
};

export default consultationVeterinaireApi;
