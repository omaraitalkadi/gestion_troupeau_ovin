import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createConsultationDonnee(data) {
  const { data: result, error } = await supabase
    .from('consultation_donnee')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getConsultationById(id) {
  const { data, error } = await supabase
    .from('consultation_donnee')
    .select('*, utilisateur(id, nom, email)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getConsultationsByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('consultation_donnee')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsultationsByEntite(entite) {
  const { data, error } = await supabase
    .from('consultation_donnee')
    .select('*, utilisateur(id, nom, email)')
    .eq('entite', entite)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConsultationsByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('consultation_donnee')
    .select('*, utilisateur(id, nom, email)')
    .gte('date_consultation', dateDebut)
    .lte('date_consultation', dateFin)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteConsultationDonnee(id) {
  const { error } = await supabase
    .from('consultation_donnee')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
