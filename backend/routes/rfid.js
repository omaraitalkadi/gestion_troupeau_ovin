// server/routes/rfid.js
import express from "express";
import * as S from "../services/RFIDService.js";
const router = express.Router();

// GET /api/rfid/search?q=FR64218
router.get("/search", async (req, res, next) => {
  try {
    const data = await S.searchByRFID(req.query.q, req.user.exploitation_id);
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/rfid/scan
router.post("/scan", async (req, res, next) => {
  try {
    const { animalId } = req.body;
    if (!animalId) return res.status(400).json({ error: "animalId requis" });
    await S.logScan({ animalId, exploitationId: req.user.exploitation_id, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Scan enregistré" });
  } catch (err) { next(err); }
});

export default router;
