import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createPhotoAnimal(data) {
  const { data: result, error } = await supabase
    .from('photo_animal')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getPhotoById(id) {
  const { data, error } = await supabase
    .from('photo_animal')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getPhotosByAnimal(animalId) {
  const { data, error } = await supabase
    .from('photo_animal')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_capture', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getLatestPhotoByAnimal(animalId) {
  const { data, error } = await supabase
    .from('photo_animal')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_capture', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updatePhotoAnimal(id, updates) {
  const { data, error } = await supabase
    .from('photo_animal')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deletePhotoAnimal(id) {
  const { error } = await supabase
    .from('photo_animal')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteAllPhotosByAnimal(animalId) {
  const { error } = await supabase
    .from('photo_animal')
    .delete()
    .eq('animal_id', animalId);
  if (error) throw error;
  return true;
}
