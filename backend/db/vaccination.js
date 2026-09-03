import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createVaccination(data) {
  const { data: result, error } = await supabase
    .from('vaccination')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getVaccinationById(id) {
  const { data, error } = await supabase
    .from('vaccination')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getVaccinationsByDossier(dossierMedicalId) {
  const { data, error } = await supabase
    .from('vaccination')
    .select('*')
    .eq('dossier_medical_id', dossierMedicalId)
    .order('date_vaccination', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getVaccinationsAVenir(joursAvant = 30) {
  const today = new Date();
  const futur = new Date();
  futur.setDate(today.getDate() + joursAvant);

  const { data, error } = await supabase
    .from('vaccination')
    .select('*, dossier_medical(animal(id, numero_rfid, numero_legal))')
    .gte('prochaine_date', today.toISOString().split('T')[0])
    .lte('prochaine_date', futur.toISOString().split('T')[0])
    .order('prochaine_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getVaccinationsRetard() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('vaccination')
    .select('*, dossier_medical(animal(id, numero_rfid, numero_legal))')
    .lt('prochaine_date', today)
    .order('prochaine_date', { ascending: true });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateVaccination(id, updates) {
  const { data, error } = await supabase
    .from('vaccination')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteVaccination(id) {
  const { error } = await supabase
    .from('vaccination')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
