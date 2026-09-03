// server/routes/finance.js
import express from "express";
import { enregistrerAchatAliment ,getTransactionsFerme,enregistrerAchatMedicament} from "../services/FinanceService.js";
const router = express.Router();





// POST /api/finance/achat/aliment
// Body : { aliment_id, quantite, montant, description? }
// Effets : crée TransactionFinanciere (COUT) + LigneAchat, incrémente le stock.
router.post("/achat/aliment", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    req.body.ferme_id=req.user.ferme_id;
    const resultat = await enregistrerAchatAliment(req.body);
   
    res.status(201).json({ data: resultat });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.get("/transactions", async (req, res, next) => {
  try {
    const data = await getTransactionsFerme({
      ferme_id: req.user.ferme_id,
      type: req.query.type,
      date_limit: req.query.date_limit,
    });
    console.log(data)
    res.json({ data });
  } catch (e) { next(e); }
});
router.get("/transactions/:id", /* requireSession, requireOwnership, */ async (req, res) => { 

});
router.post("/achat/medicament", /* requireSession, requireOwnership, */ async (req, res) => {
  try {
    req.body.ferme_id=req.user.ferme_id
    const resultat = await enregistrerAchatMedicament(req.body);
    res.status(201).json({ data: resultat });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}); 
export default router;
