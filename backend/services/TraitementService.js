// server/services/TraitementService.js
import { supabase } from "../lib/supabase.js";

const WRITABLE = [
  "animal_id", "lot_id", "date_traitement", "type_traitement",
  "produit", "dosage", "veterinaire", "duree_attente", "notes",
];
const pick = (body) => Object.fromEntries(
  Object.entries(body).filter(([k]) => WRITABLE.includes(k))
);

export async function getTraitements({ exploitationId, animalId, lotId, type, dateFrom, dateTo, page = 1, limit = 50 }) {
  let query = supabase
    .from("traitements")
    .select("*, animaux(numero_rfid, race), lots(nom)", { count: "exact" })
    .eq("exploitation_id", exploitationId)
    .order("date_traitement", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (animalId) query = query.eq("animal_id", animalId);
  if (lotId)    query = query.eq("lot_id",    lotId);
  if (type)     query = query.eq("type_traitement", type);
  if (dateFrom) query = query.gte("date_traitement", dateFrom);
  if (dateTo)   query = query.lte("date_traitement", dateTo);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getTraitementById(id, exploitationId) {
  const { data, error } = await supabase
    .from("traitements")
    .select("*, animaux(id, numero_rfid, race), lots(id, nom)")
    .eq("id", id)
    .eq("exploitation_id", exploitationId)
    .single();

  if (error) throw error;
  return data;
}

export async function getUpcoming(exploitationId, days = 7) {
  const future = new Date();
  future.setDate(future.getDate() + days);

  const { data, error } = await supabase
    .from("traitements")
    .select("*, animaux(numero_rfid)")
    .eq("exploitation_id", exploitationId)
    .gte("date_traitement", new Date().toISOString().split("T")[0])
    .lte("date_traitement", future.toISOString().split("T")[0])
    .order("date_traitement");

  if (error) throw error;
  return data;
}

export async function createTraitement(body, exploitationId) {
  if (!body.type_traitement) throw Object.assign(new Error("type_traitement requis"), { status: 400 });
  if (!body.date_traitement) throw Object.assign(new Error("date_traitement requis"), { status: 400 });
  if (!body.animal_id && !body.lot_id) throw Object.assign(new Error("animal_id ou lot_id requis"), { status: 400 });

  const { data, error } = await supabase
    .from("traitements")
    .insert({ ...pick(body), exploitation_id: exploitationId })
    .select("*, animaux(numero_rfid), lots(nom)")
    .single();

  if (error) throw error;
  return data;
}

export async function updateTraitement(id, body, exploitationId) {
  const { data, error } = await supabase
    .from("traitements")
    .update(pick(body))
    .eq("id", id)
    .eq("exploitation_id", exploitationId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error("Traitement introuvable"), { status: 404 });
  return data;
}

export async function deleteTraitement(id, exploitationId) {
  const { error } = await supabase
    .from("traitements")
    .delete()
    .eq("id", id)
    .eq("exploitation_id", exploitationId);

  if (error) throw error;
}
