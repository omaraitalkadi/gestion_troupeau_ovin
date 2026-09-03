// server/routes/animals.js
import express from "express";
import {  journalVieApi,fermeApi,utilisateurApi } from "../tables/index.js";
import { data } from "react-router";
import { verifierAppartenance } from "../middleware/appartenance.js";
import * as animalService from '../services/animal.js'

const router = express.Router();

export const chargerAnimal = verifierAppartenance("animal");

const fermeDe = (req) => req.user.ferme_id;

// All columns that are safe to write to the animaux table
const WRITABLE_FIELDS = [
  "numero_rfid",
  "numero_legal",
  "nom",
  "race",
  "sexe",
  "date_naissance",
  "date_arrivee",
  "etat",     // SAIN / MALADE / BLESSE / MORT
  "status",   // ACTIF / VENDU / MORT / TRANSFERE
  "condition_corporelle", // NORMALE / MAIGRE / OBESE / ...
  "poids"
   // add any other real DB columns here
];

function pickWritable(body) {
  return Object.fromEntries(
    WRITABLE_FIELDS
      .filter((key) => key in body)   // only include keys the caller sent
      .map((key) => [key, body[key]])
  );
}

// Translate ?page=&limit=&orderBy=&order=&select=&<col>=<val> query params
// into the option shape expected by animalApi.list().
function buildListOptions(query = {}) {
  const { page, limit, orderBy, order, select, ...rest } = query;

  const lim = limit != null ? Number(limit) : undefined;
  const pg = page != null ? Number(page) : 1;
  const offset = lim ? (pg - 1) * lim : undefined;

  // Any leftover query params become equality filters
  // (e.g. ?status=ACTIF&sexe=FEMELLE&ferme_id=...).
  const filters = {};
  for (const [k, v] of Object.entries(rest)) filters[k] = v;

  return {
    select: select || "*",
    limit: lim,
    offset,
    orderBy: orderBy || undefined,
    ascending: order ? order.toLowerCase() !== "desc" : true,
    filters: Object.keys(filters).length ? filters : undefined,
  };
}



// ─── Validation minimale ──────────────────────────────────
function validateAnimal(body) {
  const errors = [];


  const validSexe   = ["MALE", "FEMELLE"];
  const validCC     = ["MAIGRE", "NORMALE", "GRASSE"];
  const validEtat   = ["SAIN", "MALADE", "SOUS_TRAITEMENT", "ISOLE"];
  const validStatus = ["ACTIF", "VENDU", "MORT", "TRANSFERE","EN_QUARANTAINE","ABATTU","PERDU"];

    if (!body.numero_rfid?.trim() && !body.numero_legal?.trim())
      errors.push("Au moins un identifiant est requis : numero_rfid ou numero_legal.");
    if (!body.sexe)
      errors.push("sexe est obligatoire (MALE | FEMELLE)");
    if (!body.race?.trim())
      errors.push("race est obligatoire");
  

  // enum checks — only when field is present
  if (body.sexe && !validSexe.includes(body.sexe))
    errors.push("sexe doit être MALE ou FEMELLE");

  if (body.etat && !validEtat.includes(body.etat))
    errors.push("etat invalide");

  if (body.condition_corporelle && !validCC.includes(body.condition_corporelle))
    errors.push("condition_corporelle doit être MAIGRE, NORMALE ou GRASSE");

  // poids — required on create, validated when present
 if (body.poids === undefined && (typeof body.poids !== "number" || body.poids <= 0)) 
    errors.push("poids doit être un nombre positif");
  

  return errors;
}
function validateAnimalPatch(body) {
  const errors = [];

  const validSexe   = ["MALE", "FEMELLE"];
  const validCC     = ["MAIGRE", "NORMALE", "GRASSE"];
  const validEtat   = ["SAIN", "MALADE", "SOUS_TRAITEMENT", "ISOLE"];
  const validStatus = ["ACTIF", "VENDU", "MORT", "TRANSFERE","EN_QUARANTAINE","ABATTU","PERDU"];

  // ── Nothing to update ──────────────────────────────────────────────────────
  if (!body || Object.keys(body).length === 0)
    errors.push("Le corps de la requête est vide — rien à mettre à jour.");

  // ── Identifier format (if provided, must not be blank) ────────────────────
  if ("numero_rfid" in body && !body.numero_rfid?.trim())
    errors.push("numero_rfid ne peut pas être une chaîne vide.");
  if ("numero_legal" in body && !body.numero_legal?.trim())
    errors.push("numero_legal ne peut pas être une chaîne vide.");

  // ── Enum checks ───────────────────────────────────────────────────────────
  if (body.sexe && !validSexe.includes(body.sexe))
    errors.push("sexe doit être MALE ou FEMELLE.");
  if (body.etat && !validEtat.includes(body.etat))
    errors.push(`etat invalide. Valeurs acceptées : ${validEtat.join(", ")}.`);
  if (body.condition_corporelle && !validCC.includes(body.condition_corporelle))
    errors.push("condition_corporelle doit être MAIGRE, NORMALE ou GRASSE.");
  if (body.etat_animal && !validEtatA.includes(body.etat_animal))
    errors.push(`etat_animal invalide. Valeurs acceptées : ${validEtatA.join(", ")}.`);
  if (body.status_animal && !validStatus.includes(body.status_animal))
    errors.push(`status_animal invalide. Valeurs acceptées : ${validStatus.join(", ")}.`);

  // ── poids — only validated when explicitly sent ───────────────────────────
  if ("poids" in body && (typeof body.poids !== "number" || body.poids <= 0))
    errors.push("poids doit être un nombre positif.");

  // ── race — only validated when explicitly sent ────────────────────────────
  if ("race" in body && !body.race?.trim())
    errors.push("race ne peut pas être une chaîne vide.");

  return errors;
}






const today = () => new Date().toISOString().slice(0, 10);








router.get("/", async (req, res, next) => {
  try {
    const { etat, race, sexe, lot_id, condition_corporelle, page, limit } = req.query;
    const result = await animalService.getAnimaux({
      ferme_id: fermeDe(req),
      etat, race, sexe, lot_id, condition_corporelle,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /animaux/count — ⚠️ doit rester AVANT /:id (sinon "count" match :id)
router.get("/count", async (req, res, next) => {
  try {
    const filters = { ferme_id: fermeDe(req) };
    for (const col of ["etat", "race", "sexe", "lot_id", "condition_corporelle"]) {
      if (req.query[col]) filters[col] = req.query[col];
    }
    res.json({ count: await animalService.count(filters) });
  } catch (e) {
    next(e);
  }
});


router.post("/", async (req, res, next) => {
  try {
    const created = await animalService.createAnimal(req.body, fermeDe(req));
    // createAnimal — après le create réussi (created.id disponible)
    await animalService.logEvent(created.id, "CREATION",
     `Animal enregistré  ${created.numeroRfid}`);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// ── RESSOURCE (chargerAnimal garde l'appartenance + pose req.animal) ──

// GET /animaux/:id
router.get("/:id", chargerAnimal, (req, res) => {
  res.json(req.animal); // déjà chargé + vérifié par le middleware
});

// PATCH /animaux/:id — mise à jour partielle
router.patch("/:id", chargerAnimal, async (req, res, next) => {
  try {
    res.json(await animalService.updateAnimal(req.animal.id, req.body, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});

// PATCH /animaux/:id/lot — changement de lot
router.patch("/:id/lot", chargerAnimal, async (req, res, next) => {
  try {
    const result = await animalService.changerLot(
      req.animal.id,
      { lot_id: req.body.lot_id, motif: req.body.motif },
      fermeDe(req)
    );
    console.log(result)
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// PATCH /animaux/:id/vente — vente unitaire
router.patch("/:id/vente", chargerAnimal, async (req, res, next) => {
  try {
    const result = await animalService.declarerVente(
      req.animal.id,                          // id vérifié, pas req.params
      { date_sortie: req.body.date_sortie, montant: req.body.montant },
      fermeDe(req)
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// PATCH /animaux/:id/deces — déclaration de décès
router.patch("/:id/deces", chargerAnimal, async (req, res, next) => {
  try {
    res.json(await animalService.declarerDeces(req.animal.id, req.body, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});



// GET /animaux/:id/descendants
router.get("/:id/descendants", chargerAnimal, async (req, res, next) => {
  try {
    res.json(await animalService.getDescendants(req.animal.id, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});

// GET /animaux/:id/ascendants
router.get("/:id/ascendants", chargerAnimal, async (req, res, next) => {
  try {
    res.json(await animalService.getAscendants(req.animal.id, fermeDe(req)));
  } catch (e) {
    next(e);
  }
});

export default router;