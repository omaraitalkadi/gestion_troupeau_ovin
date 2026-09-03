import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createDossierMedical(data) {
  const { data: result, error } = await supabase
    .from('dossier_medical')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getDossierMedicalById(id) {
  const { data, error } = await supabase
    .from('dossier_medical')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getDossierMedicalByAnimal(animalId) {
  const { data, error } = await supabase
    .from('dossier_medical')
    .select(`
      *,
      traitement(*),
      vaccination(*),
      consultation_veterinaire(*)
    `)
    .eq('animal_id', animalId)
    .single();
  if (error) throw error;
  return data;
}

export async function getDossierMedicalComplet(animalId) {
  const { data, error } = await supabase
    .from('dossier_medical')
    .select(`
      *,
      animal(id, numero_rfid, numero_legal, race, sexe, date_naissance),
      traitement(*),
      vaccination(*),
      consultation_veterinaire(*)
    `)
    .eq('animal_id', animalId)
    .single();
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateDossierMedical(id, updates) {
  const { data, error } = await supabase
    .from('dossier_medical')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteDossierMedical(id) {
  const { error } = await supabase
    .from('dossier_medical')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
