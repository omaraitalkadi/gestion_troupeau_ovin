import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createLot(data) {
  const { data: result, error } = await supabase
    .from('lot')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getLotById(id) {
  const { data, error } = await supabase
    .from('lot')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getLotByCode(code) {
  const { data, error } = await supabase
    .from('lot')
    .select('*')
    .eq('code', code)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllLots({ actif } = {}) {
  let query = supabase.from('lot').select('*');
  if (actif !== undefined) query = query.eq('actif', actif);
  const { data, error } = await query.order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getLotWithAnimaux(id) {
  const { data, error } = await supabase
    .from('lot')
    .select('*, animal(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getEffectifLot(id) {
  const { count, error } = await supabase
    .from('animal')
    .select('*', { count: 'exact', head: true })
    .eq('lot_id', id)
    .is('date_sortie', null);
  if (error) throw error;
  return count;
}

export async function getEffectifParSexe(id, sexe) {
  const { count, error } = await supabase
    .from('animal')
    .select('*', { count: 'exact', head: true })
    .eq('lot_id', id)
    .eq('sexe', sexe)
    .is('date_sortie', null);
  if (error) throw error;
  return count;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateLot(id, updates) {
  const { data, error } = await supabase
    .from('lot')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fermerLot(id) {
  return updateLot(id, { actif: false, date_fermeture: new Date().toISOString() });
}

export async function transfererAnimauxVersLot(animalIds, lotCibleId) {
  const { data, error } = await supabase
    .from('animal')
    .update({ lot_id: lotCibleId })
    .in('id', animalIds)
    .select();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteLot(id) {
  const { error } = await supabase
    .from('lot')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
