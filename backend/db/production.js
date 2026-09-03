import { supabase } from './client.js';

// ════════════════════════════════════════════
// PRODUCTION (base)
// ════════════════════════════════════════════

export async function getProductionById(id) {
  const { data, error } = await supabase
    .from('production')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getProductionsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('production')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_production', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProductionsByType(type) {
  const { data, error } = await supabase
    .from('production')
    .select('*, animal(id, numero_rfid, race)')
    .eq('type', type)
    .order('date_production', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteProduction(id) {
  const { error } = await supabase.from('production').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// TONTE
// ════════════════════════════════════════════

export async function createTonte(data) {
  const { data: result, error } = await supabase
    .from('tonte')
    .insert([{ ...data, type: 'TONTE' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getTontesByAnimal(animalId) {
  const { data, error } = await supabase
    .from('tonte')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_production', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTontesByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('tonte')
    .select('*, animal(id, numero_rfid, race)')
    .gte('date_production', dateDebut)
    .lte('date_production', dateFin);
  if (error) throw error;
  return data;
}

export async function getPoidsLaineTotalParPeriode(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('tonte')
    .select('poids_laine')
    .gte('date_production', dateDebut)
    .lte('date_production', dateFin);
  if (error) throw error;
  return data.reduce((sum, t) => sum + (t.poids_laine || 0), 0);
}

export async function updateTonte(id, updates) {
  const { data, error } = await supabase
    .from('tonte')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// CROISSANCE
// ════════════════════════════════════════════

export async function createCroissance(data) {
  const { data: result, error } = await supabase
    .from('croissance')
    .insert([{ ...data, type: 'CROISSANCE' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getCroissancesByAnimal(animalId) {
  const { data, error } = await supabase
    .from('croissance')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_mesure', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getDernierePeseeAnimal(animalId) {
  const { data, error } = await supabase
    .from('croissance')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_mesure', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCroissance(id, updates) {
  const { data, error } = await supabase
    .from('croissance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// ABATTAGE
// ════════════════════════════════════════════

export async function createAbattage(data) {
  const { data: result, error } = await supabase
    .from('abattage')
    .insert([{ ...data, type: 'ABATTAGE' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getAbattageByAnimal(animalId) {
  const { data, error } = await supabase
    .from('abattage')
    .select('*')
    .eq('animal_id', animalId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllAbattages() {
  const { data, error } = await supabase
    .from('abattage')
    .select('*, animal(id, numero_rfid, race)')
    .order('date_production', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateAbattage(id, updates) {
  const { data, error } = await supabase
    .from('abattage')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
