import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createSession(data) {
  const { data: result, error } = await supabase
    .from('session')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getSessionById(id) {
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getSessionByToken(token) {
  const { data, error } = await supabase
    .from('session')
    .select('*, utilisateur(*)')
    .eq('token', token)
    .eq('est_active', true)
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveSessionsByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .eq('est_active', true)
    .gt('date_expiration', new Date().toISOString());
  if (error) throw error;
  return data;
}

export async function getAllSessionsByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function deactivateSession(id) {
  const { data, error } = await supabase
    .from('session')
    .update({ est_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateAllUserSessions(utilisateurId) {
  const { data, error } = await supabase
    .from('session')
    .update({ est_active: false })
    .eq('utilisateur_id', utilisateurId)
    .select();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteExpiredSessions() {
  const { error } = await supabase
    .from('session')
    .delete()
    .lt('date_expiration', new Date().toISOString());
  if (error) throw error;
  return true;
}

export async function deleteSession(id) {
  const { error } = await supabase
    .from('session')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
