// server/services/AnimalService.js
import { db } from "../tables/index.js";
import { assertAppartient } from "../middleware/appartenance.js";
import { creerTransactionFinanciere } from "./FinanceService.js";


// ════════════════════════════════════════════════════════════
//  VALIDATION
// ════════════════════════════════════════════════════════════
// ── Mapping statut de sortie → TypeMouvement (enum limité) ──────────────
// TypeMouvement = { NAISSANCE, VENTE, DECES, TRANSFERT, ACHAT } uniquement.
// ⚠️ PERDU et ABATTU n'ont PAS de type dédié → rattachés à DECES (sortie du
//    cheptel). Si tu ajoutes ABATTAGE / PERTE à l'enum, corrige ici.
const TYPE_MOUVEMENT_SORTIE = {
  VENDU:     "VENTE",
  MORT:      "DECES",
  TRANSFERE: "TRANSFERT",
  PERDU:     "PERTE",      // ← plus DECES
  ABATTU:    "ABATTAGE",   // ← plus DECES
};

// Champs éditables via PATCH /animaux/:id — descriptifs UNIQUEMENT.
// Ce qui porte un cycle de vie / un effet de bord a son endpoint dédié :
//   lot_id → changerLot · statut, date_sortie → declarer{Vente,Deces,Abattage,Sortie} · etat+statut → declarerQuarantaine
const CHAMPS_MODIFIABLES = [
  "numero_rfid", "numero_legal", "sexe",
  "date_naissance", "date_arrivee",
  "race", "poids", "condition_corporelle",
  "pere_id", "mere_id",
  "nom", "notes",
];
// FK : "" / null / espaces = « ne pas toucher », JAMAIS « efface le lien ».
const FK_MODIFIABLES = new Set(["pere_id", "mere_id"]);

const STATUTS_SORTIE = ["MORT", "PERDU", "TRANSFERE"]; // sorties "simples" (sans record annexe)
const WRITABLE_FIELDS = [
  "numero_rfid", "numero_legal", "sexe", "date_naissance",
  "date_arrivee", "date_sortie", "race", "poids", "etat",
  "condition_corporelle", "lot_id", "pere_id", "mere_id",
  "nom", "notes",
];
const STATUTS_MORTABLES = new Set(["ACTIF", "EN_QUARANTAINE"]);
const MOTIF_NON_MORTABLE = {
  MORT:      "Animal déjà déclaré mort",
  ABATTU:    "Animal abattu",
  VENDU:     "Animal vendu : ne fait plus partie du cheptel",
  TRANSFERE: "Animal transféré : ne fait plus partie du cheptel",
  PERDU:     "Animal perdu : ne fait plus partie du cheptel",
};
function assertMortable(animal) {
  if (STATUTS_MORTABLES.has(animal.status)) return;
  throw conflit(
    MOTIF_NON_MORTABLE[animal.status] ?? `Décès impossible depuis le statut "${animal.status}"`
  );
}


const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const conflit    = (msg) => Object.assign(new Error(msg), { status: 409 });

// ── Validateurs de base (réutilisables) ───────────────────────────────────
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validerUuid(v, champ) {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw badRequest(`${champ} invalide (UUID attendu)`);
  return v;
}

// montant OBLIGATOIRE, nombre fini strictement > 0 (une vente a un prix)
function validerMontant(v, champ = "montant") {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw badRequest(`${champ} doit être un nombre`);
  if (v <= 0)
    throw badRequest(`${champ} doit être strictement positif (MAD)`);
  return v;
}


// date OBLIGATOIRE, valide, non future
function validerDateSortie(v, champ = "date_sortie") {
  if (v == null || v === "") throw badRequest(`${champ} requis`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest(`${champ} invalide`);
  if (d > new Date())           throw badRequest(`${champ} ne peut pas être dans le futur`);
  return d;
}

// ── Éligibilité à la vente ────────────────────────────────────────────────
// Seul statut vendable : ACTIF. Les autres sont refusés avec un motif clair.
const STATUTS_VENDABLES = new Set(["ACTIF"]);
const MOTIF_NON_VENDABLE = {
  VENDU:          "Animal déjà vendu",
  MORT:           "Animal mort : vente impossible",
  ABATTU:         "Animal abattu : vente impossible",
  TRANSFERE:      "Animal transféré : ne fait plus partie du troupeau",
  PERDU:          "Animal perdu : ne fait plus partie du troupeau",
  EN_QUARANTAINE: "Animal en quarantaine : lever la quarantaine avant la vente",
};
function assertVendable(animal) {
  if (STATUTS_VENDABLES.has(animal.status)) return;
  throw conflit(
    MOTIF_NON_VENDABLE[animal.status] ?? `Vente impossible depuis le statut "${animal.status}"`
  );
}

// ── Écriture commune (animal + mouvement) — colonnes réelles uniquement ────
async function _appliquerVente(animal, {
  date_sortie, transaction_financiere_id = null, transaction_animaux_id = null,
}) {
  await db.animal.update(animal.id, { status: "VENDU", date_sortie, lot_id: null });

  await db.mouvementTroupeau.create({
    animal_id:                 animal.id,
    type:                      "VENTE",
    lot_origine_id:            animal.lot_id ?? null, // lot quitté
    lot_dest_id:               null,                   // sortie du cheptel
    date_mouvement:            date_sortie,
    transaction_financiere_id,
    transaction_animaux_id,
  });
}

async function rollback(stack) {
  for (const undo of stack.reverse()) { try { await undo(); } catch (_) {} }
}

export function pickWritable(body) {
  return Object.fromEntries(
    Object.entries(body).filter(([k]) => WRITABLE_FIELDS.includes(k))
  );
}

function validateEtat(etat) {
  return ["ACTIF", "GESTATION", "ALLAITEMENT", "AGNEAU", "VENDU", "DECEDE", "ARCHIVE"].includes(etat);
}

function validateCC(cc) {
  return ["MAIGRE", "NORMALE", "GRASSE"].includes(cc);
}

export function validateAnimal(body, isCreate = true) {
  const errors = [];

  if (isCreate) {
    const hasId = body.numero_rfid?.trim() || body.numero_legal?.trim();
    if (!hasId)               errors.push("numero_rfid ou numero_legal est obligatoire");
    if (!body.sexe)           errors.push("sexe est obligatoire (MALE | FEMELLE)");
    if (!body.date_naissance) errors.push("date_naissance est obligatoire");
    if (!body.race?.trim())   errors.push("race est obligatoire");
  }

  if (body.sexe && !["MALE", "FEMELLE"].includes(body.sexe))
    errors.push("sexe doit être MALE ou FEMELLE");

  if (body.etat && !validateEtat(body.etat))
    errors.push("etat invalide");

  if (body.condition_corporelle && !validateCC(body.condition_corporelle))
    errors.push("condition_corporelle doit être MAIGRE, NORMALE ou GRASSE");

  if (body.poids != null && Number(body.poids) <= 0)
    errors.push("poids doit être positif");

  if (body.date_naissance && body.date_arrivee) {
    if (new Date(body.date_arrivee) < new Date(body.date_naissance))
      errors.push("date_arrivee ne peut pas être antérieure à date_naissance");
  }

  return errors;
}

// ════════════════════════════════════════════════════════════
//  RÈGLES SUR LES ANIMAUX RÉFÉRENCÉS (pere_id / mere_id)
// ════════════════════════════════════════════════════════════

// États "sortie du cheptel" : un animal vendu ou décédé ne peut pas être
// désigné comme parent d'un nouvel animal.
// ⚠️ Le code stocke ces valeurs dans `etat` (cf. declarerVente / declarerDeces).
//    Le diagramme, lui, modélise un champ `status` distinct (VENDU | MORT |
//    ABATTU | ...) avec `etat` réservé à la santé (SAIN | MALADE | ...).
//    On teste `etat` pour rester cohérent avec ce que le reste du fichier écrit
//    réellement. Si la table possède bien les deux colonnes, il faudra pointer
//    ce test sur `status` et y ajouter MORT / ABATTU.
const ETATS_SORTIE = ["VENDU", "DECEDE"];

/**
 * Vérifie qu'un animal référencé comme parent :
 *   1. appartient à la ferme courante,
 *   2. n'est pas sorti du cheptel (ni vendu ni décédé),
 *   3. a le sexe attendu (père = MALE, mère = FEMELLE).
 *
 * Un même animal passé en père ET en mère échoue forcément sur le sexe (il ne
 * peut pas être MALE et FEMELLE), donc aucun test "père ≠ mère" séparé n'est
 * nécessaire.
 *
 * @param {string|null} id            valeur de pere_id / mere_id (absente => skip)
 * @param {string} ferme_id
 * @param {"MALE"|"FEMELLE"} sexeAttendu
 * @param {string} label              "Père" | "Mère" (messages d'erreur)
 * @returns {Promise<object|null>}    la ligne du parent, ou null si non fourni
 */
async function assertParentAssignable(id, ferme_id, sexeAttendu, label) {
  if (id == null) return null; // FK optionnelle non fournie → rien à vérifier

  const parent = await db.animal.getOneBy({ id, ferme_id }, "id, sexe, etat");
  if (!parent)
    throw Object.assign(new Error(`${label} introuvable dans cette ferme`), { status: 404 });

  if (ETATS_SORTIE.includes(parent.etat))
    throw Object.assign(
      new Error(`${label} indisponible : l'animal est ${parent.etat === "VENDU" ? "vendu" : "décédé"}`),
      { status: 409 }
    );

  if (parent.sexe !== sexeAttendu)
    throw Object.assign(
      new Error(`${label} doit être un animal ${sexeAttendu === "MALE" ? "mâle" : "femelle"}`),
      { status: 400 }
    );

  return parent;
}

// ════════════════════════════════════════════════════════════
//  QUERIES — using db.animal table module
// ════════════════════════════════════════════════════════════

export async function getAnimaux({ ferme_id, etat, race, sexe, lot_id, condition_corporelle, page = 1, limit = 200 }) {
  const offset  = (page - 1) * limit;
  const filters = {};
  if (ferme_id) {
    filters.ferme_id = ferme_id;
  } else throw new Error("ferme_id est obligatoire");

  if (etat)                 filters.etat                 = etat;
  if (race)                 filters.race                 = race;
  if (sexe)                 filters.sexe                 = sexe;
  if (lot_id)               filters.lot_id               = lot_id;
  if (condition_corporelle) filters.condition_corporelle = condition_corporelle;

  const result = await db.animal.list({ limit, offset, filters });
  return { ...result, page: Number(page), limit: Number(limit) };
}

export async function count(filters = {}) {
  return await db.animal.count(filters);
}

export async function getAnimalById(id, ferme_id) {
  const filters = {};
  if (ferme_id && id) {
    filters.ferme_id = ferme_id;
    filters.id = id;
  } else throw new Error("ferme_id et id sont obligatoires");

  const data = await db.animal.getOneBy(filters);
  if (!data) throw Object.assign(new Error("Animal introuvable"), { status: 404 });
  return data;
}

export async function createAnimal(body, ferme_id) {
  const errors = validateAnimal(body, true);
  if (errors.length) throw Object.assign(new Error(errors[0]), { status: 400, errors });

  const numeroRfid  = body.numero_rfid?.trim()  || null;
  const numeroLegal = body.numero_legal?.trim() || null;

  // Unicité dans la ferme (sur les valeurs trimées, celles qui seront stockées)
  if (numeroRfid) {
    const existing = await db.animal.getByNumeroRfid(numeroRfid, ferme_id);
    if (existing)
      throw Object.assign(
        new Error(`Un animal avec le RFID "${numeroRfid}" existe déjà`),
        { status: 409 }
      );
  }
  if (numeroLegal) {
    const existing = await db.animal.getByNumeroLegal(numeroLegal, ferme_id);
    if (existing)
      throw Object.assign(
        new Error(`Un animal avec le numéro légal "${numeroLegal}" existe déjà`),
        { status: 409 }
      );
  }

  // FK fournies par le client, vérifiées en parallèle (point-reads indépendants) :
  //   - lot cible : simple appartenance à la ferme
  //   - parents   : appartenance + non sortis du cheptel + sexe cohérent
  await Promise.all([
    assertAppartient("lot", body.lot_id, ferme_id, { label: "Lot" }),
    assertParentAssignable(body.pere_id, ferme_id, "MALE",    "Père"),
    assertParentAssignable(body.mere_id, ferme_id, "FEMELLE", "Mère"),
  ]);

  const payload = {
    ...pickWritable(body),
    numero_rfid:  numeroRfid,
    numero_legal: numeroLegal,
    etat:         body.etat ?? "ACTIF",
    date_arrivee: body.date_arrivee ?? body.date_naissance,
    ferme_id,
  };

  const created = await db.animal.create(payload, { select: "id" });
  return created
}




function pickModifiable(body) {
  const patch = {};
  for (const [k, v] of Object.entries(body)) {
    if (!CHAMPS_MODIFIABLES.includes(k)) continue;
    const val = typeof v === "string" ? v.trim() : v;
    if (FK_MODIFIABLES.has(k) && (val == null || val === "")) continue; // FK vidée → ignorée
    patch[k] = val;
  }
  return patch;
}

// Unicité d'un identifiant modifié : ne fait rien si absent ou inchangé.
async function assertUnique(finder, valeur, ancienne, id, label) {
  if (!valeur || valeur === ancienne) return;         // valeur déjà trimée par pickModifiable
  const conflit = await finder(valeur);
  if (conflit && conflit.id !== id)
    throw Object.assign(new Error(`${label} "${valeur}" est déjà utilisé`), { status: 409 });
}

export async function updateAnimal(id, body, ferme_id) {
  // 1) Validation pure (aucune I/O) — un body invalide échoue sans requête.
  const errors = validateAnimal(body, false);
  if (errors.length) throw Object.assign(new Error(errors[0]), { status: 400, errors });

  // 2) Patch normalisé : on ne vérifie et n'écrit QUE ça.
  const patch = pickModifiable(body);

  // 3) Chargement + appartenance (2ᵉ barrière ; fournit les valeurs courantes).
  const existing = await db.animal.getOneBy({ id, ferme_id });
  if (!existing) throw Object.assign(new Error("Animal introuvable"), { status: 404 });

  // 4) Vérifs indépendantes, en parallèle, sur les valeurs du patch uniquement.
  await Promise.all([
    assertUnique((v) => db.animal.getByNumeroRfid(v, ferme_id),  patch.numero_rfid,  existing.numero_rfid,  id, "Le RFID"),
    assertUnique((v) => db.animal.getByNumeroLegal(v, ferme_id), patch.numero_legal, existing.numero_legal, id, "Le numéro légal"),
    assertParentAssignable(patch.pere_id, ferme_id, "MALE",    "Père"),
    assertParentAssignable(patch.mere_id, ferme_id, "FEMELLE", "Mère"),
  ]);

  // 5) Écriture.
  return db.animal.update(id, patch);
 
}

export async function changerLot(id, { lot_id, motif }, ferme_id) {
  if (!lot_id) throw Object.assign(new Error("lot_id requis"), { status: 400 });

  // L'animal ciblé (db.animal.update filtre par id seul → on borne à la ferme ici)
  await assertAppartient("animal", id, ferme_id, { label: "Animal" });
  // Le lot cible
  await assertAppartient("lot", lot_id, ferme_id, { label: "Lot" });

  await db.animal.update(id, { lot_id });
  // Trigger DB : historise l'affectation de lot automatiquement
  return db.animal.getOneBy({ id, ferme_id });
}



// ── Création de mouvement (refs optionnelles) ──────────────────────────
export async function enregistrerMouvement({
  animal_id,
  type,
  lot_origine_id = null,
  lot_dest_id = null,                 // ⚠️ ton message dit lot_destination_id ; ton insert existant = lot_dest_id
  description = null,
  date_mouvement = new Date(),
  transaction_animaux_id = null,      // batch vente/achat
  transaction_financiere_id = null,   // lien direct mouvement ↔ transaction (0..1)           
}) {
  if (!animal_id) throw Object.assign(new Error("animal_id requis"), { status: 400 });
  if (!type)      throw Object.assign(new Error("type requis"),      { status: 400 });

  return db.mouvementTroupeau.create({
    animal_id,
    type,
    lot_origine_id,
    lot_dest_id,
    description,
    date_mouvement,
    transaction_animaux_id,
    transaction_financiere_id,        // ← désormais inséré
  });
}

// ── Cœur commun des SORTIES (animal déjà chargé + vérifié) ─────────────
// N'écrit QUE statut (voir note sur `etat`). Nulle le lot, pose date_sortie,
// crée le mouvement de sortie (origine = lot courant, destination = null).
async function _sortie(animal, ferme_id, {
  statut, typeMouvement, date_sortie, 
  transaction_financiere_id = null, transaction_animaux_id = null, 
}) {
  await db.animal.update(animal.id, { statut, date_sortie, lot_id: null,  });

  await enregistrerMouvement({
    animal_id:      animal.id,
    type:           typeMouvement,
    lot_origine_id: animal.lot_id ?? null, // lot quitté (lu AVANT le nettoyage)
    lot_dest_id:    null,                   // sortie du cheptel
    date_mouvement: date_sortie,
    transaction_financiere_id,
    transaction_animaux_id,
  });

  return db.animal.getOneBy({ id: animal.id, ferme_id });
}

// ══════════════════════════════════════════════════════════════════════════
//  VENTE UNITAIRE
// ══════════════════════════════════════════════════════════════════════════
export async function declarerVente(id, body = {}, ferme_id) {
  // 1) Validation d'entrée (aucune I/O)
  const date_sortie = validerDateSortie(body.date_sortie);
  const montant     = validerMontant(body.montant);

  // 2) Appartenance + éligibilité
  const animal = await assertAppartient("animal", id, ferme_id, {
    label: "Animal", select: "id, lot_id, status",
  });
  assertVendable(animal);

  // 3) Écritures serveur (best-effort ; candidat RPC pour l'atomicité réelle)
  const stack = [];
  try {
    const txFin = await creerTransactionFinanciere({
      type: "REVENUE",
      montant,                                  // > 0, validé
      description: "Vente animal",
      // ni ferme_id ni utilisateur_id : liens indirects via le mouvement
    });
    stack.push(() => db.transactionFinanciere.remove(txFin.id));

    await _appliquerVente(animal, { date_sortie, transaction_financiere_id: txFin.id });

    return db.animal.getOneBy({ id, ferme_id });
  } catch (e) {
    await rollback(stack);
    throw e;
  }
}

// ── MORT / PERDU / TRANSFERE ───────────────────────────────────────────
export async function declarerSortie(
  id,
  { statut, date_sortie,  },
  ferme_id
) {
  if (!STATUTS_SORTIE.includes(statut))
    throw Object.assign(new Error(`statut de sortie invalide (${STATUTS_SORTIE.join(" | ")})`), { status: 400 });
  if (!date_sortie) throw Object.assign(new Error("date_sortie requis"), { status: 400 });

  const animal = await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id, lot_id" });

  return _sortie(animal, ferme_id, {
    statut,
    typeMouvement: TYPE_MOUVEMENT_SORTIE[statut],
    date_sortie, 
  });
}

export async function declarerAbattage(
  id,
  { date_sortie, poids_carcasse, note_conformation,
    transaction_financiere_id = null, transaction_animaux_id = null },
  ferme_id
) {
  if (!date_sortie) throw Object.assign(new Error("date_sortie requis"), { status: 400 });
  const animal = await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id, lot_id" });

  // 1) Mouvement d'ABORD (sortie du cheptel) — la ligne production le référencera.
  const mouvement = await enregistrerMouvement({
    animal_id:      id,
    type:           TYPE_MOUVEMENT_SORTIE.ABATTU,   // "ABATTAGE" une fois l'enum étendu
    lot_origine_id: animal.lot_id ?? null,
    lot_dest_id:    null,
    date_mouvement: date_sortie,
    transaction_financiere_id,
    transaction_animaux_id,
  });

  // 2) Ligne production (single-table, type=ABATTAGE) qui PORTE la FK vers le mouvement.
  await db.production.create({
    type:               "ABATTAGE",
    animal_id:          id,
    date_production:    date_sortie,
    poids_carcasse:     poids_carcasse ?? null,
    note_conformation:  note_conformation ?? null,   // param désormais réellement reçu
    mouvement_troupeau_id: mouvement.id,             // ← FK côté production
  });

  // 3) Statut animal (sans re-créer de mouvement).
  return db.animal.update(id, { statut: "ABATTU", date_sortie, lot_id: null });

}

// ── QUARANTAINE (mouvement INTERNE : l'animal reste au cheptel) ─────────
export async function declarerQuarantaine(id, { lot_quarantaine_id, notes }, ferme_id) {
  if (!lot_quarantaine_id) throw Object.assign(new Error("lot_quarantaine_id requis"), { status: 400 });

  await assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id, lot_id" });
  await assertAppartient("lot", lot_quarantaine_id, ferme_id, { label: "Lot de quarantaine" });

  // Ici les DEUX champs ont un sens : lifecycle EN_QUARANTAINE + santé ISOLE.
  // Pas de date_sortie (l'animal ne quitte pas le cheptel) ; lot_id → lot de quarantaine.
  const animal=await db.animal.update(id, {
    statut: "EN_QUARANTAINE",
    etat:   "ISOLE",
    lot_id: lot_quarantaine_id,
    notes:  notes ?? null,
  });

  await enregistrerMouvement({
    animal_id:      id,
    type:           "TRANSFERT",             // ⚠️ pas de type QUARANTAINE dans l'enum
    lot_origine_id: animal.lot_id ?? null,   // ⚠️ "non nul" attendu → suppose un lot courant
    lot_dest_id:    lot_quarantaine_id,
    date_mouvement: new Date(),
  });

  return animal;
}

export async function getDescendants(id, ferme_id) {
  // Appartenance d'abord (db.animal.getDescendants n'est pas bornée à la ferme)
  await assertAppartient("animal", id, ferme_id, { label: "Animal" });
  return db.animal.getDescendants(id);
}

export async function getAscendants(id, ferme_id) {
  await assertAppartient("animal", id, ferme_id, { label: "Animal" });
  return db.animal.getAscendants(id, ferme_id);
}





// ══════════════════════════════════════════════════════════════════════════
//  services/AnimalService.js — bloc VENTE (unitaire + lot)
//
//  Transaction REVENUE créée CÔTÉ SERVEUR (aucun id transaction venu du client).
//  - PAS de utilisateur_id : une vente n'est pas rattachée à un utilisateur ;
//    elle atteint la ferme via mouvement_troupeau → animal.
//  - PAS de ferme_id sur la transaction (lien indirect).
//
//  Champs = uniquement ceux du diagramme :
//    animal(status, date_sortie, lot_id)
//    mouvement_troupeau(animal_id, type, lot_origine_id, lot_dest_id,
//                       date_mouvement, transaction_financiere_id, transaction_animaux_id)
//    transaction_animaux(type, date_transaction, montant_total, nombre,
//                        transaction_financiere_id)
// ══════════════════════════════════════════════════════════════════════════







// ══════════════════════════════════════════════════════════════════════════
//  VENTE PAR LOT (batch)
//  1 transaction_financiere (REVENUE) + 1 transaction_animaux (VENTE),
//  chaque mouvement rattaché au batch (évite le double compte du montant).
//  Tous les animaux doivent être vendables : rejet AVANT toute écriture.
// ══════════════════════════════════════════════════════════════════════════
export async function declarerVenteLot(body = {}, ferme_id) {
  // 1) Validation d'entrée
  const date_sortie   = validerDateSortie(body.date_sortie);
  const montant_total = validerMontant(body.montant_total, "montant_total");

  if (!Array.isArray(body.animal_ids) || body.animal_ids.length === 0)
    throw badRequest("animal_ids (liste non vide) requis");
  const ids = [...new Set(body.animal_ids.map((v) => validerUuid(v, "animal_id")))];

  // 2) Charger + vérifier appartenance ET éligibilité de TOUS avant d'écrire
  const animaux = await Promise.all(
    ids.map((id) =>
      assertAppartient("animal", id, ferme_id, { label: "Animal", select: "id, lot_id, status" })
    )
  );
  animaux.forEach(assertVendable); // 1er non vendable → rien n'est écrit

  // 3) Écritures serveur (best-effort)
  const stack = [];
  try {
    const txFin = await creerTransactionFinanciere({
      type: "REVENUE",
      montant: montant_total,
      description: `Vente lot (${ids.length} animaux)`,
    });
    stack.push(() => db.transactionFinanciere.remove(txFin.id));

    const txAnimaux = await db.transactionAnimaux.create({
      type:                      "VENTE",
      date_transaction:          date_sortie,
      montant_total,
      nombre:                    ids.length,
      transaction_financiere_id: txFin.id,
    });
    stack.push(() => db.transactionAnimaux.remove(txAnimaux.id));

    for (const animal of animaux) {
      await _appliquerVente(animal, {
        date_sortie,
        transaction_animaux_id: txAnimaux.id, // lien vers le batch (montant compté 1×)
      });
    }

    return { transaction_financiere: txFin, transaction_animaux: txAnimaux, animaux_vendus: ids.length };
  } catch (e) {
    await rollback(stack);
    throw e;
  }
}


// ══════════════════════════════════════════════════════════════════════════
//  DÉCÈS  (pas de transaction financière → écritures séquentielles simples)
//  On peut mourir depuis un animal vivant/présent : ACTIF ou EN_QUARANTAINE.
// ══════════════════════════════════════════════════════════════════════════


export async function declarerDeces(id, body = {}, ferme_id) {
  // 1) Validation d'entrée. date_sortie = date d'effet du décès (non future).
  const date_sortie = validerDateSortie(body.date_sortie);

  // 2) Appartenance + éligibilité (on charge date_naissance pour borner la date).
  const animal = await assertAppartient("animal", id, ferme_id, {
    label: "Animal", select: "id, lot_id, status, date_naissance",
  });
  assertMortable(animal);

  if (animal.date_naissance && date_sortie < new Date(animal.date_naissance))
    throw badRequest("date_sortie antérieure à la date de naissance");

  // 3) Écritures : statut MORT + mouvement DECES (aucune transaction).
  await db.animal.update(id, { status: "MORT", date_sortie, lot_id: null });

  await enregistrerMouvement({
    animal_id:      id,
    type:           "DECES",
    lot_origine_id: animal.lot_id ?? null,
    lot_dest_id:    null,
    date_mouvement: new Date(),   // horodatage serveur ≠ date d'effet
  });

  return db.animal.getOneBy({ id, ferme_id });
}

 // Best-effort life-event logging; never fails the main request.
export async function logEvent(animalId, type, description) {
  try {
    await journalVieApi.create({
      animal_id: animalId,
      type_evenement: type,
      description,
      date_evenement: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`[journal_vie] could not log ${type} for ${animalId}:`, e.message);
  }
}