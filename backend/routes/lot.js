// server/routes/lots.js — routes minces : délèguent au service, bornées à la ferme.
import express from "express";
import * as lotService from "../services/lot.js";

const router = express.Router();
const fermeDe = (req) => req.user.ferme_id;

// GET /api/lots — tous les lots de la ferme de l'utilisateur.
// (ferme_id vient de req.user, PAS de req.query : un client ne choisit pas sa ferme.)
router.get("/", async (req, res, next) => {
  try {
    res.json(await lotService.getLots(fermeDe(req)));
  } catch (err) { next(err); }
});

// GET /api/lots/:id — lot + { animalCount, races }
router.get("/:id", async (req, res, next) => {
  try {
    res.json(await lotService.getLotById(req.params.id, fermeDe(req)));
  } catch (err) { next(err); }
});

// GET /api/lots/:id/animals — animaux du lot (paginés, bornés à la ferme)
router.get("/:id/animals", async (req, res, next) => {
  try {
    res.json(await lotService.getAnimalsOfLot(req.params.id, fermeDe(req), req.query));
  } catch (err) { next(err); }
});

export default router;