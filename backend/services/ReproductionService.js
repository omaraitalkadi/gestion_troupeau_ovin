// server/services/ReproductionService.js
//
// Une "chaleur" n'est pas une table : c'est l'état d'OUVERTURE d'une
// Reproduction (statut EN_CHALEUR). Déclarer une chaleur = créer la repro.
//
// Champs = uniquement ceux du diagramme Reproduction :
//   id, type, statut, date_creation, date_saillie, date_prevue_mise_bas,
//   brebis_id (Animal, obligatoire), belier_id (Animal, 0..1)
import { db } from "../tables/index.js";
import { assertAppartient } from "../middleware/appartenance.js";
// ═══════════════════════════════════════════════════════════════════════════
//  À AJOUTER À ReproductionService.js
//  (imports supplémentaires, helpers partagés, et les transitions manquantes)
// ═══════════════════════════════════════════════════════════════════════════

// ── Import supplémentaire (en haut du fichier, avec les autres imports) ──────
import { createAnimal } from "./animal.js"; // réutilisé par declarerNaissance


// ═══════════════════════════════════════════════════════════════════════════
//  À AJOUTER dans ReproductionService.js
//  Reproduction(s) + TOUTE la gestation + TOUTE la naissance + les agneaux,
//  en une seule requête. `*` à chaque niveau = tous les champs de chaque table.
// ═══════════════════════════════════════════════════════════════════════════

// reproduction (tous champs)
//   ├─ gestation (tous champs, 0..1)   via gestation.reproduction_id
//   │     └─ naissance (tous champs, 0..1) via naissance.gestation_id
//   └─ agneaux (animal, 0..*)          via animal.reproduction_origine_id
// ⚠️ Les FK doivent exister en base (REFERENCES) pour que l'embed fonctionne.
const SELECT_REPRO_FULL = `
  *,
  gestation:gestation!reproduction_id(
    *,
    naissance:naissance!gestation_id(*)
  ),
  agneaux:animal!reproduction_origine_id(*)
`;

// ── Helpers/constantes partagés (près de tes autres const) ──────────────────
const validerDate = (v, champ) => {
  if (v == null || v === "") throw badRequest(`${champ} requis`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest(`${champ} invalide`);
  if (d > new Date()) throw badRequest(`${champ} ne peut pas être dans le futur`);
  return d;
};

// ⚠️ Gestation ovine ≈ 147 j. Ajuste à ta race si besoin.
const DUREE_GESTATION_JOURS = 147;

// Cœur commun d'une transition SUR UNE reproduction : charge + vérifie
// l'appartenance + contrôle que le statut courant autorise l'action.
async function _chargerPourTransition(reproId, ferme_id, statutsAutorises, action, select = "id, statut") {
  const repro = await assertAppartient("reproduction", validerUuid(reproId, "id"), ferme_id, {
    label: "Reproduction", select,
  });
  if (!statutsAutorises.includes(repro.statut))
    throw conflit(`${action} impossible depuis le statut "${repro.statut}" (attendu : ${statutsAutorises.join(" | ")})`);
  return repro;
}

// Statuts depuis lesquels une repro peut passer à NON_SAILLIE (chaleur non honorée).
const STATUTS_VERS_NON_SAILLIE = new Set(["EN_CHALEUR"]);

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const conflit    = (msg) => Object.assign(new Error(msg), { status: 409 });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validerUuid = (v, champ) => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw badRequest(`${champ} invalide (UUID attendu)`);
  return v;
};

// Statuts d'un cycle ENCORE actif → bloquent une nouvelle chaleur.
// ⚠️ Confirme la liste complète de StatutReproduction : les statuts TERMINAUX
//    (mise bas faite / échec / terminé…) NE doivent PAS être ici, sinon la
//    femelle est bloquée À VIE après un seul cycle. Ce sont bien les 3 que tu
//    as cités — assure-toi qu'il n'y en a pas d'autres à considérer comme actifs
//    (ex. ALLAITEMENT / SEVRAGE si tu bloques la remise à la reproduction).
const STATUTS_REPRO_ACTIFS = new Set(["EN_CHALEUR", "SAILLIE", "GESTANTE"]);

// Statuts d'animal depuis lesquels une chaleur est déclarable.
const STATUTS_ANIMAL_OK = new Set(["ACTIF", "EN_QUARANTAINE"]);

// ═══════════════════════════════════════════════════════════════════════════
//  SAILLIE  (EN_CHALEUR → SAILLIE) — une brebis OU un lot  [MODÈLE A]
//  body : { belier_id, date_saillie, type?, brebis_id? | lot_id? }
//  On fait avancer des reproductions DÉJÀ EN_CHALEUR (on n'en crée pas).
//  Lot : on saute (sans échouer) les brebis sans cycle EN_CHALEUR et on les
//  rapporte. Unitaire : erreur si la brebis n'a pas de cycle EN_CHALEUR.
// ═══════════════════════════════════════════════════════════════════════════
export async function declarerSaillie({ belier_id, date_saillie, type, brebis_id, lot_id }, ferme_id) {
  const d = validerDate(date_saillie, "date_saillie");
  if (!brebis_id === !lot_id)
    throw badRequest("Fournir brebis_id OU lot_id (exactement un des deux)");

  // 1) Bélier : mâle, de la ferme, disponible. ⚠️ requis (group breeding).
  const belierId = validerUuid(belier_id, "belier_id");
  const belier = await assertAppartient("animal", belierId, ferme_id, { label: "Bélier", select: "id, sexe, status" });
  if (belier?.sexe !== "MALE")
    throw conflit("belier_id doit désigner un animal mâle");
  if (!STATUTS_ANIMAL_OK.has(belier.status))
    throw conflit(`Bélier indisponible (statut ${belier.status})`);

  // 2) Résoudre les brebis cibles (appartenance vérifiée).
  let cibles;
  if (brebis_id) {
    const b = await assertAppartient("animal", validerUuid(brebis_id, "brebis_id"), ferme_id, {
      label: "Brebis", select: "id, sexe, status",
    });
    cibles = [b];
  } else {
    await assertAppartient("lot", validerUuid(lot_id, "lot_id"), ferme_id, { label: "Lot" });
    cibles = await db.animal.getBy({ lot_id, ferme_id }, "id, sexe, status");
  }

  const femelles = cibles.filter((a) => a.sexe === "FEMELLE" && STATUTS_ANIMAL_OK.has(a.status));
  if (brebis_id && femelles.length === 0) throw conflit("La brebis n'est pas une femelle présente");
  if (femelles.length === 0) throw conflit("Aucune femelle présente dans le lot");

  const datePrevue = new Date(d.getTime() + DUREE_GESTATION_JOURS * 86400000).toISOString().slice(0, 10);
  const champsType = type ? { type } : {}; // ⚠️ TypeReproduction : valeurs ? NON NULL ?

  // 3) Avancer le cycle EN_CHALEUR de chaque brebis.
  const saillies = [];
  const ignorees = [];
  for (const brebis of femelles) {
    const repros = await db.reproduction.findBy("brebis_id", brebis.id, { select: "id, statut" });
    const enChaleur = repros.find((r) => r.statut === "EN_CHALEUR");
    if (!enChaleur) {
      ignorees.push({ brebis_id: brebis.id, raison: "aucun cycle EN_CHALEUR ouvert" });
      continue;
    }
    saillies.push(await db.reproduction.update(enChaleur.id, {
      statut:               "SAILLIE",
      date_saillie,
      belier_id:            belierId,
      date_prevue_mise_bas: datePrevue,
      ...champsType,
    }));
  }
  if (brebis_id && saillies.length === 0)
    throw conflit(ignorees[0]?.raison ?? "Aucun cycle EN_CHALEUR à sailler");

  return { saillies_effectuees: saillies.length, ignorees, saillies };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SAILLIE → GESTANTE  (+ crée le suivi de gestation ; multi-tables → rollback)
//  ⚠️ Colonnes `gestation` À CONFIRMER (cf. scanners).
// ═══════════════════════════════════════════════════════════════════════════
export async function confirmerGestation(reproId, ferme_id) {
  const repro = await _chargerPourTransition(
    reproId, ferme_id, ["SAILLIE"], "Confirmation de gestation",
    "id, statut, date_prevue_mise_bas"
  );

  const existantes = await db.gestation.findBy("reproduction_id", reproId, { select: "id" });
  if (existantes.length) throw conflit("Un suivi de gestation existe déjà pour cette reproduction");

  const stack = [];
  try {
    await db.reproduction.update(reproId, { statut: "GESTANTE" });
    stack.push(() => db.reproduction.update(reproId, { statut: "SAILLIE" }));

    const gestation = await db.gestation.create({
      reproduction_id: reproId,
      date_fin_prevue: repro.date_prevue_mise_bas,
      etat:            "EN_COURS", // ⚠️ valeur d'enum à confirmer
    });

    return { reproduction: { id: reproId, statut: "GESTANTE" }, gestation };
  } catch (e) {
    for (const undo of stack.reverse()) { try { await undo(); } catch (_) {} }
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SAILLIE → NON_GESTANTE  (diagnostic négatif ; TERMINAL)
// ═══════════════════════════════════════════════════════════════════════════
export async function marquerNonGestante(reproId, ferme_id) {
  await _chargerPourTransition(reproId, ferme_id, ["SAILLIE"], "Passage NON_GESTANTE");
  return db.reproduction.update(reproId, { statut: "NON_GESTANTE" });
}

// ═══════════════════════════════════════════════════════════════════════════
//  GESTANTE → CLOTUREE
//  Seul état clôturable (NON_SAILLIE / NON_GESTANTE restent terminaux).
//  Prérequis : la reproduction a bien un suivi de gestation.
// ═══════════════════════════════════════════════════════════════════════════
export async function cloturerReproduction(reproId, ferme_id) {
  await _chargerPourTransition(reproId, ferme_id, ["GESTANTE"], "Clôture");
  const gestations = await db.gestation.findBy("reproduction_id", reproId, { select: "id" });
  if (gestations.length === 0)
    throw conflit("Aucun suivi de gestation pour cette reproduction : clôture impossible");
  return db.reproduction.update(reproId, { statut: "CLOTUREE" });
}

// ═══════════════════════════════════════════════════════════════════════════
//  NAISSANCE (mise bas) — clé = GESTATION
//  Crée les agneaux (filiation héritée du cycle : mere=brebis, pere=belier,
//  reproduction_origine_id=repro) puis clôt (gestation TERMINEE, repro CLOTUREE).
//  Atomique best-effort. ⚠️ Colonnes `naissance` à confirmer.
// ═══════════════════════════════════════════════════════════════════════════
function validerAgneau(a, i) {
  const p = `agneaux[${i}]`;
  const rfid  = typeof a.numero_rfid === "string" ? a.numero_rfid.trim() : "";
  const legal = typeof a.numero_legal === "string" ? a.numero_legal.trim() : "";
  if (!rfid && !legal) throw badRequest(`${p} : numero_rfid ou numero_legal obligatoire`);
  if (!["MALE", "FEMELLE"].includes(a.sexe)) throw badRequest(`${p} : sexe doit être MALE ou FEMELLE`);
  if (a.poids != null && (typeof a.poids !== "number" || !Number.isFinite(a.poids) || a.poids <= 0))
    throw badRequest(`${p} : poids doit être un nombre positif`);
}

export async function declarerNaissance(gestationId, { date_naissance, agneaux }, ferme_id) {
  // 1) Validation d'entrée
  validerDate(date_naissance, "date_naissance");
  if (!Array.isArray(agneaux) || agneaux.length === 0)
    throw badRequest("agneaux (liste non vide) requis");
  agneaux.forEach(validerAgneau);

  // 2) Gestation + reproduction (filiation + contrôle d'état) + appartenance
  const gestation = await assertAppartient("gestation", validerUuid(gestationId, "id"), ferme_id, {
    label: "Gestation",
    select: "id, etat, reproduction_id, reproduction:reproduction_id(id, statut, brebis_id, belier_id)",
  });
  const repro = gestation.reproduction;
  if (!repro) throw conflit("Gestation sans reproduction rattachée");
  if (repro.statut !== "GESTANTE")
    throw conflit(`Mise bas impossible : reproduction non GESTANTE (statut ${repro.statut})`);

  // ⚠️ createAnimal exige `race` : on récupère celle de la mère pour la défaut.
  const mere = await db.animal.getOneBy({ id: repro.brebis_id, ferme_id }, "id, race");

  const naissancesExistantes = await db.naissance.findBy("gestation_id", gestationId, { select: "id" });
  if (naissancesExistantes.length)
    throw conflit("Une naissance est déjà enregistrée pour cette gestation");

  // 3) Écritures (best-effort)
  const stack = [];
  try {
    const naissance = await db.naissance.create({
      gestation_id:   gestationId,
      date_naissance,
      nombre_agneaux: agneaux.length, // ⚠️ colonnes naissance à confirmer
    });
    stack.push(() => db.naissance.remove(naissance.id));

    const agneauxCrees = [];
    for (const a of agneaux) {
      const cree = await createAnimal(
        {
          numero_rfid:  a.numero_rfid ?? null,
          numero_legal: a.numero_legal ?? null,
          sexe:         a.sexe,
          race:         a.race ?? mere?.race ?? null, // défaut = race de la mère
          poids:        a.poids ?? null,
          nom:          a.nom ?? null,
          date_naissance,
          date_arrivee: date_naissance,
          status:       "ACTIF",
          etat:         "SAIN", // ⚠️ santé initiale à confirmer
          mere_id:      repro.brebis_id,
          pere_id:      repro.belier_id ?? null,
          reproduction_origine_id: repro.id,
        },
        ferme_id
      );
      stack.push(() => db.animal.remove(cree.id));
      agneauxCrees.push(cree);
    }

    await db.gestation.update(gestationId, { etat: "TERMINEE" }); // ⚠️ enum à confirmer
    await db.reproduction.update(repro.id, { statut: "CLOTUREE" });

    return { naissance, agneaux: agneauxCrees, nombre: agneauxCrees.length,
             reproduction: { id: repro.id, statut: "CLOTUREE" } };
  } catch (e) {
    for (const undo of stack.reverse()) { try { await undo(); } catch (_) {} }
    throw e;
  }
}




/**
 * Déclare une chaleur → crée une Reproduction (statut EN_CHALEUR) pour la brebis.
 * Critères : femelle · statut ACTIF|EN_QUARANTAINE · aucun cycle déjà actif.
 */
export async function declarerChaleur({ animal_id }, ferme_id) {
  const id = validerUuid(animal_id, "animal_id");

  // 1) Appartenance + lecture de sexe et status
  const animal = await assertAppartient("animal", id, ferme_id, {
    label: "Animal", select: "id, sexe, status",
  });

  // 2) Éligibilité de l'animal
  if (animal.sexe !== "FEMELLE")
    throw conflit("La déclaration de chaleur ne concerne que les femelles");
  if (!STATUTS_ANIMAL_OK.has(animal.status))
    throw conflit(`Chaleur impossible depuis le statut "${animal.status}"`);

  // 3) Aucun cycle de reproduction déjà actif pour cette brebis
  //    (peu de repros par animal → findBy + filtre JS suffit ; pas de filtre IN
  //     dans les primitives)
  const repros = await db.reproduction.findBy("brebis_id", id, { select: "id, statut" });
  const actif  = repros.find((r) => STATUTS_REPRO_ACTIFS.has(r.statut));
  if (actif)
    throw conflit(`Cycle de reproduction déjà actif (statut ${actif.statut})`);

  // 4) Création du cycle en chaleur — pré-saillie : belier & dates encore nuls
  return db.reproduction.create({
    brebis_id:     id,
    statut:        "EN_CHALEUR",
    date_creation: new Date().toISOString(),
    // belier_id, date_saillie, date_prevue_mise_bas : null à ce stade
    // ⚠️ type (TypeReproduction) : si NOT NULL en base, fournis une valeur ici
    //    (ex. "NATURELLE") OU rends la colonne nullable jusqu'à la saillie.
  });
}

// ── Lecture ────────────────────────────────────────────────────────────────
// Une repro précise — appartenance résolue via brebis → animal → ferme
// (règle `reproduction` du registre APPARTENANCE).
export async function getReproductionById(id, ferme_id) {
  return assertAppartient("reproduction", validerUuid(id, "id"), ferme_id, {
    label: "Reproduction", select: "*",
  });
}



/**
 * Toutes les reproductions d'une femelle, avec gestation + naissance + agneaux
 * COMPLETS imbriqués (1 requête).
 */
export async function getReproductionsDetail(animal_id, ferme_id) {
  const id = validerUuid(animal_id, "animal_id");
  await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id" });

  return db.reproduction.findBy("brebis_id", id, {
    select: SELECT_REPRO_FULL,
    orderBy: "date_creation",
    ascending: false,
  });
}

/**
 * Une reproduction précise, avec gestation + naissance + agneaux COMPLETS (1 requête).
 * @returns {Promise<object|null>}
 */
export async function getReproductionDetailById(id, ferme_id) {
  await assertAppartient("reproduction", validerUuid(id, "id"), ferme_id, {
    label: "Reproduction", select: "id",
  });
  const rows = await db.reproduction.findBy("id", id, { select: SELECT_REPRO_FULL });
  return rows[0] ?? null;
}

// Historique repro d'une femelle.
export async function getReproductionsByAnimal(animal_id, ferme_id) {
  const id = validerUuid(animal_id, "animal_id");
  await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id" });
  return db.reproduction.findBy("brebis_id", id, { orderBy: "date_creation", ascending: false });
}

// ── Mise à jour générique ──────────────────────────────────────────────────
// ⚠️ Les VRAIES transitions (saillie → gestante → mise bas) auront leurs
//    propres fonctions avec leurs règles (date_saillie, belier_id, calcul de
//    date_prevue_mise_bas…). Ceci n'est qu'un update borné à la ferme.
export async function updateReproduction(id, patch, ferme_id) {
  await assertAppartient("reproduction", validerUuid(id, "id"), ferme_id, { label: "Reproduction", select: "id" });
  return db.reproduction.update(id, patch); // à restreindre par un allow-list de champs
}





/**
 * Clôt une chaleur non suivie de saillie : EN_CHALEUR → NON_SAILLIE.
 * Vérifie la transition (on ne bascule que depuis EN_CHALEUR) — idempotent :
 * relancer sur une repro déjà résolue est un no-op silencieux, pas une erreur,
 * ce qui évite au scanner de replanter sur un état course-condition.
 */
export async function marquerNonSaillie(reproId, ferme_id) {
  if (ferme_id) {
    await _chargerPourTransition(reproId, ferme_id, ["EN_CHALEUR"], "Passage NON_SAILLIE");
  } else {
    const repro = await db.reproduction.getOneBy({ id: reproId }, "id, statut");
    if (!repro) throw Object.assign(new Error("Reproduction introuvable"), { status: 404 });
    if (repro.statut !== "EN_CHALEUR") return repro; // idempotent (cron)
  }
  return db.reproduction.update(reproId, { statut: "NON_SAILLIE" });
}

// Chaleurs périmées + brebis résolue (ferme_id + libellé) pour l'alerte.
export async function trouverChaleursPerimees(delaiJours) {
  const dayToMillS = 86400000;
  const limite = new Date(Date.now() - delaiJours * dayToMillS).toISOString();
  const { data } = await db.reproduction.list({
    select: "id, date_creation, brebis:brebis_id(id, ferme_id, numero_rfid, numero_legal)",
    filters: { statut: "EN_CHALEUR" },
    lt: { date_creation: limite },
  });
  return data ?? [];
}

// GET /api/reproduction/lot/:lotId/candidates-saillie
// Retourne les brebis EN_CHALEUR d'un lot → le front propose la saillie.
export async function candidatesSaillie(lotId, ferme_id) {
  await assertAppartient("lot", validerUuid(lotId, "lotId"), ferme_id, { label: "Lot" });
  const brebis = await db.animal.getBy({ lot_id: lotId, ferme_id }, "id, sexe, status, numero_rfid, numero_legal");
  const femelles = brebis.filter((a) => a.sexe === "FEMELLE" && STATUTS_ANIMAL_OK.has(a.status));

  const enChaleur = [];
  for (const b of femelles) {
    const repros = await db.reproduction.findBy("brebis_id", b.id, { select: "id, statut" });
    if (repros.some((r) => r.statut === "EN_CHALEUR")) enChaleur.push(b);
  }
  return enChaleur; // [] → pas de prompt ; sinon le front propose /saillie
}