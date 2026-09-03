import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createGestation(data) {
  const { data: result, error } = await supabase
    .from('gestation')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getGestationById(id) {
  const { data, error } = await supabase
    .from('gestation')
    .select('*, naissance(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getGestationByReproduction(reproductionId) {
  const { data, error } = await supabase
    .from('gestation')
    .select('*, naissance(*)')
    .eq('reproduction_id', reproductionId)
    .single();
  if (error) throw error;
  return data;
}

export async function getGestationsEnCours() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('gestation')
    .select(`
      *,
      reproduction(
        brebis:brebis_id(id, numero_rfid, numero_legal)
      )
    `)
    .gte('date_fin_prevue', today)
    .eq('etat', 'EN_COURS');
  if (error) throw error;
  return data;
}

export async function getGestationsTerminesSansMiseBas() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('gestation')
    .select(`
      *,
      reproduction(brebis:brebis_id(id, numero_rfid, numero_legal))
    `)
    .lt('date_fin_prevue', today)
    .is('naissance.id', null);
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateGestation(id, updates) {
  const { data, error } = await supabase
    .from('gestation')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteGestation(id) {
  const { error } = await supabase
    .from('gestation')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
