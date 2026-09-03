// jobs/alertes.cron.js
import cron from 'node-cron';
import supabase from '../supabaseClient.js';
import { creerAlerte } from '../services/AlertService.js';
import {creerVaccination} from '../services/VaccinationService.js'
// server/services/cron/scannerChaleursSansSuite.js
import * as reproductionService from '../services/ReproductionService.js'

import alerteApi from '../tables/alerte.js';

const DELAI_CHALEUR_JOURS = 2; // ~36 h de chaleur + marge de saisie

const DAY_MS = 864e5;
const STATUTS_VACCINATION_OUVERTS = ["PROGRAMMEE", "EN_ATTENTE"];
const STATUTS_ALERTE_EXISTANTE = ["ACTIVE", "EN_ATTENTE", "RESOLUE"];




cron.schedule('0 6 * * *', async () => {
  const résultats = await Promise.allSettled([
    scannerVaccinationsDues(),
    scannerMisesBasProches(),
    scannerDiagnosticsGestationDus(),
    scannerTraitementsDues(),
    scannerVaccinationsProgrammees(),
    scannerChaleursSansSuite(),

  ]);
  résultats.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[cron] scan ${i} a échoué :`, r.reason);
  });
});
console.log("cron job is scheduled");



async function scannerMisesBasProches() {
  // ⚠️ HYPOTHÈSES DE SCHÉMA À VÉRIFIER (non confirmées côté DB) :
  //   gestation(id, reproduction_id, date_fin_prevue, etat)
  //   reproduction(id, brebis_id)              -- FK vers l'animal (mère)
  //   naissance(id, gestation_id)               -- si présente, la mise bas a déjà eu lieu
  //   animal(id, ferme_id, numero_rfid, numero_legal)
  // Adapte les noms de colonnes/FK ci-dessous si besoin.

  const DAY_MS = 864e5;
  const FENETRE_JOURS = 2;
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "date inconnue");

  const limite = new Date(Date.now() + FENETRE_JOURS * DAY_MS).toISOString().slice(0, 10);

  // 1. Gestations dont la mise bas est prévue dans <= 2 jours (ou déjà dépassée),
  //    animal (brebis) résolu via la reproduction.
  const { data: gestations, error } = await supabase
    .from("gestation")
    .select(`
      id,
      date_fin_prevue,
      etat,
      reproduction:reproduction_id!inner(
        brebis:brebis_id!inner(id, ferme_id, numero_rfid, numero_legal)
      )
    `)
    .lte("date_fin_prevue", limite);

  if (error) throw error;
  if (!gestations || gestations.length === 0) {
    return { gestations_dues: 0, alertes_creees: 0, alertes_existantes: 0 };
  }

  const ids = gestations.map((g) => g.id);

  // 2. Exclure les gestations dont la mise bas a déjà été enregistrée (Naissance existante)
  const { data: naissances, error: errN } = await supabase
    .from("naissance")
    .select("gestation_id")
    .in("gestation_id", ids);

  if (errN) throw errN;
  const dejaNees = new Set((naissances ?? []).map((n) => n.gestation_id));

  // 3. Anti-doublon : entite_nom='gestation' + entite_id + statut ACTIVE/EN_ATTENTE/RESOLUE
  const { data: alertesExistantes, error: errA } = await supabase
    .from("alerte")
    .select("entite_id")
    .eq("entite_nom", "gestation")
    .in("entite_id", ids)
    .in("statut", ["ACTIVE", "EN_ATTENTE", "RESOLUE"]);

  if (errA) throw errA;
  const dejaAlertees = new Set((alertesExistantes ?? []).map((a) => a.entite_id));

  const aCreer = gestations.filter((g) => !dejaNees.has(g.id) && !dejaAlertees.has(g.id));

  // 4. Création via creerAlerte(), une par gestation restante
  const resultats = await Promise.allSettled(
    aCreer.map((g) => {
      const brebis = g.reproduction?.brebis;
      const nomAnimal = brebis?.numero_rfid ?? brebis?.numero_legal ?? brebis?.id ?? "animal inconnu";
      const dateStr = fmtDate(g.date_fin_prevue);
      const enRetard = new Date(g.date_fin_prevue) < new Date(new Date().toISOString().slice(0, 10));

      return creerAlerte({
        fermeId: brebis?.ferme_id,
        type: "REPRODUCTION_MISE_BAS",
        priorite: "ELEVEE",
        titre: enRetard ? "Mise bas en retard" : "Mise bas proche",
        message: enRetard
          ? `La mise bas de la brebis ${nomAnimal} était prévue le ${dateStr} et n'est pas encore enregistrée.`
          : `La mise bas de la brebis ${nomAnimal} est prévue le ${dateStr}.`,
        entiteName: "gestation",
        entiteId: g.id,
        dateEcheance: g.date_fin_prevue,
      });
    })
  );

  const alertesCreees = resultats.filter((r) => r.status === "fulfilled").length;
  const echecs = resultats
    .map((r, i) => (r.status === "rejected" ? { gestation_id: aCreer[i].id, erreur: r.reason?.message ?? String(r.reason) } : null))
    .filter(Boolean);

  if (echecs.length) {
    console.error("[scannerMisesBasProches] échecs de création d'alerte :", echecs);
  }

  return {
    gestations_dues: gestations.length,
    deja_nees: dejaNees.size,
    alertes_creees: alertesCreees,
    alertes_existantes: dejaAlertees.size,
    alertes_echouees: echecs.length,
  };
}

async function scannerVaccinationsDues() {
  const DAY_MS = 864e5;
  const FENETRE_JOURS = 2;
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "date inconnue");

  const limite = new Date(Date.now() + FENETRE_JOURS * DAY_MS).toISOString().slice(0, 10);

  // 1. Vaccinations dues, pas encore effectuées, animal résolu via le dossier médical
  const { data: vaccinations, error } = await supabase
    .from("vaccination")
    .select(`
      id,
      date_prevue,
      dossier_medical:dossier_medical_id!inner(
        animal:animal_id!inner(id, ferme_id, numero_rfid, numero_legal)
      )
    `)
    .lte("date_prevue", limite)
    .eq("effectue", false);

  if (error) throw error;
  if (!vaccinations || vaccinations.length === 0) {
    return { vaccinations_dues: 0, alertes_creees: 0, alertes_existantes: 0 };
  }

  // 2. Anti-doublon : entite_nom='vaccination' + entite_id + statut ACTIVE/EN_ATTENTE/RESOLUE
  const ids = vaccinations.map((v) => v.id);
  const { data: alertesExistantes, error: errA } = await supabase
    .from("alerte")
    .select("entite_id")
    .eq("entite_nom", "vaccination")
    .in("entite_id", ids)
    .in("statut", ["ACTIVE", "EN_ATTENTE", "RESOLUE"]);

  if (errA) throw errA;
  const dejaAlertees = new Set((alertesExistantes ?? []).map((a) => a.entite_id));

  const aCreer = vaccinations.filter((v) => !dejaAlertees.has(v.id));

  // 3. Création via creerAlerte(), une par vaccination sans alerte existante.
  //    allSettled : une alerte qui échoue ne bloque pas la création des autres.
  const resultats = await Promise.allSettled(
    aCreer.map((v) => {
      const animal = v.dossier_medical?.animal;
      const nomAnimal = animal?.numero_rfid ?? animal?.numero_legal ?? animal?.id ?? "animal inconnu";
      const dateStr = fmtDate(v.date_prevue);
      const enRetard = new Date(v.date_prevue) < new Date(new Date().toISOString().slice(0, 10));

      return creerAlerte({
        fermeId: animal?.ferme_id,
        type: "VACCINATION",
        priorite: "ELEVEE",
        titre: enRetard ? "Vaccination en retard" : "Vaccination à venir",
        message: enRetard
          ? `La vaccination de l'animal ${nomAnimal} était prévue le ${dateStr} et n'a pas été effectuée.`
          : `La vaccination de l'animal ${nomAnimal} est prévue le ${dateStr}.`,
        entiteName: "vaccination",
        entiteId: v.id,
        dateEcheance: v.date_prevue,
      });
    })
  );

  const alertesCreees = resultats.filter((r) => r.status === "fulfilled").length;
  const echecs = resultats
    .map((r, i) => (r.status === "rejected" ? { vaccination_id: aCreer[i].id, erreur: r.reason?.message ?? String(r.reason) } : null))
    .filter(Boolean);

  if (echecs.length) {
    console.error("[scannerVaccinationsDues] échecs de création d'alerte :", echecs);
  }

  return {
    vaccinations_dues: vaccinations.length,
    alertes_creees: alertesCreees,
    alertes_existantes: dejaAlertees.size,
    alertes_echouees: echecs.length,
  };
}


async function scannerTraitementsDues() {
  // ⚠️ HYPOTHÈSES DE SCHÉMA À VÉRIFIER (non confirmées côté DB) :
  //   traitement(id, nom, type, status, date_debut, date_fin, dossier_medical_id)
  //   dossier_medical(id, animal_id)            -- FK vers l'animal
  //   animal(id, ferme_id, numero_rfid, numero_legal)
  // Adapte les noms de colonnes/FK ci-dessous si besoin.

  const DAY_MS = 864e5;
  const FENETRE_JOURS = 2;
  const STATUTS_EXCLUS = ["TERMINE", "ANNULE", "INTERROMPU"];
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "date inconnue");

  const limite = new Date(Date.now() + FENETRE_JOURS * DAY_MS).toISOString().slice(0, 10);

  // 1. Traitements dont la date_debut est <= 2 jours (ou déjà dépassée),
  //    animal résolu via le dossier_medical.
  const { data: traitements, error } = await supabase
    .from("traitement")
    .select(`
      id,
      nom,
      type,
      status,
      date_debut,
      dossier_medical:dossier_medical_id!inner(
        animal:animal_id!inner(id, ferme_id, numero_rfid, numero_legal)
      )
    `)
    .lte("date_debut", limite)
    .not("status", "in", `(${STATUTS_EXCLUS.join(",")})`);

  if (error) throw error;
  if (!traitements || traitements.length === 0) {
    return { traitements_dus: 0, alertes_creees: 0, alertes_existantes: 0 };
  }

  const ids = traitements.map((t) => t.id);

  // 2. Anti-doublon : entite_nom='traitement' + entite_id + statut ACTIVE/EN_ATTENTE/RESOLUE
  const { data: alertesExistantes, error: errA } = await supabase
    .from("alerte")
    .select("entite_id")
    .eq("entite_nom", "traitement")
    .in("entite_id", ids)
    .in("statut", ["ACTIVE", "EN_ATTENTE", "RESOLUE"]);

  if (errA) throw errA;
  const dejaAlertes = new Set((alertesExistantes ?? []).map((a) => a.entite_id));

  const aCreer = traitements.filter((t) => !dejaAlertes.has(t.id));

  // 3. Création via creerAlerte(), une par traitement restant
  const resultats = await Promise.allSettled(
    aCreer.map((t) => {
      const animal = t.dossier_medical?.animal;
      const nomAnimal = animal?.numero_rfid ?? animal?.numero_legal ?? animal?.id ?? "animal inconnu";
      const dateStr = fmtDate(t.date_debut);
      const enRetard = new Date(t.date_debut) < new Date(new Date().toISOString().slice(0, 10));

      return creerAlerte({
        fermeId: animal?.ferme_id,
        type: "TRAITEMENT",
        priorite: "ELEVEE",
        titre: enRetard ? "Traitement en retard" : "Traitement à venir",
        message: enRetard
          ? `Le traitement "${t.nom}" (${t.type}) de l'animal ${nomAnimal} était prévu le ${dateStr} et n'est pas encore enregistré comme terminé.`
          : `Le traitement "${t.nom}" (${t.type}) de l'animal ${nomAnimal} est prévu le ${dateStr}.`,
        entiteName: "traitement",
        entiteId: t.id,
        dateEcheance: t.date_debut,
      });
    })
  );

  const alertesCreees = resultats.filter((r) => r.status === "fulfilled").length;
  const echecs = resultats
    .map((r, i) => (r.status === "rejected" ? { traitement_id: aCreer[i].id, erreur: r.reason?.message ?? String(r.reason) } : null))
    .filter(Boolean);

  if (echecs.length) {
    console.error("[scannerTraitementsDues] échecs de création d'alerte :", echecs);
  }

  return {
    traitements_dus: traitements.length,
    alertes_creees: alertesCreees,
    alertes_existantes: dejaAlertes.size,
    alertes_echouees: echecs.length,
  };
}


async function scannerDiagnosticsGestationDus() {
  // ⚠️ HYPOTHÈSES DE SCHÉMA À VÉRIFIER (non confirmées côté DB) :
  //   reproduction(id, brebis_id, date_saillie, methode)
  //   gestation(id, reproduction_id, ...)       -- si présente, le diagnostic a déjà été fait (gestation confirmée)
  //   animal(id, ferme_id, numero_rfid, numero_legal)
  // Adapte les noms de colonnes/FK ci-dessous si besoin.

  const SEUIL_JOURS_DIAGNOSTIC = 21; // délai après saillie à partir duquel le diagnostic est attendu — ajuste si besoin
  const DAY_MS = 864e5;
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "date inconnue");

  const dateLimite = new Date(Date.now() - SEUIL_JOURS_DIAGNOSTIC * DAY_MS)
    .toISOString()
    .slice(0, 10);

const { data: reproductions, error } = await supabase
  .from("reproduction")
  .select(`
    id,
    date_saillie,
    statut,
    brebis:brebis_id!inner(id, ferme_id, numero_rfid, numero_legal)
  `)
  .eq("statut", "SAILLIE")
  .lte("date_saillie", dateLimite);

  if (error) throw error;
  if (!reproductions || reproductions.length === 0) {
    return { reproductions_dues: 0, alertes_creees: 0, alertes_existantes: 0 };
  }

  const ids = reproductions.map((r) => r.id);

  // 2. Exclure les reproductions déjà diagnostiquées (Gestation existante)
  const { data: gestations, error: errG } = await supabase
    .from("gestation")
    .select("reproduction_id")
    .in("reproduction_id", ids);

  if (errG) throw errG;
  const dejaDiagnostiquees = new Set((gestations ?? []).map((g) => g.reproduction_id));

  // 3. Anti-doublon : entite_nom='reproduction' + entite_id + statut ACTIVE/EN_ATTENTE/RESOLUE
  const { data: alertesExistantes, error: errA } = await supabase
    .from("alerte")
    .select("entite_id")
    .eq("entite_nom", "reproduction")
    .in("entite_id", ids)
    .in("statut", ["ACTIVE", "EN_ATTENTE", "RESOLUE"]);

  if (errA) throw errA;
  const dejaAlertees = new Set((alertesExistantes ?? []).map((a) => a.entite_id));

  const aCreer = reproductions.filter(
    (r) => !dejaDiagnostiquees.has(r.id) && !dejaAlertees.has(r.id)
  );

  // 4. Création via creerAlerte(), une par reproduction restante
  const resultats = await Promise.allSettled(
    aCreer.map((r) => {
      const brebis = r.brebis;
      const nomAnimal = brebis?.numero_rfid ?? brebis?.numero_legal ?? brebis?.id ?? "animal inconnu";
      const dateStr = fmtDate(r.date_saillie);
      const dateDiagnosticDue = new Date(
        new Date(r.date_saillie).getTime() + SEUIL_JOURS_DIAGNOSTIC * DAY_MS
      )
      .toISOString()
      .slice(0, 10);

      return creerAlerte({
        fermeId: brebis?.ferme_id,
        type: "GESTATION_RETARD",
        priorite: "MOYENNE",
        titre: "Diagnostic de gestation à effectuer",
        message: `La brebis ${nomAnimal} a été saillie le ${dateStr} (plus de ${SEUIL_JOURS_DIAGNOSTIC} jours) et n'a pas encore de diagnostic de gestation.`,
        entiteName: "reproduction",
        entiteId: r.id,
        dateEcheance: dateDiagnosticDue,
      });
    })
  );

  const alertesCreees = resultats.filter((r) => r.status === "fulfilled").length;
  const echecs = resultats
    .map((r, i) => (r.status === "rejected" ? { reproduction_id: aCreer[i].id, erreur: r.reason?.message ?? String(r.reason) } : null))
    .filter(Boolean);

  if (echecs.length) {
    console.error("[scannerDiagnosticsGestationDus] échecs de création d'alerte :", echecs);
  }

  return {
    reproductions_dues: reproductions.length,
    deja_diagnostiquees: dejaDiagnostiquees.size,
    alertes_creees: alertesCreees,
    alertes_existantes: dejaAlertees.size,
    alertes_echouees: echecs.length,
  };
}

export async function scannerVaccinationsProgrammees() {
  // ⚠️ HYPOTHÈSES DE SCHÉMA À VÉRIFIER :
  //   programme_vaccination(id, ferme_id, medicament_id, age_min_jours, age_max_jours, sexe, nom, actif)
  //   animal(id, ferme_id, sexe, date_naissance, date_sortie, numero_rfid, numero_legal)
  //     → un animal "présent" = date_sortie IS NULL (sorti/mort/vendu = date_sortie renseignée)
  //   dossier_medical(id, animal_id)                 -- 1:1 avec animal
  //   vaccination(id, dossier_medical_id, medicament_id, programme_vaccination_id, statut, date_prevue)
  //   creerVaccination(...) et creerAlerte(...) : helpers db/ existants
  // Adapte les noms si besoin.

  const DAY_MS = 864e5;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const fmtAge = (j) => {
    if (j == null) return "âge inconnu";
    if (j < 30) return `${j} j`;
    const mois = Math.round(j / 30.44);
    return mois < 12 ? `${mois} mois` : `${(mois / 12).toFixed(1)} an(s)`;
  };

  // 1. Programmes actifs
  const { data: programmes, error: errP } = await supabase
    .from("programme_vaccination")
    .select("id, ferme_id, medicament_id, age_min_jours, age_max_jours, sexe, nom, actif")
    .eq("actif", true);

  if (errP) throw errP;
  if (!programmes || programmes.length === 0) {
    return { programmes_actifs: 0, vaccinations_creees: 0, alertes_creees: 0 };
  }

  let vaccinationsCreees = 0;
  let alertesCreees = 0;
  const echecs = [];

  for (const p of programmes) {
    // 2. Animaux éligibles par âge / sexe / présence — sélection en JS
    //    âge >= age_min : né au plus tard à (aujourd'hui - age_min jours)
    //    âge <= age_max : né au plus tôt à (aujourd'hui - age_max jours)
    const dateNaissanceMax = new Date(Date.now() - p.age_min_jours * DAY_MS).toISOString().slice(0, 10);
    const dateNaissanceMin = p.age_max_jours != null
      ? new Date(Date.now() - p.age_max_jours * DAY_MS).toISOString().slice(0, 10)
      : null;

    let q = supabase
      .from("animal")
      .select("id, date_naissance, sexe, numero_rfid, numero_legal, dossier_medical:dossier_medical(id)")
      .eq("ferme_id", p.ferme_id)
      .is("date_sortie", null)                 // animal encore présent dans le troupeau
      .not("date_naissance", "is", null)
      .lte("date_naissance", dateNaissanceMax);

    if (dateNaissanceMin) q = q.gte("date_naissance", dateNaissanceMin);
    if (p.sexe) q = q.eq("sexe", p.sexe);

    const { data: animaux, error: errA } = await q;
    if (errA) {
      echecs.push({ programme_id: p.id, erreur: errA.message });
      console.error(`[scannerVaccinationsProgrammees] éligibles ${p.id}`, errA);
      continue; // un programme en échec n'arrête pas les autres
    }
    if (!animaux || animaux.length === 0) continue;

    // 3. Anti-doublon groupé : vaccinations déjà ouvertes pour ce programme
    const dossierIds = animaux.map((a) => a.dossier_medical?.id).filter(Boolean);
    let dejaOuvertes = new Set();
    if (dossierIds.length) {
      const { data: existantes, error: errV } = await supabase
        .from("vaccination")
        .select("dossier_medical_id")
        .eq("programme_vaccination_id", p.id)
        .in("statut", ["PROGRAMMEE", "EN_ATTENTE"])
        .in("dossier_medical_id", dossierIds);

      if (errV) {
        echecs.push({ programme_id: p.id, erreur: errV.message });
        continue;
      }
      dejaOuvertes = new Set((existantes ?? []).map((v) => v.dossier_medical_id));
    }

    const aTraiter = animaux.filter(
      (a) => a.dossier_medical?.id && !dejaOuvertes.has(a.dossier_medical.id)
    );

    // 4. Créer vaccination + alerte pour chaque animal restant
    const resultats = await Promise.allSettled(
      aTraiter.map(async (a) => {
        const vaccination = await creerVaccination({
          dossierMedicalId: a.dossier_medical.id,
          medicamentId: p.medicament_id,
          programmeVaccinationId: p.id,
          statut: "PROGRAMMEE",
          datePrevue: aujourdhui,
        });

        const nomAnimal = a.numero_rfid ?? a.numero_legal ?? a.id ?? "animal inconnu";
        await creerAlerte({
          fermeId: p.ferme_id,
          type: "VACCINATION",
          priorite: "MOYENNE",
          titre: "Vaccination à réaliser",
          message: `L'animal ${nomAnimal} a atteint ${fmtAge(p.age_min_jours)} : vaccination "${p.nom}" à réaliser.`,
          entiteName: "vaccination",
          entiteId: vaccination.id,
          dateEcheance: aujourdhui,
        });

        return vaccination.id;
      })
    );

    vaccinationsCreees += resultats.filter((r) => r.status === "fulfilled").length;
    alertesCreees += resultats.filter((r) => r.status === "fulfilled").length;

    resultats.forEach((r, i) => {
      if (r.status === "rejected") {
        echecs.push({
          programme_id: p.id,
          dossier_medical_id: aTraiter[i].dossier_medical?.id,
          erreur: r.reason?.message ?? String(r.reason),
        });
      }
    });
  }

  if (echecs.length) {
    console.error("[scannerVaccinationsProgrammees] échecs :", echecs);
  }

  return {
    programmes_actifs: programmes.length,
    vaccinations_creees: vaccinationsCreees,
    alertes_creees: alertesCreees,
    echecs: echecs.length,
  };
}



 
/**
 * Détermine si un programme est dû aujourd'hui, à partir de sa fréquence
 * et du temps écoulé depuis sa dernière exécution.
 *   - date_derniere_execution null -> on prend date_creation comme référence pour calculer le temps écoulé
 *   - frequence_jours renseigné    -> dû si référence + frequence_jours <= maintenant
 *   - frequence_jours null (dose unique) -> dû seulement s'il n'a jamais été exécuté
 */
function estProgrammeDu(programme, maintenant) {
  const reference = programme.date_derniere_execution ?? programme.date_creation;
 
  if (!programme.frequence_jours) {
    // Dose unique : dû seulement tant qu'il n'a jamais tourné, peu importe date_creation
    return !programme.date_derniere_execution;
  }
 
  if (!reference) {
    console.warn(
      `[scannerProgrammesVaccination] programme ${programme.id} sans date_derniere_execution ni date_creation — ignoré (données incohérentes).`
    );
    return false; // fail-safe : on ne devine pas une échéance sans référence temporelle
  }
 
  const prochaineExecution = new Date(
    new Date(reference).getTime() + programme.frequence_jours * DAY_MS
  );
  return prochaineExecution <= maintenant;
}
 
 





export async function scannerChaleursSansSuite() {
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "date inconnue");
 
  // 1. Chaleurs périmées (brebis résolue) — via le service.
  const perimees = await reproductionService.trouverChaleursPerimees(DELAI_CHALEUR_JOURS);
  if (!perimees.length) return { scannees: 0, cloturees: 0, alertes_creees: 0, echecs: 0 };
 
  // 2. Anti-doublon : alertes déjà ouvertes sur ces reproductions.
  //    Les primitives ne font que des filtres d'égalité (pas de .in) → on récupère
  //    les alertes 'reproduction' puis on filtre en JS sur ids + statuts ouverts.
  const ids = perimees.map((r) => r.id);
  const alertesRepro = await alerteApi.getBy({ entite_nom: "reproduction" }, "entite_id, statut");
  const dejaAlertees = new Set(
    (alertesRepro ?? [])
      .filter((a) => ids.includes(a.entite_id) && STATUTS_ALERTE_EXISTANTE.includes(a.statut))
      .map((a) => a.entite_id)
  );
 
  // 3. Pour chaque chaleur périmée : bascule NON_SAILLIE (service) + alerte si absente.
  const resultats = await Promise.allSettled(
    perimees.map(async (r) => {
      await reproductionService.marquerNonSaillie(r.id); // transition gardée (idempotente)
 
      if (dejaAlertees.has(r.id)) return { repro: r.id, alerte: false };
 
      const brebis = r.brebis;
      const nomAnimal = brebis?.numero_rfid ?? brebis?.numero_legal ?? brebis?.id ?? "animal inconnu";
      await creerAlerte({
        fermeId: brebis?.ferme_id,
        type: "REPRODUCTION_CHALEURS",
        priorite: "MOYENNE",
        titre: "Chaleur sans saillie",
        message: `La chaleur de la brebis ${nomAnimal} détectée le ${fmtDate(r.date_creation)} n'a pas été suivie de saillie et a été clôturée (NON_SAILLIE).`,
        entiteName: "reproduction",
        entiteId: r.id,
        dateEcheance: r.date_creation,
      });
      return { repro: r.id, alerte: true };
    })
  );
 
  const echecs = resultats.filter((x) => x.status === "rejected");
  echecs.forEach((x, i) =>
    console.warn(`[scannerChaleurs] échec repro ${perimees[i].id}:`, x.reason?.message)
  );
 
  return {
    scannees:       perimees.length,
    cloturees:      resultats.filter((x) => x.status === "fulfilled").length,
    alertes_creees: resultats.filter((x) => x.status === "fulfilled" && x.value.alerte).length,
    echecs:         echecs.length,
  };
}
 