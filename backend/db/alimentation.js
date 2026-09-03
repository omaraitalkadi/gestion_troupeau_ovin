import { supabase } from './client.js';

// ════════════════════════════════════════════
// PLAN ALIMENTAIRE
// ════════════════════════════════════════════

export async function createPlanAlimentaire(data) {
  const { data: result, error } = await supabase
    .from('plan_alimentaire')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getPlanAlimentaireById(id) {
  const { data, error } = await supabase
    .from('plan_alimentaire')
    .select('*, consommation_alimentaire(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllPlansAlimentaires() {
  const { data, error } = await supabase
    .from('plan_alimentaire')
    .select('*')
    .order('date_debut', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPlansAlimentairesActifs() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('plan_alimentaire')
    .select('*')
    .lte('date_debut', today)
    .gte('date_fin', today);
  if (error) throw error;
  return data;
}

export async function updatePlanAlimentaire(id, updates) {
  const { data, error } = await supabase
    .from('plan_alimentaire')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlanAlimentaire(id) {
  const { error } = await supabase.from('plan_alimentaire').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// ALIMENT
// ════════════════════════════════════════════

export async function createAliment(data) {
  const { data: result, error } = await supabase
    .from('aliment')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getAlimentById(id) {
  const { data, error } = await supabase
    .from('aliment')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllAliments() {
  const { data, error } = await supabase
    .from('aliment')
    .select('*')
    .order('nom');
  if (error) throw error;
  return data;
}

export async function getAlimentsStockFaible(seuilMinimum) {
  const { data, error } = await supabase
    .from('aliment')
    .select('*')
    .lte('quantite_stock', seuilMinimum);
  if (error) throw error;
  return data;
}

export async function updateAliment(id, updates) {
  const { data, error } = await supabase
    .from('aliment')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStockAliment(id, quantiteStock) {
  return updateAliment(id, { quantite_stock: quantiteStock });
}

export async function deleteAliment(id) {
  const { error } = await supabase.from('aliment').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// CONSOMMATION ALIMENTAIRE
// ════════════════════════════════════════════

export async function createConsommationAlimentaire(data) {
  const { data: result, error } = await supabase
    .from('consommation_alimentaire')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getConsommationById(id) {
  const { data, error } = await supabase
    .from('consommation_alimentaire')
    .select('*, animal(*), aliment(*), plan_alimentaire(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getConsommationsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('consommation_alimentaire')
    .select('*, aliment(*)')
    .eq('animal_id', animalId)
    .order('date_consommation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsommationsByAliment(alimentId) {
  const { data, error } = await supabase
    .from('consommation_alimentaire')
    .select('*, animal(id, numero_rfid)')
    .eq('aliment_id', alimentId)
    .order('date_consommation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsommationsByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('consommation_alimentaire')
    .select('*, animal(id, numero_rfid), aliment(nom)')
    .gte('date_consommation', dateDebut)
    .lte('date_consommation', dateFin);
  if (error) throw error;
  return data;
}

export async function deleteConsommation(id) {
  const { error } = await supabase.from('consommation_alimentaire').delete().eq('id', id);
  if (error) throw error;
  return true;
}
