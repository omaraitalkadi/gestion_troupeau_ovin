import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createConsultationVeterinaire(data) {
  const { data: result, error } = await supabase
    .from('consultation_veterinaire')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getConsultationVetById(id) {
  const { data, error } = await supabase
    .from('consultation_veterinaire')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getConsultationsVetByDossier(dossierMedicalId) {
  const { data, error } = await supabase
    .from('consultation_veterinaire')
    .select('*')
    .eq('dossier_medical_id', dossierMedicalId)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsultationsVetByVeterinaire(nomVeterinaire) {
  const { data, error } = await supabase
    .from('consultation_veterinaire')
    .select('*, dossier_medical(animal(id, numero_rfid, numero_legal))')
    .ilike('nom_veterinaire', `%${nomVeterinaire}%`)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsultationsVetByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('consultation_veterinaire')
    .select('*, dossier_medical(animal(id, numero_rfid, numero_legal))')
    .gte('date_consultation', dateDebut)
    .lte('date_consultation', dateFin)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateConsultationVet(id, updates) {
  const { data, error } = await supabase
    .from('consultation_veterinaire')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteConsultationVet(id) {
  const { error } = await supabase
    .from('consultation_veterinaire')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
