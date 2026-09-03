import express from "express";
import supabase from "../supabaseClient.js";
import {
  createMedicament,
  getMedicamentById,
  listMedicaments,
  
} from "../services/MedicamentService.js"
import { listCampagnes,createCampagne,getCampagneById,programmerVaccinations } from "../services/CompagneService.js";

import { verifierAppartenance } from "../middleware/appartenance.js";
import * as vaccinationService from "../services/VaccinationService.js";
 
const chargerAnimal      = verifierAppartenance("animal", { param: "animalId" });
const chargerVaccination = verifierAppartenance("vaccination");



 const router = express.Router();
const fermeDe = (req) => req.user.ferme_id;



// POST /api/sante/programme-vaccination
// Crée ("Programmer vaccination") un nouveau programme.
// POST /api/sante/programme-vaccination
// Crée ("Programmer vaccination") un nouveau programme (déclencheur par âge).
router.post("/programme-vaccination", async (req, res) => {
  try {
    const {
      medicament_id,
      nom,
      age_min_jours,
      age_max_jours,
      sexe,
    } = req.body;

    if ( !medicament_id || !nom || age_min_jours == null || age_min_jours < 0) {
      return res.status(400).json({
        error: "ferme_id, medicament_id, nom et age_min_jours sont requis.",
      });
    }

    if (age_max_jours != null && Number(age_max_jours) < Number(age_min_jours)) {
      return res.status(400).json({ error: "age_max_jours doit être >= age_min_jours." });
    }

    const programme = await vaccinationService.creerProgrammeVaccination({
      fermeId: req.ferme_id,
      medicamentId: medicament_id,
      creePar: req.user?.id ?? null,   // ← vient du middleware d'auth, pas du body
      nom,
      ageMinJours: age_min_jours,
      ageMaxJours: age_max_jours,
      sexe,
    });

    res.status(201).json({ data: programme });
  } catch (err) {
    console.error("[POST /api/sante/programme-vaccination]", err);
    res.status(500).json({ error: err.message || "Erreur lors de la création du programme." });
  }
});





router.get("/programme-vaccination", async (req, res) => {
  try {
    const { medicament_id } = req.query;
    if (!medicament_id) {
      return res.status(400).json({ error: "medicament_id est requis en query param." });
    }
 
    const programmes = await vaccinationService.listerProgrammesParMedicament(medicament_id);
    res.json({ data: programmes });
  } catch (err) {
    console.error("[GET /api/sante/programme-vaccination]", err);
    res.status(500).json({ error: err.message || "Erreur lors de la récupération des programmes." });
  }
});
 
// GET /api/sante/programme-vaccination/:id
// Détail complet pour le panneau rapide.
router.get("/programme-vaccination/:id", async (req, res) => {
  try {
    const programme = await vaccinationService.getProgrammeVaccinationById(req.params.id);
    res.json({ data: programme });
  } catch (err) {
    console.error("[GET /api/sante/programme-vaccination/:id]", err);
    res.status(404).json({ error: "Programme introuvable." });
  }
});
 
// PATCH /api/sante/programme-vaccination/:id/desactiver
router.patch("/programme-vaccination/:id/desactiver", async (req, res) => {
  try {
    const programme = await vaccinationService.desactiverProgrammeVaccination(req.params.id);
    res.json({ data: programme });
  } catch (err) {
    console.error("[PATCH /api/sante/programme-vaccination/:id/desactiver]", err);
    res.status(500).json({ error: err.message || "Erreur lors de la désactivation." });
  }
});





 
router.get("/medicaments", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const data = await listMedicaments(req.ferme_id);
    res.json({ data });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// POST /api/sante/medicament  → stock initial 0
router.post("/medicament", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const medicament = await createMedicament(req.body, req.ferme_id);
    res.status(201).json({ data: medicament });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/sante/medicament/:id
router.get("/medicament/:id", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const medicament = await getMedicamentById(req.params.id);
    res.json({ data: medicament });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});


// GET /api/sante/compagnes  (orthographe conservée telle que demandée)
router.get("/compagnes", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const data = await listCampagnes(req.ferme_id);
    res.json({ data });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
 

// POST /api/sante/compagne  → crée une campagne (statut PROGRAMMEE, créateur = session)
router.post("/compagne", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const campagne = await createCampagne(req.body, {
      fermeId: req.ferme_id,
      utilisateurId: req.user_id, // utilisateur_id = créateur de la campagne
    });
    res.status(201).json({ data: campagne });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/sante/compagne/:id  → campagne + vaccin + vaccinations
router.get("/compagne/:id", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    res.json({ data: await getCampagneById(req.params.id) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});



 
// POST /api/sante/compagne/:id/vaccinations
// Body :
//   { animal_ids: [...] }            → sélection explicite
//   { lot_id, tout_le_lot: true }    → tout le lot (réseau minimal : seul lot_id est envoyé)
//   { toute_la_ferme: true }         → tous les animaux de la ferme
router.post("/compagne/:id/vaccinations", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const resultat = await programmerVaccinations(req.params.id, req.body, req.ferme_id);
    res.status(201).json({ data: resultat });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

 
// GET /api/sante/vaccinations/animal/:animalId — toutes les vaccinations d'un animal
router.get("/vaccinations/animal/:animalId", chargerAnimal, async (req, res, next) => {
  try {
    res.json(await vaccinationService.getVaccinationsByAnimal(req.animal.id, fermeDe(req)));
  } catch (e) { next(e); }
});


// PATCH /api/sante/vaccinations/:id/effectuee — marquer comme effectuée
// veterinaire_id / operateur_id dérivés du serveur (req.user), pas du client.
router.patch("/vaccinations/:id/effectuee", chargerVaccination, async (req, res, next) => {
  try {
    res.json(await vaccinationService.marquerVaccinationEffectuee(
      req.vaccination.id,
      {
        date_effectuee: req.body.date_effectuee,
        // Selon le rôle de l'utilisateur courant, on renseigne l'un ou l'autre.
        veterinaire_id: req.user.role === "VETERINAIRE" ? req.user.id : (req.body.veterinaire_id ?? null),
        operateur_id:   req.user.role !== "VETERINAIRE" ? req.user.id : null,
      },
      fermeDe(req)
    ));
  } catch (e) { next(e); }
});


// GET /api/sante/vaccinations/:id — détail enrichi (en DERNIER)
router.get("/vaccinations/:id", chargerVaccination, async (req, res, next) => {
  try {
    res.json(await vaccinationService.getVaccinationById(req.vaccination.id, fermeDe(req)));
  } catch (e) { next(e); }
});

export default router;