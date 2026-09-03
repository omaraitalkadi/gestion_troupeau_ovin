// server/services/ProductionService.js
import { supabase } from "../lib/supabase.js";

const WRITABLE = [
  "animal_id", "lot_id", "date_production", "type_production",
  "valeur", "unite", "notes",
];
const pick = (body) => Object.fromEntries(
  Object.entries(body).filter(([k]) => WRITABLE.includes(k))
);

// Types valides : TONTE, PESEE, ABATTAGE, VENTE_LAIT, AUTRE
const TYPES_VALIDES = ["TONTE", "PESEE", "ABATTAGE", "VENTE_LAIT", "AUTRE"];

export async function getProductions({ exploitationId, animalId, lotId, type, dateFrom, dateTo, page = 1, limit = 50 }) {
  let query = supabase
    .from("productions")
    .select("*, animaux(numero_rfid, race), lots(nom)", { count: "exact" })
    .eq("exploitation_id", exploitationId)
    .order("date_production", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (animalId) query = query.eq("animal_id", animalId);
  if (lotId)    query = query.eq("lot_id",    lotId);
  if (type)     query = query.eq("type_production", type);
  if (dateFrom) query = query.gte("date_production", dateFrom);
  if (dateTo)   query = query.lte("date_production", dateTo);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getStats(exploitationId) {
  const { data, error } = await supabase
    .from("productions")
    .select("type_production, valeur, unite, date_production")
    .eq("exploitation_id", exploitationId);

  if (error) throw error;

  // Agrégation par type
  const stats = {};
  for (const row of data ?? []) {
    const t = row.type_production;
    if (!stats[t]) stats[t] = { total: 0, count: 0, unite: row.unite };
    stats[t].total += Number(row.valeur ?? 0);
    stats[t].count += 1;
  }

  return stats;
}

export async function createProduction(body, exploitationId) {
  if (!body.type_production) throw Object.assign(new Error("type_production requis"), { status: 400 });
  if (!TYPES_VALIDES.includes(body.type_production))
    throw Object.assign(new Error(`type_production doit être : ${TYPES_VALIDES.join(", ")}`), { status: 400 });
  if (!body.date_production) throw Object.assign(new Error("date_production requis"), { status: 400 });

  const { data, error } = await supabase
    .from("productions")
    .insert({ ...pick(body), exploitation_id: exploitationId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduction(id, body, exploitationId) {
  const { data, error } = await supabase
    .from("productions")
    .update(pick(body))
    .eq("id", id)
    .eq("exploitation_id", exploitationId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error("Entrée de production introuvable"), { status: 404 });
  return data;
}

export async function deleteProduction(id, exploitationId) {
  const { error } = await supabase
    .from("productions")
    .delete()
    .eq("id", id)
    .eq("exploitation_id", exploitationId);

  if (error) throw error;
}


