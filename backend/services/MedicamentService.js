// services/medicament.service.js
// Médicaments : création (stock initial 0), lecture, liste.
//
// ⚠️ HYPOTHÈSES DE SCHÉMA (base sur le diagramme de classes) :
//   medicament(id, nom_commercial, molecule_active, categorie, voie_administration,
//              numero_lot, date_peremption, delai_attente_viande_jours,
//              delai_attente_lait_jours, quantite_en_stock, unite_mesure,
//              seuil_alerte_stock, prix_unitaire, ferme_id)
//   Le formulaire ne saisit qu'un sous-ensemble ; le reste reste NULL.

import supabase from "../supabaseClient.js";


const CATEGORIES = new Set([
  "VACCIN", "ANTIBIOTIQUE", "ANTIPARASITAIRE", "ANTI_INFLAMMATOIRE", "VITAMINE_COMPLEMENT",
]);
const VOIES = new Set(["INTRAMUSCULAIRE", "SOUS_CUTANEE", "ORALE", "TOPIQUE"]);

export function validerNouveauMedicament(payload = {}) {
  const erreurs = [];

  const nom = typeof payload.nom_commercial === "string" ? payload.nom_commercial.trim() : "";
  if (!nom) erreurs.push("Le nom commercial est obligatoire.");
  if (nom.length > 150) erreurs.push("Nom commercial trop long (150 caractères max).");

  if (!CATEGORIES.has(payload.categorie))
    erreurs.push(`Catégorie invalide. Attendu : ${[...CATEGORIES].join(", ")}.`);
  if (!VOIES.has(payload.voie_administration))
    erreurs.push(`Voie d'administration invalide. Attendu : ${[...VOIES].join(", ")}.`);

  const viande = payload.delai_attente_viande_jours;
  if (!Number.isInteger(viande) || viande < 0)
    erreurs.push("delai_attente_viande_jours : entier ≥ 0 attendu.");

  const lait = payload.delai_attente_lait_jours;
  if (!Number.isInteger(lait) || lait < 0)
    erreurs.push("delai_attente_lait_jours : entier ≥ 0 attendu.");

  const seuil = payload.seuil_alerte_stock;
  if (typeof seuil !== "number" || !Number.isFinite(seuil) || seuil < 0)
    erreurs.push("seuil_alerte_stock : nombre ≥ 0 attendu.");

  const unite =
    typeof payload.unite_mesure === "string" && payload.unite_mesure.trim()
      ? payload.unite_mesure.trim()
      : null; // optionnel

  if (erreurs.length) {
    const e = new Error(erreurs.join(" "));
    e.status = 400;
    throw e;
  }

  return {
    nom_commercial: nom,
    categorie: payload.categorie,
    voie_administration: payload.voie_administration,
    delai_attente_viande_jours: viande,
    delai_attente_lait_jours: lait,
    seuil_alerte_stock: seuil,
    unite_mesure: unite,
    quantite_en_stock: 0, // règle métier : stock toujours 0 à la création
  };
}

export async function createMedicament(payload, fermeId) {
  const row = validerNouveauMedicament(payload);
  if (fermeId) row.ferme_id = fermeId; // injection serveur (multi-tenant)

  const { data, error } = await supabase.from("medicament").insert(row).select().single();
  if (error) {
    const e = new Error(`Création du médicament impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
  return data;
}

export async function getMedicamentById(id) {
  const { data, error } = await supabase.from("medicament").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") {
      const e = new Error("Médicament introuvable.");
      e.status = 404;
      throw e;
    }
    const e = new Error(`Lecture du médicament impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
  return data;
}

export async function listMedicaments(fermeId) {
  let q = supabase
    .from("medicament")
    .select(
      "id, nom_commercial, categorie, voie_administration, quantite_en_stock, unite_mesure, prix_unitaire, seuil_alerte_stock"
    )
    .order("nom_commercial", { ascending: true });

  if (fermeId) q = q.eq("ferme_id", fermeId);

  const { data, error } = await q;
  if (error) {
    const e = new Error(`Lecture des médicaments impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
  return data ?? [];
}