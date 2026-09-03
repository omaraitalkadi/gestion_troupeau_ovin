import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createUtilisateur(data) {
  const { data: result, error } = await supabase
    .from('utilisateur')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getUtilisateurById(id) {
  const { data, error } = await supabase
    .from('utilisateur')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getUtilisateurByEmail(email) {
  const { data, error } = await supabase
    .from('utilisateur')
    .select('*')
    .eq('email', email)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllUtilisateurs() {
  const { data, error } = await supabase
    .from('utilisateur')
    .select('*')
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getUtilisateursByRole(role) {
  const { data, error } = await supabase
    .from('utilisateur')
    .select('*')
    .eq('role', role);
  if (error) throw error;
  return data;
}

export async function getUtilisateurWithSessions(id) {
  const { data, error } = await supabase
    .from('utilisateur')
    .select(`
      *,
      session(*),
      notification(*),
      historique_modification(*),
      consultation_donnee(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateUtilisateur(id, updates) {
  const { data, error } = await supabase
    .from('utilisateur')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDernierAcces(id) {
  const { data, error } = await supabase
    .from('utilisateur')
    .update({ dernier_acces: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteUtilisateur(id) {
  const { error } = await supabase
    .from('utilisateur')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
