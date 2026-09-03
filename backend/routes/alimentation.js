// routes/alimentation.route.js
// Monté dans le serveur : app.use("/api/alimentation", alimentationRouter);
// ⚠️ Branche ici tes middlewares existants (session signée, ownership) —
//    je ne les invente pas, marque-les où indiqué.

import { Router } from "express";
import { createAliment, getAlimentById , 
  listAliments,
  createPlanAlimentaire,
  getPlanAlimentaireById,
  enregistrerDistribution,getConsommationsAlimentaire,listPlans} from "../services/AlimentationService.js";


const router = Router();

// GET /api/alimentation/planalimentaire/:id  → plan + lignes (avec aliment)
router.get("/plans/:id", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const plan = await getPlanAlimentaireById(req.params.id);
    res.json({ data: plan });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
 

router.get("/plans",/* requireSession, requireOwnership, */ async (req, res) => {
     try {
    const  ferme_id  = req.ferme_id;
    const { lot_id } = req.query;
    const plans = await listPlans(ferme_id, {
      lotId: lot_id,
    });
    res.json(plans);
  } catch (err) {
    console.error("GET /plans", err);
    res.status(500).json({ error: "Impossible de récupérer les plans alimentaires." });
  }
});
/* ─────────────────────── DISTRIBUTION ──────────────────────── */
 
// POST /api/alimentation/distribution
// Body : { plan_id, animal_ids: [uuid, ...] }
router.post("/distribution", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const resultat = await enregistrerDistribution(req.body);
    res.status(201).json({ data: resultat });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});


// POST /api/alimentation/planalimentaire
// Body : { nom, description?, date_fin?, lignes: [{ aliment_id, quantite_kg_theorique_par_tete }] }
router.post("/plan", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    console.log(req.body)
    const plan = await createPlanAlimentaire(req.body, req.ferme_id);
    res.status(201).json({ data: plan });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/alimentation/aliment  → liste des aliments de la ferme
router.get("/aliments", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const aliments = await listAliments(req.ferme_id);
    res.json({ data: aliments });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});


// POST /api/alimentation/aliment
// Body : { nom, type } — quantite_stock forcé à 0 et unite_mesure à "kg" par le service.
router.post("/aliment", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const payload={...req.body,ferme_id:req.ferme_id};

    const aliment = await createAliment(payload);

    res.status(201).json({ data: aliment });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/alimentation/aliment/:id
router.get("/aliments/:id", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    const aliment = await getAlimentById(req.params.id);
    res.json({ data: aliment });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});


// GET /api/alimentation/consommations/:id
router.get("/consommations/:id", /* requireSession, requireOwnership, */ async (req, res) => {

});

// GET /api/alimentation/consommations
router.get("/consommations", /* requireSession, requireOwnership, */ async (req, res) => {
const { date_limit, lot_id } = req.query;
console.log(req.query)

const filters = {};

if (!date_limit || isNaN(new Date(date_limit).getTime())) {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() - 30);
  filters.date_consommation = defaultDate;
} else {
  filters.date_consommation = new Date(date_limit);
}

if (lot_id) {
  filters.lot_id = lot_id;
}
filters.ferme_id=req.ferme_id
const data=await getConsommationsAlimentaire(filters);
console.log(data)

return res.json( {
  data:data
});

});

export default router;