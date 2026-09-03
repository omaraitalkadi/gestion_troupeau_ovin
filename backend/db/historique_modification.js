import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createHistoriqueModification(data) {
  const { data: result, error } = await supabase
    .from('historique_modification')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getHistoriqueById(id) {
  const { data, error } = await supabase
    .from('historique_modification')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getHistoriqueByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('historique_modification')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .order('date_modification', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHistoriqueByEntite(entite) {
  const { data, error } = await supabase
    .from('historique_modification')
    .select('*, utilisateur(id, nom, email)')
    .eq('entite', entite)
    .order('date_modification', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHistoriqueByAction(action) {
  const { data, error } = await supabase
    .from('historique_modification')
    .select('*, utilisateur(id, nom, email)')
    .eq('action', action)
    .order('date_modification', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHistoriqueByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('historique_modification')
    .select('*, utilisateur(id, nom, email)')
    .gte('date_modification', dateDebut)
    .lte('date_modification', dateFin)
    .order('date_modification', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteHistoriqueModification(id) {
  const { error } = await supabase
    .from('historique_modification')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
