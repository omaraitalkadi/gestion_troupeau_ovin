import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createTraitement(data) {
  const { data: result, error } = await supabase
    .from('traitement')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getTraitementById(id) {
  const { data, error } = await supabase
    .from('traitement')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getTraitementsByDossier(dossierMedicalId) {
  const { data, error } = await supabase
    .from('traitement')
    .select('*')
    .eq('dossier_medical_id', dossierMedicalId)
    .order('date_debut', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTraitementsEnCours() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('traitement')
    .select('*, dossier_medical(animal(id, numero_rfid, numero_legal))')
    .lte('date_debut', today)
    .gte('date_fin', today);
  if (error) throw error;
  return data;
}

export async function getTraitementsByType(type) {
  const { data, error } = await supabase
    .from('traitement')
    .select('*, dossier_medical(animal(id, numero_rfid))')
    .eq('type', type)
    .order('date_debut', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCoutTotalTraitements(dossierMedicalId) {
  const { data, error } = await supabase
    .from('traitement')
    .select('cout')
    .eq('dossier_medical_id', dossierMedicalId);
  if (error) throw error;
  return data.reduce((sum, t) => sum + (t.cout || 0), 0);
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateTraitement(id, updates) {
  const { data, error } = await supabase
    .from('traitement')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteTraitement(id) {
  const { error } = await supabase
    .from('traitement')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
