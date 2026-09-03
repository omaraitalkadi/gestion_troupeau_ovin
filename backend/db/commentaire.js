import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createCommentaire(data) {
  const { data: result, error } = await supabase
    .from('commentaire')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getCommentaireById(id) {
  const { data, error } = await supabase
    .from('commentaire')
    .select('*, utilisateur(id, nom), animal(id, numero_rfid)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getCommentairesByAnimal(animalId) {
  const { data, error } = await supabase
    .from('commentaire')
    .select('*, utilisateur(id, nom)')
    .eq('animal_id', animalId)
    .order('date_commentaire', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCommentairesByUtilisateur(utilisateurId) {
  const { data, error } = await supabase
    .from('commentaire')
    .select('*, animal(id, numero_rfid)')
    .eq('utilisateur_id', utilisateurId)
    .order('date_commentaire', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateCommentaire(id, updates) {
  const { data, error } = await supabase
    .from('commentaire')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteCommentaire(id) {
  const { error } = await supabase
    .from('commentaire')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
