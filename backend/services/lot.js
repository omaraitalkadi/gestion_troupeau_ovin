// server/services/LotService.js
// I/O via primitives db.* ; appartenance systématique via ferme_id.
import { db } from "../tables/index.js";
import { assertAppartient } from "../middleware/appartenance.js";

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validerUuid = (v, champ) => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw badRequest(`${champ} invalide (UUID attendu)`);
  return v;
};

// pagination/tri depuis la query → options de list()
function optionsListe({ page, limit, orderBy, order, select } = {}, filters = {}) {
  const lim = limit != null ? Number(limit) : undefined;
  const pg  = page != null ? Number(page) : 1;
  return {
    select: select || "*",
    limit:  lim,
    offset: lim ? (pg - 1) * lim : undefined,
    orderBy: orderBy || undefined,
    ascending: order ? order.toLowerCase() !== "desc" : true,
    filters,
  };
}

// { animalCount, races } d'un lot — animaux bornés à la ferme.
async function statsLot(lotId, ferme_id) {
  const animaux = await db.animal.getBy({ lot_id: lotId, ferme_id }, "id, race");
  const races = new Set();
  for (const a of animaux ?? []) if (a.race) races.add(a.race);
  return { animalCount: animaux?.length ?? 0, races: [...races].sort() };
}

// ── Tous les lots de la ferme ────────────────────────────────
export async function getLots(ferme_id) {
  const { data, count } = await db.lot.list({
    orderBy: "nom",
    filters: { ferme_id },   // toujours borné à la ferme (jamais depuis la query)
  });
  return { data, count };
}

// ── Un lot + stats (appartenance vérifiée) ───────────────────
export async function getLotById(id, ferme_id) {
  const lot = await assertAppartient("lot", validerUuid(id, "id"), ferme_id, {
    label: "Lot", select: "*",
  });
  const stats = await statsLot(lot.id, ferme_id);
  return { ...lot, ...stats };
}

// ── Animaux d'un lot (paginés, bornés à la ferme) ────────────
export async function getAnimalsOfLot(id, ferme_id, query = {}) {
  // Vérifier que le lot appartient à la ferme AVANT de lister ses animaux.
  await assertAppartient("lot", validerUuid(id, "id"), ferme_id, { label: "Lot", select: "id" });

  // ferme_id ajouté au filtre → même un lot vide/étranger ne fuit rien.
  const options = optionsListe(query, { lot_id: id, ferme_id });
  const { data, count } = await db.animal.list(options);
  return {
    data,
    count,
    page:  Number(query.page) || 1,
    limit: query.limit ? Number(query.limit) : null,
  };
}