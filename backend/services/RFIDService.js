// server/services/RFIDService.js
import { supabase } from "../lib/supabase.js";

export async function searchByRFID(q, exploitationId) {
  if (!q?.trim()) throw Object.assign(new Error("Paramètre q requis"), { status: 400 });

  const { data, error } = await supabase
    .from("animaux")
    .select("id, numero_rfid, numero_legal, nom, race, sexe, etat, poids, lot(id, nom)")
    .eq("exploitation_id", exploitationId)
    .or(`numero_rfid.ilike.%${q}%,numero_legal.ilike.%${q}%`)
    .limit(10);

  if (error) throw error;
  return data;
}

export async function logScan({ animalId, exploitationId, ip, userAgent }) {
  // Optionnel : table rfid_scans pour tracer les scans
  const { error } = await supabase
    .from("rfid_scans")
    .insert({
      animal_id:       animalId,
      exploitation_id: exploitationId,
      scanned_at:      new Date().toISOString(),
      ip_address:      ip,
      user_agent:      userAgent,
    });

  // On ignore les erreurs (table optionnelle)
  if (error) console.warn("[RFIDService.logScan]", error.message);
}
