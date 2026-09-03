// services/AlimentationService.js
// Toute l'I/O passe par les primitives des modules table (db.*), plus de
// supabase.from direct.
import { db } from "../tables/index.js";
import { alimentApi, consommationAlimentaireApi, planAlimentaireApi } from "../tables/index.js";
import { creerAlerte } from "./AlertService.js";

const TYPES_ALIMENT = new Set(["FOURRAGE", "CONCENTRE", "CEREALE", "MINERAL_VITAMINE"]);
const arrondi3 = (n) => n;

// ── Validation création aliment ──────────────────────────────
export function validerNouvelAliment(payload = {}) {
  const erreurs = [];

  const nom = typeof payload.nom === "string" ? payload.nom.trim() : "";
  if (!nom) erreurs.push("Le nom de l'aliment est obligatoire.");
  if (nom.length > 120) erreurs.push("Le nom ne doit pas dépasser 120 caractères.");

  const type = payload.type;
  if (!TYPES_ALIMENT.has(type))
    erreurs.push(`Type d'aliment invalide. Attendu : ${[...TYPES_ALIMENT].join(", ")}.`);

  const seuil = payload.seuil;
  if (!seuil || seuil < 0)
    erreurs.push("seuil est obligatoire et doit être supérieur à zéro");

  if (erreurs.length) {
    const err = new Error(erreurs.join(" "));
    err.status = 400;
    throw err;
  }

  return {
    nom,
    type,
    quantite_stock: 0, // règle métier : stock toujours 0 à la création
    seuil_alerte_stock: seuil,
    ferme_id: payload.ferme_id,
  };
}

export async function createAliment(payload) {
  const donnees = validerNouvelAliment(payload);
  try {
    return await alimentApi.create(donnees);
  } catch (e) {
    const err = new Error(`Création de l'aliment impossible : ${e.message}`); // bug corrigé : e, pas error
    err.status = 500;
    throw err;
  }
}

export async function getAlimentById(id) {
  try {
    return await alimentApi.get(id);
  } catch (error) {
    if (error.code === "PGRST116") {
      const err = new Error("Aliment introuvable.");
      err.status = 404;
      throw err;
    }
    const err = new Error(`Lecture de l'aliment impossible : ${error.message}`);
    err.status = 500;
    throw err;
  }
}

/**
 * Ajuste le stock d'un aliment (delta +entrée / -sortie).
 * ⚠️ Lecture puis écriture non atomiques (limite client JS). Une RPC
 *    `ajuster_stock_aliment(aliment_id, delta)` reste la solution production.
 */
export async function ajusterStockAliment(alimentId, delta, { coutUnitaire } = {}) {
  const aliment = await getAlimentById(alimentId);
  const avant = Number(aliment.quantite_stock ?? 0);
  const apres = avant + delta;

  if (apres < 0) {
    const err = new Error(`Stock insuffisant : ${avant} kg disponibles, sortie de ${-delta} kg demandée.`);
    err.status = 409;
    throw err;
  }

  const patch = { quantite_stock: apres };
  if (coutUnitaire != null) patch.cout_unitaire = coutUnitaire;

  const data = await alimentApi.update(alimentId, patch);
  return { avant, apres, aliment: data };
}

// ── Validation création plan ─────────────────────────────────
function validerNouveauPlan(payload = {}) {
  const erreurs = [];

  const nom = typeof payload.nom === "string" ? payload.nom.trim() : "";
  if (!nom) erreurs.push("Le nom du plan est obligatoire.");
  if (nom.length > 120) erreurs.push("Le nom ne doit pas dépasser 120 caractères.");

  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : null;

  let dateFin = null;
  if (payload.date_fin) {
    const d = new Date(payload.date_fin);
    if (Number.isNaN(d.getTime())) erreurs.push("date_fin invalide.");
    else dateFin = payload.date_fin.slice(0, 10);
  }

  const lot_id = payload.lot_id;

  const lignesBrutes = Array.isArray(payload.lignes) ? payload.lignes : [];
  const lignes = [];
  const alimentsVus = new Set();

  lignesBrutes.forEach((l, i) => {
    const alimentId = l?.aliment_id;
    const q = l?.quantite_kg_theorique_par_tete;
    if (!alimentId || typeof alimentId !== "string") {
      erreurs.push(`Ligne ${i + 1} : aliment manquant.`);
      return;
    }
    if (alimentsVus.has(alimentId)) {
      erreurs.push(`Ligne ${i + 1} : aliment en double.`);
      return;
    }
    if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) {
      erreurs.push(`Ligne ${i + 1} : quantité par tête invalide (> 0 attendu).`);
      return;
    }
    alimentsVus.add(alimentId);
    lignes.push({ aliment_id: alimentId, quantite_kg_theorique_par_tete: q });
  });

  if (lignes.length === 0) erreurs.push("Ajoute au moins un aliment avec sa quantité par tête.");

  if (erreurs.length) {
    const err = new Error(erreurs.join(" "));
    err.status = 400;
    throw err;
  }

  return { nom, description, date_fin: dateFin, lignes, lot_id };
}

export async function listAliments(fermeId) {
  return alimentApi.findBy("ferme_id", fermeId, {
    select: "id, nom, type, quantite_stock, cout_unitaire",
    orderBy: "nom",
    ascending: true,
  });
}

// ── Création plan puis lignes ────────────────────────────────
export async function createPlanAlimentaire(payload, fermeId) {
  const { nom, description, date_fin, lignes, lot_id } = validerNouveauPlan(payload);
  if (!fermeId) throw new Error("ferme_id est obligatoire");

  const planRow = {
    nom,
    description,
    date_debut: new Date().toISOString().slice(0, 10),
    date_fin,
    ferme_id: fermeId,
    ...(lot_id && { lot_id }), // bug corrigé : lot_id validé mais jamais persisté
  };

  // 1️⃣ Le plan
  const plan = await db.planAlimentaire.create(planRow);

  // 2️⃣ Les lignes (insert groupé)
  const lignesRows = lignes.map((l) => ({
    plan_id: plan.id,
    aliment_id: l.aliment_id,
    quantite_kg_theorique_par_tete: l.quantite_kg_theorique_par_tete,
  }));

  try {
    const lignesData = await db.lignePlanAlimentaire.create(lignesRows);
    return { ...plan, lignes: lignesData };
  } catch (errLignes) {
    // Pas de rollback (requêtes simples) : le plan reste créé sans lignes.
    const err = new Error(`Plan créé (id ${plan.id}) mais l'ajout des lignes a échoué : ${errLignes.message}`);
    err.status = 500;
    throw err;
  }
}

export async function listPlans(fermeId, { lotId, actif } = {}) {
  return planAlimentaireApi.listByFerme(fermeId, { lotId, actif });
}

// ── Plan + ses lignes (avec infos aliment) ───────────────────
export async function getPlanAlimentaireById(id) {
  const plan = await db.planAlimentaire.getOneBy({ id });
  if (!plan) {
    const err = new Error("Plan alimentaire introuvable.");
    err.status = 404;
    throw err;
  }

  const lignes = await db.lignePlanAlimentaire.findBy("plan_id", id, {
    select: "id, aliment_id, quantite_kg_theorique_par_tete, aliment(nom, type, quantite_stock, cout_unitaire)",
  });

  return { ...plan, lignes: lignes ?? [] };
}

function validerDistribution(payload = {}) {
  const erreurs = [];

  const planId = payload.plan_id;
  if (!planId || typeof planId !== "string") erreurs.push("plan_id est obligatoire.");

  const animalIds = Array.isArray(payload.animal_ids) ? payload.animal_ids : [];
  const propres = [...new Set(animalIds.filter((a) => typeof a === "string" && a))];
  if (propres.length === 0) erreurs.push("Sélectionne au moins un animal.");

  if (erreurs.length) {
    const err = new Error(erreurs.join(" "));
    err.status = 400;
    throw err;
  }
  return { planId, animalIds: propres };
}

const SEUIL_ALERTE_RATIO = 0.2; // fallback si seuil_alerte_stock est NULL

export async function enregistrerDistribution(payload) {
  const { planId, animalIds } = validerDistribution(payload);
  const nb = animalIds.length;

  // Lignes du plan + aliment embarqué
  const lignes = await db.lignePlanAlimentaire.findBy("plan_id", planId, {
    select: "aliment_id, quantite_kg_theorique_par_tete, aliment(nom, quantite_stock, cout_unitaire, ferme_id, seuil_alerte_stock)",
  });

  if (!lignes || lignes.length === 0) {
    const err = new Error("Ce plan ne contient aucune ligne à distribuer.");
    err.status = 400;
    throw err;
  }

  // Agrégation des besoins par aliment
  const besoinParAliment = new Map();
  for (const l of lignes) {
    const total = arrondi3(l.quantite_kg_theorique_par_tete * nb);
    const cur = besoinParAliment.get(l.aliment_id);
    if (cur) {
      cur.total = arrondi3(cur.total + total);
    } else {
      const stock = Number(l.aliment?.quantite_stock ?? 0);
      besoinParAliment.set(l.aliment_id, {
        total,
        stock,
        nom: l.aliment?.nom ?? l.aliment_id,
        cout: l.aliment?.cout_unitaire != null ? Number(l.aliment.cout_unitaire) : null,
        unite: l.aliment?.unite_mesure ?? "kg",
        fermeId: l.aliment?.ferme_id,
        seuil: l.aliment?.seuil_alerte_stock != null
          ? Number(l.aliment.seuil_alerte_stock)
          : arrondi3(stock * SEUIL_ALERTE_RATIO),
      });
    }
  }

  // Vérification de stock AVANT écriture (fail-fast)
  const insuffisants = [];
  for (const [, b] of besoinParAliment) {
    if (b.stock < b.total)
      insuffisants.push(`${b.nom} : besoin ${b.total} ${b.unite}, stock ${b.stock} ${b.unite}`);
  }
  if (insuffisants.length) {
    const err = new Error(`Stock insuffisant → ${insuffisants.join(" ; ")}`);
    err.status = 409;
    throw err;
  }

  const quantiteTotale = arrondi3([...besoinParAliment.values()].reduce((s, b) => s + b.total, 0));
  const today = new Date().toISOString().slice(0, 10);

  // 1️⃣ La distribution
  const distribution = await db.distributionAlimentaire.create({
    plan_id: planId,
    date_distribution: today,
    quantite_totale_distribuee: quantiteTotale,
  });

  // 2️⃣ Les consommations (N × M) — insert groupé
  const consommations = [];
  for (const animalId of animalIds) {
    for (const l of lignes) {
      consommations.push({
        distribution_id: distribution.id,
        animal_id: animalId,
        aliment_id: l.aliment_id,
        quantite: l.quantite_kg_theorique_par_tete,
        date_consommation: today,
        cout_unitaire: l.aliment?.cout_unitaire ?? null,
      });
    }
  }

  try {
    await db.consommationAlimentaire.create(consommations);
  } catch (errConso) {
    const err = new Error(`Distribution ${distribution.id} créée mais consommations en échec : ${errConso.message}`);
    err.status = 500;
    throw err;
  }

  // 3️⃣ Décrément du stock + alerte si sous le seuil
  const echecsStock = [];
  for (const [alimentId, b] of besoinParAliment) {
    const nouveauStock = arrondi3(b.stock - b.total);
    try {
      await db.aliment.update(alimentId, { quantite_stock: nouveauStock });
    } catch (error) {
      echecsStock.push(`${b.nom} : ${error.message}`);
      continue; // stock non décrémenté → pas d'alerte sur un état fictif
    }

    if (nouveauStock <= b.seuil) {
      try {
        await creerAlerte({
          fermeId: b.fermeId,
          type: "STOCK_ALIMENT_FAIBLE",
          priorite: nouveauStock <= 0 ? "ELEVE" : "MOYENNE",
          titre: `Stock faible : ${b.nom}`,
          message: `Distribution de ${b.total} ${b.unite} → reste ${nouveauStock} ${b.unite} (seuil : ${b.seuil} ${b.unite}).`,
          entiteName: "aliment",
          entiteId: alimentId,
        });
      } catch (e) {
        console.error(`Alerte stock non créée pour ${b.nom} :`, e.message);
      }
    }
  }
  if (echecsStock.length) {
    const err = new Error(`Distribution enregistrée mais mise à jour du stock partielle : ${echecsStock.join(" ; ")}`);
    err.status = 500;
    throw err;
  }

  return {
    distribution,
    nb_animaux: nb,
    quantite_totale_distribuee: quantiteTotale,
    details: [...besoinParAliment.entries()].map(([aliment_id, b]) => ({
      aliment_id,
      nom: b.nom,
      total_distribue: b.total,
      stock_restant: arrondi3(b.stock - b.total),
    })),
  };
}

export async function getConsommationsAlimentaire(filters) {
  const { lot_id, date_limit, ferme_id } = filters;
  const f = {};
  if (lot_id) f["animal.lot_id"] = lot_id;
  if (date_limit) f["animal.date_consommation"] = date_limit;

  let result = await consommationAlimentaireApi.getConsommationsAlimentaire(ferme_id, f);
  return result.map((c) => {
    const { animal, ...data } = c;
    return data;
  });
}