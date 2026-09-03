// server/routes/production.js
import express from "express";
import * as S from "../services/ProductionService.js";
const router = express.Router();

router.get("/",       async (req, res, next) => { try { const { animalId, lotId, type, dateFrom, dateTo, page, limit } = req.query; res.json(await S.getProductions({ exploitationId: req.user.exploitation_id, animalId, lotId, type, dateFrom, dateTo, page: Number(page??1), limit: Number(limit??50) })); } catch(e){next(e);} });
router.get("/stats",  async (req, res, next) => { try { res.json(await S.getStats(req.user.exploitation_id)); } catch(e){next(e);} });
router.post("/",      async (req, res, next) => { try { res.status(201).json(await S.createProduction(req.body, req.user.exploitation_id)); } catch(e){next(e);} });
router.put("/:id",    async (req, res, next) => { try { res.json(await S.updateProduction(req.params.id, req.body, req.user.exploitation_id)); } catch(e){next(e);} });
router.delete("/:id", async (req, res, next) => { try { await S.deleteProduction(req.params.id, req.user.exploitation_id); res.json({ message: "Supprimé" }); } catch(e){next(e);} });

export default router;
