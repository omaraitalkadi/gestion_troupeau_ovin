import { supabase } from './client.js';

// ════════════════════════════════════════════
// ALERTE
// ════════════════════════════════════════════

export async function createAlerte(data) {
  const { data: result, error } = await supabase
    .from('alerte')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getAlerteById(id) {
  const { data, error } = await supabase
    .from('alerte')
    .select('*, notification(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllAlertes() {
  const { data, error } = await supabase
    .from('alerte')
    .select('*')
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAlertesByType(type) {
  const { data, error } = await supabase
    .from('alerte')
    .select('*')
    .eq('type', type)
    .order('date_echeance', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAlertesEnAttente() {
  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from('alerte')
    .select('*')
    .lte('date_echeance', today)
    .order('date_echeance', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateAlerte(id, updates) {
  const { data, error } = await supabase
    .from('alerte')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAlerte(id) {
  const { error } = await supabase.from('alerte').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// NOTIFICATION
// ════════════════════════════════════════════

export async function createNotification(data) {
  const { data: result, error } = await supabase
    .from('notification')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getNotificationById(id) {
  const { data, error } = await supabase
    .from('notification')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNotificationsByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('notification')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .order('date_envoi', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNotificationsNonLues(utilisateurId) {
  const { data, error } = await supabase
    .from('notification')
    .select('*')
    .eq('utilisateur_id', utilisateurId)
    .neq('statut', 'LU')
    .order('date_envoi', { ascending: false });
  if (error) throw error;
  return data;
}

export async function marquerNotificationLue(id) {
  const { data, error } = await supabase
    .from('notification')
    .update({ statut: 'LU' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function marquerToutesLues(utilisateurId) {
  const { data, error } = await supabase
    .from('notification')
    .update({ statut: 'LU' })
    .eq('utilisateur_id', utilisateurId)
    .select();
  if (error) throw error;
  return data;
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('notification').delete().eq('id', id);
  if (error) throw error;
  return true;
}
