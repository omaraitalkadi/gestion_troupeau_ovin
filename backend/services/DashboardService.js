// server/services/DashboardService.js
// Agrège les indicateurs du tableau de bord d'une ferme.
// (Lots et alertes exclus : déjà couverts ailleurs.)
import { db } from "../tables/index.js";
import { getTransactionsFerme } from "./FinanceService.js"; // fonction créée précédemment

const badRequest = (m) => Object.assign(new Error(m), { status: 400 });
const unwrap = (r) => (Array.isArray(r) ? r : (r?.data ?? []));

const debutDuMois = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export async function getDashboard(ferme_id) {
  if (!ferme_id) throw badRequest("ferme_id est obligatoire.");

  const moisDebut = debutDuMois();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // ── Animaux de la ferme (léger : id, status, pour comptages) ──
  const animaux = unwrap(await db.animal.findBy("ferme_id", ferme_id, { select: "id, status" }));
  const animalIds = animaux.map((a) => a.id);

  const parStatut = { ACTIF: 0, VENDU: 0, MORT: 0, EN_QUARANTAINE: 0 };
  for (const a of animaux) if (a.status in parStatut) parStatut[a.status]++;

  // ── Reproductions de la ferme (via brebis = animal de la ferme) ──
  // On récupère les reproductions dont brebis_id ∈ animaux de la ferme,
  // avec la gestation imbriquée pour compter les gestations en cours.
  let reproductions = [];
  if (animalIds.length) {
    reproductions = unwrap(await db.reproduction.findByIn("brebis_id", animalIds, {
      select: "id, statut, gestation:gestation!reproduction_id(id, etat, date_debut)",
    }));
  }

  // Gestations EN_COURS + celles débutées ce mois
  let gestationsEnCours = 0;
  let gestationsCeMois = 0;
  for (const r of reproductions) {
    const g = r.gestation;
    if (!g) continue;
    if (g.etat === "EN_COURS") gestationsEnCours++;
    if (g.date_debut && g.date_debut >= moisDebut) gestationsCeMois++;
  }

  // ── Naissances de ce mois (via gestation → reproduction → brebis de la ferme) ──
  // On récupère les naissances dont la gestation appartient à une repro de la ferme.
  const gestationIds = reproductions.map((r) => r.gestation?.id).filter(Boolean);
  let naissancesCeMois = 0;
  if (gestationIds.length) {
    const naissances = unwrap(await db.naissance.findByIn("gestation_id", gestationIds, {
      select: "id, date_naissance, nombre_agneaux",
    }));
    naissancesCeMois = naissances
      .filter((n) => n.date_naissance && n.date_naissance >= moisDebut)
      .reduce((s, n) => s + (Number(n.nombre_agneaux) || 1), 0);
  }

  // ── Vaccinations dues (non effectuées, prévues <= aujourd'hui) ──
  // via dossier_medical des animaux de la ferme.
  let vaccinationsDues = 0;
  if (animalIds.length) {
    const dossiers = unwrap(await db.dossierMedical.findByIn("animal_id", animalIds, { select: "id" }));
    const dossierIds = dossiers.map((d) => d.id);
    if (dossierIds.length) {
      const vaccs = unwrap(await db.vaccination.findByIn("dossier_medical_id", dossierIds, {
        select: "id, effectue, statut, date_prevue",
      }));
      vaccinationsDues = vaccs.filter(
        (v) => (v.effectue !== true && v.statut !== "EFFECTUEE") && v.date_prevue && v.date_prevue <= aujourdhui
      ).length;
    }
  }

  // ── Finance (dépenses + revenus + coût médian par animal) ──
  const transactions = await getTransactionsFerme({ ferme_id });
  let depenses = 0, revenus = 0;
  const coutsAchat = [];
  for (const t of transactions) {
    const montant = Number(t.montant) || 0;
    if (t.type === "COUT")    { depenses += montant; coutsAchat.push(montant); }
    else if (t.type === "REVENUE") revenus += montant;
  }
  const coutMedianParAnimal = mediane(coutsAchat);

  return {
    animaux: {
      total: animaux.length,
      actif: parStatut.ACTIF,
      vendu: parStatut.VENDU,
      mort: parStatut.MORT,
      quarantaine: parStatut.EN_QUARANTAINE,
    },
    reproduction: {
      gestations_en_cours: gestationsEnCours,
      gestations_ce_mois: gestationsCeMois,
      naissances_ce_mois: naissancesCeMois,
    },
    sante: {
      vaccinations_dues: vaccinationsDues,
    },
    finance: {
      depenses_total: depenses,
      revenus_total: revenus,
      solde: revenus - depenses,
      cout_median_par_animal: coutMedianParAnimal,
    },
  };
}

function mediane(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
