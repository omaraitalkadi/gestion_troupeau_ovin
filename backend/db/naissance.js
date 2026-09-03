import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createNaissance(data) {
  const { data: result, error } = await supabase
    .from('naissance')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getNaissanceById(id) {
  const { data, error } = await supabase
    .from('naissance')
    .select('*, gestation(*, reproduction(brebis:brebis_id(*), belier:belier_id(*)))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNaissanceByGestation(gestationId) {
  const { data, error } = await supabase
    .from('naissance')
    .select('*')
    .eq('gestation_id', gestationId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllNaissances() {
  const { data, error } = await supabase
    .from('naissance')
    .select('*, gestation(reproduction(brebis:brebis_id(id, numero_rfid)))')
    .order('date_naissance', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNaissancesByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('naissance')
    .select('*, gestation(reproduction(brebis:brebis_id(id, numero_rfid)))')
    .gte('date_naissance', dateDebut)
    .lte('date_naissance', dateFin)
    .order('date_naissance', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTotalAgneauxNes(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('naissance')
    .select('nombre_agneaux')
    .gte('date_naissance', dateDebut)
    .lte('date_naissance', dateFin);
  if (error) throw error;
  return data.reduce((sum, n) => sum + (n.nombre_agneaux || 0), 0);
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateNaissance(id, updates) {
  const { data, error } = await supabase
    .from('naissance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteNaissance(id) {
  const { error } = await supabase
    .from('naissance')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
