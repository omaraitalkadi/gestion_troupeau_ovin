// Barrel file: re-exports every table API plus an aggregate `db` object.
//   import { db } from './tables/index.js';
//   const { data } = await db.animal.list({ limit: 20 });

export { fermeApi } from './ferme.js';
export { utilisateurApi } from './utilisateur.js';
export { rapportApi } from './rapport.js';
export { statistiqueApi } from './statistique.js';
export { indicateurPerformanceApi } from './indicateur_performance.js';
export { alimentApi } from './aliment.js';
export { planAlimentaireApi } from './plan_alimentaire.js';
export { medicamentApi } from './medicament.js';
export { alerteApi } from './alerte.js';
export { transactionFinanciereApi } from './transaction_financiere.js';
export { lotApi } from './lot.js';
export { animalApi } from './animal.js';
export { reproductionApi } from './reproduction.js';
export { gestationApi } from './gestation.js';
export { naissanceApi } from './naissance.js';
export { dossierMedicalApi } from './dossier_medical.js';
export { consultationVeterinaireApi } from './consultation_veterinaire.js';
export { campagneVaccinationApi } from './campagne_vaccination.js';
export { traitementApi } from './traitement.js';
export { vaccinationApi } from './vaccination.js';
export { transactionAnimauxApi } from './transaction_animaux.js';
export { mouvementTroupeauApi } from './mouvement_troupeau.js';
export { productionApi } from './production.js';
export { journalVieApi } from './journal_vie.js';
export { photoAnimalApi } from './photo_animal.js';
export { distributionAlimentaireApi } from './distribution_alimentaire.js';
export { consommationAlimentaireApi } from './consommation_alimentaire.js';
export { lignePlanAlimentaireApi } from './ligne_plan_alimentaire.js';
export { documentApi } from './document.js';
export { registreElevageApi } from './registre_elevage.js';
export { consultationDonneeApi } from './consultation_donnee.js';
export { sessionApi } from './session.js';
export { historiqueModificationApi } from './historique_modification.js';
export { notificationApi } from './notification.js';
export { commentaireApi } from './commentaire.js';
export {pendingSignupApi} from './pending_signup.js';


import { fermeApi } from './ferme.js';
import { utilisateurApi } from './utilisateur.js';
import { rapportApi } from './rapport.js';
import { statistiqueApi } from './statistique.js';
import { indicateurPerformanceApi } from './indicateur_performance.js';
import { alimentApi } from './aliment.js';
import { planAlimentaireApi } from './plan_alimentaire.js';
import { medicamentApi } from './medicament.js';
import { alerteApi } from './alerte.js';
import { transactionFinanciereApi } from './transaction_financiere.js';
import { lotApi } from './lot.js';
import { animalApi } from './animal.js';
import { reproductionApi } from './reproduction.js';
import { gestationApi } from './gestation.js';
import { naissanceApi } from './naissance.js';
import { dossierMedicalApi } from './dossier_medical.js';
import { consultationVeterinaireApi } from './consultation_veterinaire.js';
import { campagneVaccinationApi } from './campagne_vaccination.js';
import { traitementApi } from './traitement.js';
import { vaccinationApi } from './vaccination.js';
import { transactionAnimauxApi } from './transaction_animaux.js';
import { mouvementTroupeauApi } from './mouvement_troupeau.js';
import { productionApi } from './production.js';
import { journalVieApi } from './journal_vie.js';
import { photoAnimalApi } from './photo_animal.js';
import { distributionAlimentaireApi } from './distribution_alimentaire.js';
import { consommationAlimentaireApi } from './consommation_alimentaire.js';
import { lignePlanAlimentaireApi } from './ligne_plan_alimentaire.js';
import { documentApi } from './document.js';
import { registreElevageApi } from './registre_elevage.js';
import { consultationDonneeApi } from './consultation_donnee.js';
import { sessionApi } from './session.js';
import { historiqueModificationApi } from './historique_modification.js';
import { notificationApi } from './notification.js';
import { commentaireApi } from './commentaire.js';
import {ligneAchatApi} from './ligne_achat.js';
import {programmeVaccinationApi} from './programme_vaccination.js'
import {pendingSignupApi} from './pending_signup.js';

export const db = {
  ferme: fermeApi,
  utilisateur: utilisateurApi,
  rapport: rapportApi,
  statistique: statistiqueApi,
  indicateurPerformance: indicateurPerformanceApi,
  indicateur_performance: indicateurPerformanceApi,
  aliment: alimentApi,
  planAlimentaire: planAlimentaireApi,
  plan_alimentaire: planAlimentaireApi,
  medicament: medicamentApi,
  alerte: alerteApi,
  transactionFinanciere: transactionFinanciereApi,
  transaction_financiere: transactionFinanciereApi,
  lot: lotApi,
  animal: animalApi,
  reproduction: reproductionApi,
  gestation: gestationApi,
  naissance: naissanceApi,
  dossierMedical: dossierMedicalApi,
  dossier_medical: dossierMedicalApi,
  consultationVeterinaire: consultationVeterinaireApi,
  consultation_veterinaire: consultationVeterinaireApi,
  campagneVaccination: campagneVaccinationApi,
  campagne_vaccination: campagneVaccinationApi,
  traitement: traitementApi,
  vaccination: vaccinationApi,
  transactionAnimaux: transactionAnimauxApi,
  transaction_animaux: transactionAnimauxApi,
  mouvementTroupeau: mouvementTroupeauApi,
  mouvement_troupeau: mouvementTroupeauApi,
  production: productionApi,
  journalVie: journalVieApi,
  journal_vie: journalVieApi,
  photoAnimal: photoAnimalApi,
  photo_animal: photoAnimalApi,
  distributionAlimentaire: distributionAlimentaireApi,
  distribution_alimentaire: distributionAlimentaireApi,
  consommationAlimentaire: consommationAlimentaireApi,
  consommation_alimentaire: consommationAlimentaireApi,
  lignePlanAlimentaire: lignePlanAlimentaireApi,
  ligne_plan_alimentaire: lignePlanAlimentaireApi,
  document: documentApi,
  registreElevage: registreElevageApi,
  registre_elevage: registreElevageApi,
  consultationDonnee: consultationDonneeApi,
  consultation_donnee: consultationDonneeApi,
  session: sessionApi,
  historiqueModification: historiqueModificationApi,
  historique_modification: historiqueModificationApi,
  notification: notificationApi,
  commentaire: commentaireApi,
  ligneAchat: ligneAchatApi,
  ligne_achat: ligneAchatApi,
  programmeVaccination: programmeVaccinationApi,
  programme_vaccination: programmeVaccinationApi,
  pendingSignup: pendingSignupApi,
  pending_signup: pendingSignupApi,
};

export default db;