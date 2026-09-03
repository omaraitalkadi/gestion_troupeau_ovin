// Query helpers for table: traitement
import { makeCrud } from './_base.js';

const crud = makeCrud('traitement');

export const traitementApi = {
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
  getByMedicamentId: (medicamentId, options) => crud.findBy('medicament_id', medicamentId, options),  // -> row[]
  getByVeterinairePrescripteurId: (veterinairePrescripteurId, options) => crud.findBy('veterinaire_prescripteur_id', veterinairePrescripteurId, options),  // -> row[]
  getByOperateurAdministrateurId: (operateurAdministrateurId, options) => crud.findBy('operateur_administrateur_id', operateurAdministrateurId, options),  // -> row[]
  getByConsultationVeterinaireId: (consultationVeterinaireId, options) => crud.findBy('consultation_veterinaire_id', consultationVeterinaireId, options),  // -> row[]
};

export default traitementApi;
