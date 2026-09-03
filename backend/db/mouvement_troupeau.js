import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createMouvement(data) {
  const { data: result, error } = await supabase
    .from('mouvement_troupeau')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getMouvementById(id) {
  const { data, error } = await supabase
    .from('mouvement_troupeau')
    .select('*, animal(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getMouvementsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('mouvement_troupeau')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_mouvement', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMouvementsByType(type) {
  const { data, error } = await supabase
    .from('mouvement_troupeau')
    .select('*, animal(*)')
    .eq('type', type)
    .order('date_mouvement', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMouvementsByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('mouvement_troupeau')
    .select('*, animal(*)')
    .gte('date_mouvement', dateDebut)
    .lte('date_mouvement', dateFin)
    .order('date_mouvement', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateMouvement(id, updates) {
  const { data, error } = await supabase
    .from('mouvement_troupeau')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteMouvement(id) {
  const { error } = await supabase
    .from('mouvement_troupeau')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
