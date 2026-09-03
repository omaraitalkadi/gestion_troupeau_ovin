import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createReproduction(data) {
  const { data: result, error } = await supabase
    .from('reproduction')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getReproductionById(id) {
  const { data, error } = await supabase
    .from('reproduction')
    .select('*, gestation(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getReproductionsByBrebis(brebisId) {
  const { data, error } = await supabase
    .from('reproduction')
    .select('*, gestation(*, naissance(*))')
    .eq('brebis_id', brebisId)
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getReproductionsByBelier(belierIds) {
  const { data, error } = await supabase
    .from('reproduction')
    .select('*, animal_brebis:brebis_id(*)')
    .eq('belier_id', belierIds)
    .order('date_saillie', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getReproductionsByStatut(statut) {
  const { data, error } = await supabase
    .from('reproduction')
    .select(`
      *,
      brebis:brebis_id(id, numero_rfid, numero_legal),
      belier:belier_id(id, numero_rfid, numero_legal),
      gestation(*)
    `)
    .eq('statut', statut)
    .order('date_saillie', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMisesBasPrevues(joursAvant = 14) {
  const today = new Date();
  const futur = new Date();
  futur.setDate(today.getDate() + joursAvant);

  const { data, error } = await supabase
    .from('reproduction')
    .select('*, brebis:brebis_id(id, numero_rfid, numero_legal)')
    .gte('date_prevue_mise_bas', today.toISOString().split('T')[0])
    .lte('date_prevue_mise_bas', futur.toISOString().split('T')[0])
    .order('date_prevue_mise_bas', { ascending: true });
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateReproduction(id, updates) {
  const { data, error } = await supabase
    .from('reproduction')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStatutReproduction(id, statut) {
  return updateReproduction(id, { statut });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteReproduction(id) {
  const { error } = await supabase
    .from('reproduction')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
