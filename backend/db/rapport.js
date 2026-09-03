import { supabase } from './client.js';

// ════════════════════════════════════════════
// RAPPORT
// ════════════════════════════════════════════

export async function createRapport(data) {
  const { data: result, error } = await supabase
    .from('rapport')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getRapportById(id) {
  const { data, error } = await supabase
    .from('rapport')
    .select('*, statistique(*), indicateur_performance(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllRapports() {
  const { data, error } = await supabase
    .from('rapport')
    .select('*')
    .order('date_generation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRapportsByType(type) {
  const { data, error } = await supabase
    .from('rapport')
    .select('*')
    .eq('type', type)
    .order('date_generation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateRapport(id, updates) {
  const { data, error } = await supabase
    .from('rapport')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRapport(id) {
  const { error } = await supabase.from('rapport').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// STATISTIQUE
// ════════════════════════════════════════════

export async function createStatistique(data) {
  const { data: result, error } = await supabase
    .from('statistique')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getStatistiquesByRapport(rapportId) {
  const { data, error } = await supabase
    .from('statistique')
    .select('*')
    .eq('rapport_id', rapportId);
  if (error) throw error;
  return data;
}

export async function updateStatistique(id, updates) {
  const { data, error } = await supabase
    .from('statistique')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStatistique(id) {
  const { error } = await supabase.from('statistique').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// INDICATEUR DE PERFORMANCE
// ════════════════════════════════════════════

export async function createIndicateurPerformance(data) {
  const { data: result, error } = await supabase
    .from('indicateur_performance')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getIndicateursByRapport(rapportId) {
  const { data, error } = await supabase
    .from('indicateur_performance')
    .select('*')
    .eq('rapport_id', rapportId);
  if (error) throw error;
  return data;
}

export async function updateIndicateur(id, updates) {
  const { data, error } = await supabase
    .from('indicateur_performance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIndicateur(id) {
  const { error } = await supabase.from('indicateur_performance').delete().eq('id', id);
  if (error) throw error;
  return true;
}
