// server/routes/reproduction.js
import { Router } from "express";
import * as reproductionService from "../services/ReproductionService.js";
import { verifierAppartenance } from "../middleware/appartenance.js";
const chargerAnimal=verifierAppartenance('animal',{param:"animalId"});
const chargerReproduction=verifierAppartenance('reproduction');
const chargerGestation = verifierAppartenance("gestation")


const router = Router();
const fermeDe = (req) => req.user.ferme_id;

// POST /reproductions/chaleur — déclare une chaleur (crée une repro EN_CHALEUR).
// L'animal ciblé est dans le body ; son appartenance est vérifiée dans le service.
router.post("/chaleur", async (req, res, next) => {
  try {
    const repro = await reproductionService.declarerChaleur(
      { animal_id: req.body.animal_id },
      fermeDe(req)
    );
    res.status(201).json(repro);
  } catch (e) {
    next(e);
  }
});

router.post("/saillie", async (req, res, next) => {
  try {
    res.json(await reproductionService.declarerSaillie(
      {
        belier_id:    req.body.belier_id,
        date_saillie: req.body.date_saillie,
        type:         req.body.type,
        brebis_id:    req.body.brebis_id ?? null,
        lot_id:       req.body.lot_id ?? null,
      },
      fermeDe(req)
    ));
  } catch (e) { next(e); }
});

// GET /reproductions/animal/:animalId — historique repro d'une femelle.
// (2 segments → ne collisionne pas avec /:id ; placé avant par prudence.)
router.get("/animal/:animalId",chargerAnimal, async (req, res, next) => {
  try {
    res.json(await reproductionService.getReproductionsDetail(req.animal.id, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});

// POST /reproductions/:id/non-saillie — EN_CHALEUR → NON_SAILLIE
router.post("/:id/non-saillie", chargerReproduction, async (req, res, next) => {
  try {
    res.json(await reproductionService.marquerNonSaillie(req.reproduction.id, fermeDe(req)));
  } catch (e) { 
    console.log(e)
    next(e);
   }
});

// POST /reproductions/:id/gestation — SAILLIE → GESTANTE (+ suivi de gestation)
router.post("/:id/gestation", chargerReproduction, async (req, res, next) => {
  try {
    res.status(201).json(
      await reproductionService.confirmerGestation(req.reproduction.id, fermeDe(req))
    );
  } catch (e) { next(e); }
});


// POST /reproductions/:id/non-gestante — SAILLIE → NON_GESTANTE
router.post("/:id/non-gestante", chargerReproduction, async (req, res, next) => {
  try {
    res.json(await reproductionService.marquerNonGestante(req.reproduction.id, fermeDe(req)));
  } catch (e) { next(e); }
});


// POST /reproductions/:id/cloture — GESTANTE → CLOTUREE
router.post("/:id/cloture", chargerReproduction, async (req, res, next) => {
  try {
    res.json(await reproductionService.cloturerReproduction(req.reproduction.id, fermeDe(req)));
  } catch (e) { next(e); }
});





router.post("/:id/naissance", chargerGestation, async (req, res, next) => {
  try {
    const result = await reproductionService.declarerNaissance(
      req.gestation.id,
      { date_naissance: req.body.date_naissance, agneaux: req.body.agneaux },
      fermeDe(req)
    );
    res.status(201).json(result);
  } catch (e) { next(e); }
});


// GET /reproductions/:id
router.get("/:id",chargerReproduction, async (req, res, next) => {
  try {
    res.json(await reproductionService.getReproductionDetailById(req.reproduction.id, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});



export default router;

