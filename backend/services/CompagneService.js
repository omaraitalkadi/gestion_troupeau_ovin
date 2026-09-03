// services/campagneVaccination.service.js
// Liste des campagnes de vaccination.
//
// ⚠️ HYPOTHÈSES DE SCHÉMA (diagramme CampagneDeVaccination) :
//   campagne_vaccination(id, nom, description, date_debut_prevue, date_fin_prevue,
//                        date_cloture_reelle, statut, cout, ferme_id?)
//   Le tri par nom évite un échec si la colonne date n'existe pas telle quelle ;
//   remplace par .order("date_debut_prevue", { ascending: false }) si tu préfères
//   l'ordre chronologique.

import supabase from "../supabaseClient.js";
import {
  getMedicamentById
  
} from "../services/MedicamentService.js"
export async function listCampagnes(fermeId) {
  let q = supabase
    .from("campagne_vaccination")
    .select("*")
    .order("nom", { ascending: true });

  // Si campagne_vaccination n'a pas de ferme_id direct (rattachée via Utilisateur),
  // retire ce filtre et laisse la RLS scoper.
  if (fermeId) q = q.eq("ferme_id", fermeId);

  const { data, error } = await q;
  if (error) {
    const e = new Error(`Lecture des campagnes impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
  return data ?? [];
}

// ─── Création (statut PROGRAMMEE) ────────────────────────────

// ─── Création (statut PROGRAMMEE) + programmation des vaccinations ──
// Opération unique : insère la campagne PUIS crée les vaccinations pour le
// périmètre choisi (animal_ids | lot_id+tout_le_lot | toute_la_ferme).
// Écritures séquentielles non atomiques : si la programmation échoue, la
// campagne est supprimée pour ne pas laisser de campagne vide (voir plus bas).
export async function createCampagne(payload, { fermeId, utilisateurId } = {}) {
  const erreurs = [];
 
  const nom = typeof payload.nom === "string" ? payload.nom.trim() : "";
  if (!nom) erreurs.push("Le nom de la campagne est obligatoire.");
 
  const medicamentId = payload.medicament_id;
  if (!medicamentId || typeof medicamentId !== "string")
    erreurs.push("medicament_id (vaccin) est obligatoire.");
 
  // Périmètre d'animaux : validé AVANT toute écriture (fail-fast)
  const aDesAnimaux = Array.isArray(payload.animal_ids) && payload.animal_ids.length > 0;
  const cibleValide =
    payload.toute_la_ferme === true ||
    (payload.tout_le_lot === true && !!payload.lot_id) ||
    aDesAnimaux;
  if (!cibleValide)
    erreurs.push("Périmètre d'animaux requis : animal_ids, lot_id + tout_le_lot, ou toute_la_ferme.");
 
  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : null;
 
  const toDate = (d, label) => {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) { erreurs.push(`${label} invalide.`); return null; }
    return String(d).slice(0, 10);
  };
  const dDebut = toDate(payload.date_debut_prevue, "date_debut_prevue");
  const dFin = toDate(payload.date_fin_prevue, "date_fin_prevue");
  const dCloture = toDate(payload.date_cloture_reelle, "date_cloture_reelle");
 
  if (erreurs.length) { const e = new Error(erreurs.join(" ")); e.status = 400; throw e; }
 
  // Règle métier : le médicament doit être un vaccin (vérifié côté serveur)
  const med = await getMedicamentById(medicamentId); // 404 propre si absent
  if (med.categorie !== "VACCIN") {
    const e = new Error("Le médicament sélectionné n'est pas un vaccin (catégorie VACCIN requise).");
    e.status = 400;
    throw e;
  }
 
  const row = {
    nom,
    description,
    date_debut_prevue: dDebut,
    date_fin_prevue: dFin,
    date_cloture_reelle: dCloture,
    statut: "PROGRAMMEE",
    medicament_id: medicamentId,
  };
  if (utilisateurId) row.utilisateur_id = utilisateurId; // créateur (session)
  if (fermeId) row.ferme_id = fermeId;
 
  // 1️⃣ La campagne
  const { data: campagne, error } = await supabase
    .from("campagne_vaccination")
    .insert(row)
    .select()
    .single();
  if (error) {
    const e = new Error(`Création de la campagne impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
 
  // 2️⃣ Les vaccinations (statut PROGRAMMEE) pour le périmètre choisi
  try {
    const prog = await programmerVaccinations(
      campagne.id,
      {
        animal_ids: payload.animal_ids,
        lot_id: payload.lot_id,
        tout_le_lot: payload.tout_le_lot,
        toute_la_ferme: payload.toute_la_ferme,
      },
      fermeId
    );
    return { ...campagne, ...prog };
  } catch (err) {
    // Pas de campagne vide : on annule l'insertion précédente.
    // (Compensation best-effort — une RPC Postgres rendrait le tout atomique.)
    const { error: errDel } = await supabase
      .from("campagne_vaccination")
      .delete()
      .eq("id", campagne.id);
    if (errDel) {
      err.message += ` | ⚠️ La campagne ${campagne.id} n'a pas pu être supprimée : ${errDel.message}`;
    }
    if (!err.status) err.status = 500;
    throw err;
  }
}
 
 
// ─── Lecture détaillée (campagne + vaccin + vaccinations) ────
export async function getCampagneById(id) {
  const { data: campagne, error } = await supabase
    .from("campagne_vaccination")
    .select("*, medicament:medicament_id(id, nom_commercial, categorie, unite_mesure, quantite_en_stock)")
    .eq("id", id)
    .single();
 
  if (error) {
    if (error.code === "PGRST116") { const e = new Error("Campagne introuvable."); e.status = 404; throw e; }
    const e = new Error(`Lecture de la campagne impossible : ${error.message}`);
    e.status = 500;
    throw e;
  }
 
  // Vaccinations liées, avec l'animal via son dossier médical.
  // Embed non bloquant : si les noms de FK diffèrent, on renvoie la campagne
  // sans le détail plutôt que d'échouer toute la fiche.
  const { data: vaccinations, error: errV } = await supabase
    .from("vaccination")
    .select("id, statut, date_prevue, effectue, dossier_medical:dossier_medical_id(animaux:animal_id(id, numero_rfid, numero_legal))")
    .eq("campagne_id", id);
 
  if (errV) {
    return { ...campagne, vaccinations: [], vaccinations_error: errV.message };
  }
  return { ...campagne, vaccinations: vaccinations ?? [] };
}

 
export async function programmerVaccinations(campagneId, payload = {}, fermeId) {
  const campagne = await getCampagneLean(campagneId);
 
  const touteLaFerme = payload.toute_la_ferme === true;
  const toutLeLot = payload.tout_le_lot === true;
  const lotId = payload.lot_id;
  let animalIds = Array.isArray(payload.animal_ids)
    ? [...new Set(payload.animal_ids.filter((x) => typeof x === "string" && x))]
    : [];
 
  // 1. Resolution du perimetre d'animaux
  if (touteLaFerme) {
    const { data, error } = await supabase.from("animaux").select("id").eq("ferme_id", fermeId);
    if (error) { const e = new Error(`Lecture des animaux de la ferme : ${error.message}`); e.status = 500; throw e; }
    animalIds = (data ?? []).map((a) => a.id);
  } else if (toutLeLot || (lotId && animalIds.length === 0)) {
    if (!lotId) { const e = new Error("lot_id requis pour cibler tout le lot."); e.status = 400; throw e; }
    const { data, error } = await supabase.from("animaux").select("id").eq("lot_id", lotId);
    if (error) { const e = new Error(`Lecture des animaux du lot : ${error.message}`); e.status = 500; throw e; }
    animalIds = (data ?? []).map((a) => a.id);
  }
 
  if (animalIds.length === 0) {
    const e = new Error("Aucun animal cible.");
    e.status = 400;
    throw e;
  }
 
  // 2. Dossiers medicaux (creation a la volee si manquant)
  const { data: dossiers, error: errD } = await supabase
    .from("dossier_medical")
    .select("id, animal_id")
    .in("animal_id", animalIds);
  if (errD) { const e = new Error(`Lecture des dossiers medicaux : ${errD.message}`); e.status = 500; throw e; }
 
  const dossierParAnimal = new Map((dossiers ?? []).map((d) => [d.animal_id, d.id]));
  const sansDossier = animalIds.filter((id) => !dossierParAnimal.has(id));
  if (sansDossier.length) {
    const { data: crees, error: errC } = await supabase
      .from("dossier_medical")
      .insert(sansDossier.map((animal_id) => ({ animal_id })))
      .select("id, animal_id");
    if (errC) { const e = new Error(`Creation des dossiers medicaux : ${errC.message}`); e.status = 500; throw e; }
    for (const d of crees ?? []) dossierParAnimal.set(d.animal_id, d.id);
  }
  const dossierIds = [...dossierParAnimal.values()];
 
  // 3. Anti-doublon : ignorer les dossiers deja vaccines dans cette campagne
  const { data: existantes, error: errE } = await supabase
    .from("vaccination")
    .select("dossier_medical_id")
    .eq("campagne_id", campagneId)
    .in("dossier_medical_id", dossierIds);
  if (errE) { const e = new Error(`Verification des vaccinations existantes : ${errE.message}`); e.status = 500; throw e; }
  const deja = new Set((existantes ?? []).map((v) => v.dossier_medical_id));
 
  const datePrevue = campagne.date_debut_prevue ?? new Date().toISOString().slice(0, 10);
  const rows = dossierIds
    .filter((did) => !deja.has(did))
    .map((did) => ({
      dossier_medical_id: did,
      campagne_id: campagneId,
      medicament_id: campagne.medicament_id,
      date_prevue: datePrevue,
      statut: "PROGRAMMEE",
      effectue: false,
    }));
 
  // 4. Insertion groupee
  if (rows.length) {
    const { error: errI } = await supabase.from("vaccination").insert(rows);
    if (errI) { const e = new Error(`Creation des vaccinations : ${errI.message}`); e.status = 500; throw e; }
  }
 
  return {
    nb_animaux_cibles: animalIds.length,
    nb_vaccinations_creees: rows.length,
    nb_ignorees_existantes: dossierIds.length - rows.length,
  };
}
 