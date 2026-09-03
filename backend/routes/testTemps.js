// server/routes/testTemps.js
// ⚠️ OUTIL DE TEST UNIQUEMENT — décale les dates des animaux pour simuler
//    le passage du temps (tester les programmes de vaccination par âge, les scanners…).
//    À retirer / protéger avant la mise en production.

import express from "express";
import { supabase } from "../supabaseClient.js";
import {scannerVaccinationsProgrammees} from '../jobs/alerte.js'

const router = express.Router();

// POST /api/test/decaler-temps   body: { jours: number }
// jours > 0  → vieillit les animaux (recule date_naissance dans le passé)
// jours < 0  → rajeunit les animaux (avance date_naissance vers le présent)
//
// "Vieillir de N jours" = soustraire N jours à date_naissance (l'animal devient plus vieux).
router.post("/decaler-temps", async (req, res, next) => {
  try {
    const { jours } = req.body;
    if (!Number.isFinite(jours) || jours === 0) {
      return res.status(400).json({ error: "jours (entier non nul) requis." });
    }

    const fermeId = req.ferme_id;
    if (!fermeId) return res.status(400).json({ error: "Ferme introuvable pour cet utilisateur." });

    // Récupérer les dates actuelles des animaux de la ferme
    const { data: animaux, error: errSel } = await supabase
      .from("animal")
      .select("id, date_naissance, date_arrivee")
      .eq("ferme_id", fermeId);

    if (errSel) throw errSel;
    if (!animaux || animaux.length === 0) {
      return res.json({ data: { modifies: 0, jours } });
    }

    const DAY_MS = 864e5;
    const decale = (dateStr) => {
      if (!dateStr) return null;
      // vieillir de `jours` = reculer la date de naissance de `jours` jours
      const d = new Date(new Date(dateStr).getTime() - jours * DAY_MS);
      return d.toISOString().slice(0, 10);
    };

    // Mettre à jour chaque animal (date_naissance + date_arrivee suivent le même décalage)
    let modifies = 0;
    const echecs = [];
    for (const a of animaux) {
      const patch = {};
      if (a.date_naissance) patch.date_naissance = decale(a.date_naissance);
      if (a.date_arrivee)   patch.date_arrivee   = decale(a.date_arrivee);
      if (Object.keys(patch).length === 0) continue;

      const { error: errUpd } = await supabase.from("animal").update(patch).eq("id", a.id);
      if (errUpd) echecs.push({ id: a.id, erreur: errUpd.message });
      else modifies++;
    }

    if (echecs.length) console.error("[decaler-temps] échecs:", echecs);
      scannerVaccinationsProgrammees().then(res => {
        console.log("programmes scannez");
        console.log(res);
      });
      console.log(`${jours} ${jours>0?'ajoutés':'soustraitss'} `)
    res.json({ data: { modifies, jours, echecs: echecs.length } });
  } catch (err) {
    next(err);
  }
});

export default router;

// Montage (protégé par auth pour récupérer req.fermeId) :
// app.use("/api/test", authenticate, testTempsRouter);
