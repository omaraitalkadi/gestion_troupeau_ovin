// server/routes/traitements.js
import express from "express";
import * as TraitementService from "../services/TraitementService.js";

const router = express.Router();

// GET /api/traitements
router.get("/", async (req, res, next) => {
  try {
    const { animalId, lotId, type, dateFrom, dateTo, page, limit } = req.query;
    const result = await TraitementService.getTraitements({
      exploitationId: req.user.exploitation_id,
      animalId, lotId, type, dateFrom, dateTo,
      page: Number(page ?? 1), limit: Number(limit ?? 50),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/traitements/upcoming
router.get("/upcoming", async (req, res, next) => {
  try {
    const data = await TraitementService.getUpcoming(req.user.exploitation_id, Number(req.query.days ?? 7));
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/traitements/:id
router.get("/:id", async (req, res, next) => {
  try {
    const data = await TraitementService.getTraitementById(req.params.id, req.user.exploitation_id);
    if (!data) return res.status(404).json({ error: "Traitement introuvable" });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/traitements
router.post("/", async (req, res, next) => {
  try {
    const data = await TraitementService.createTraitement(req.body, req.user.exploitation_id);
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PUT /api/traitements/:id
router.put("/:id", async (req, res, next) => {
  try {
    const data = await TraitementService.updateTraitement(req.params.id, req.body, req.user.exploitation_id);
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/traitements/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await TraitementService.deleteTraitement(req.params.id, req.user.exploitation_id);
    res.json({ message: "Traitement supprimé" });
  } catch (err) { next(err); }
});

export default router;
