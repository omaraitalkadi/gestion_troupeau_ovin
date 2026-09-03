import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createJournalVie(data) {
  const { data: result, error } = await supabase
    .from('journal_vie')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getJournalVieById(id) {
  const { data, error } = await supabase
    .from('journal_vie')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getJournalVieByAnimal(animalId) {
  const { data, error } = await supabase
    .from('journal_vie')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_evenement', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getJournalVieByType(typeEvenement) {
  const { data, error } = await supabase
    .from('journal_vie')
    .select('*, animal(id, numero_rfid, numero_legal)')
    .eq('type_evenement', typeEvenement)
    .order('date_evenement', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getJournalVieByDateRange(animalId, dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('journal_vie')
    .select('*')
    .eq('animal_id', animalId)
    .gte('date_evenement', dateDebut)
    .lte('date_evenement', dateFin)
    .order('date_evenement', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateJournalVie(id, updates) {
  const { data, error } = await supabase
    .from('journal_vie')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteJournalVie(id) {
  const { error } = await supabase
    .from('journal_vie')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
