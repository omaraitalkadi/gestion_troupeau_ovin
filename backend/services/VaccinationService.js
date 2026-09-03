// server/services/VaccinationService.js
// Toute l'I/O passe par les primitives des modules table (db.*), plus de
// supabase.from direct.
import { db } from "../tables/index.js";
import { assertAppartient } from "../middleware/appartenance.js";

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const conflit    = (msg) => Object.assign(new Error(msg), { status: 409 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validerUuid = (v, champ) => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw badRequest(`${champ} invalide (UUID attendu)`);
  return v;
};

// Détail complet d'une vaccination. Embeds LEFT (→ null si le lien n'existe pas).
const SELECT_VACCINATION_DETAIL = `
  *,
  medicament:medicament!medicament_id(*),
  programme:programme_vaccination!programme_vaccination_id(*),
  campagne:campagne_vaccination!campagne_id(*),
  veterinaire:utilisateur!veterinaire_id(id, nom, email, role),
  operateur:utilisateur!operateur_id(id, nom, email, role)
`;

// ══════════════════════════════════════════════════════════════════════════
//  PROGRAMMES DE VACCINATION
// ══════════════════════════════════════════════════════════════════════════
export async function creerProgrammeVaccination({
  fermeId, medicamentId, creePar, nom, ageMinJours, ageMaxJours, sexe,
}) {
  return db.programmeVaccination.create({
    ferme_id:      fermeId,
    medicament_id: medicamentId,
    cree_par:      creePar ?? null,
    nom,
    age_min_jours: ageMinJours,
    age_max_jours: ageMaxJours ?? null,
    sexe:          sexe ?? null,
    actif:         true,
  });
}

/** Liste tous les programmes configurés pour un médicament donné. */
export async function listerProgrammesParMedicament(medicamentId) {
  return db.programmeVaccination.findBy("medicament_id", medicamentId, {
    select: "id, nom, age_min_jours, age_max_jours, sexe, actif, date_creation",
    orderBy: "date_creation",
    ascending: false,
  });
}

/** Détail complet d'un programme (panneau rapide). */
export async function getProgrammeVaccinationById(id) {
  const rows = await db.programmeVaccination.findBy("id", id, {
    select: `
      id, nom, age_min_jours, age_max_jours, sexe, actif, date_creation,
      medicament:medicament_id ( id, nom_commercial, categorie ),
      cree_par_utilisateur:cree_par ( id, nom, prenom )
    `,
  });
  return rows[0] ?? null;
}

/** Désactive un programme (arrête sa génération future ; n'affecte pas l'existant). */
export async function desactiverProgrammeVaccination(id) {
  return db.programmeVaccination.update(id, { actif: false });
}

// ══════════════════════════════════════════════════════════════════════════
//  VACCINATION (acte individuel)
// ══════════════════════════════════════════════════════════════════════════
/**
 * Crée une vaccination.
 * Dédup : index unique partiel (programme_vaccination_id, dossier_medical_id)
 *         WHERE programme_vaccination_id IS NOT NULL → 23505 = doublon idempotent.
 */
export async function creerVaccination({
  dossierMedicalId,
  medicamentId,
  statut = "PROGRAMMEE",
  datePrevue,
  dateVaccination = null,
  effectue = false,
  programmeVaccinationId = null,
  campagneId = null,
  veterinaireId = null,
  operateurId = null,
}) {
  const payload = {
    dossier_medical_id: dossierMedicalId,
    medicament_id:      medicamentId,
    statut,
    date_prevue:        datePrevue,
    date_vaccination:   dateVaccination,
    effectue,
  };
  if (programmeVaccinationId) payload.programme_vaccination_id = programmeVaccinationId;
  if (campagneId)             payload.campagne_id              = campagneId;
  if (veterinaireId)          payload.veterinaire_id           = veterinaireId;
  if (operateurId)            payload.operateur_id             = operateurId;

  try {
    return await db.vaccination.create(payload);
  } catch (error) {
    // 23505 = unique_violation → la dose programme/dossier existe déjà → idempotent
    if (error?.code === "23505" && programmeVaccinationId) {
      return db.vaccination.getOneBy({
        programme_vaccination_id: programmeVaccinationId,
        dossier_medical_id:       dossierMedicalId,
      });
    }
    throw error;
  }
}

/**
 * Détail d'une vaccination (médicament, programme, campagne, vét, opérateur).
 * @returns {Promise<object|null>}
 */
export async function getVaccinationById(id, ferme_id) {
  await assertAppartient("vaccination", validerUuid(id, "id"), ferme_id, {
    label: "Vaccination", select: "id",
  });
  const rows = await db.vaccination.findBy("id", id, { select: SELECT_VACCINATION_DETAIL });
  return rows[0] ?? null;
}

/**
 * Toutes les vaccinations d'un animal (enrichies), via son dossier médical (1:1).
 */
export async function getVaccinationsByAnimal(animal_id, ferme_id) {
  const id = validerUuid(animal_id, "animal_id");
  await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id" });

  const dossier = await db.dossierMedical.getOneBy({ animal_id: id }, "id");
  if (!dossier) return []; // pas de dossier → pas de vaccinations

  return db.vaccination.findBy("dossier_medical_id", dossier.id, {
    select: SELECT_VACCINATION_DETAIL,
    orderBy: "date_prevue",
    ascending: false,
  });
}

/**
 * Marque une vaccination comme effectuée. Idempotent : déjà faite → 409.
 */
export async function marquerVaccinationEffectuee(id, { date_effectuee, veterinaire_id, operateur_id } = {}, ferme_id) {
  const vacc = await assertAppartient("vaccination", validerUuid(id, "id"), ferme_id, {
    label: "Vaccination", select: "id, effectue",
  });
  if (vacc.effectue === true)
    throw conflit("Vaccination déjà marquée comme effectuée");

  const patch = {
    effectue:         true,
    date_vaccination: date_effectuee ?? new Date().toISOString().slice(0, 10),
    statut:           "REALISEE",
  };
  if (veterinaire_id) patch.veterinaire_id = validerUuid(veterinaire_id, "veterinaire_id");
  if (operateur_id)   patch.operateur_id   = validerUuid(operateur_id, "operateur_id");

  return db.vaccination.update(id, patch);
}