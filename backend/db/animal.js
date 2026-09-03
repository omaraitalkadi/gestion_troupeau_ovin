import { supabase } from './client.js';

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createAnimal(data) {
  const { data: result, error } = await supabase
    .from('animal')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getAnimalById(id) {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .eq('id', id)
    .single();
    return {data,error}

 
}

export async function getAnimalByRFID(numeroRFID) {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .eq('numero_rfid', numeroRFID)
    .single();
  if (error) throw error;
  return data;
}

export async function getAnimalByNumeroLegal(numeroLegal) {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .eq('numero_legal', numeroLegal)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllAnimaux({search, etat, race,sexe, page=1,limit=200,lot_id } = {}) {
  let query = supabase.from('animal').select('*');

  if (search)  query = query.or(`numero_rfid.ilike.%${search}%,numero_legal.ilike.%${search}%,race.ilike.%${search}%`);
  if (etat)  query = query.eq('etat', etat);
  if (sexe)  query = query.eq('sexe', sexe);
  if (race)  query = query.eq('race', race);
  if (lot_id)  query = query.eq("lot_id", lot_id);

  query = query.is('date_sortie', null); // active animals only
  const { data, error,count } = await query.order('date_naissance', { ascending: false })
                                     .range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  return {data,count};
}

export async function getAnimalWithFullProfile(id) {
  const { data, error } = await supabase
    .from('animal')
    .select(`
      *,
      dossier_medical(
        *,
        traitement(*),
        vaccination(*),
        consultation_veterinaire(*)
      ),
      mouvement_troupeau(*),
      journal_vie(*),
      photo_animal(*),
      production(*),
      consommation_alimentaire(*),
      document(*),
      commentaire(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getDescendants(animalId) {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .or(`mere_id.eq.${animalId},pere_id.eq.${animalId}`);
  if (error) throw error;
  return data;
}

export async function getAscendants(animalId) {
  const { data: animal, error } = await supabase
    .from('animal')
    .select('mere_id, pere_id')
    .eq('id', animalId)
    .single();
  if (error) throw error;

  const parentIds = [animal.mere_id, animal.pere_id].filter(Boolean);
  if (!parentIds.length) return [];

  const { data, error: err2 } = await supabase
    .from('animal')
    .select('*')
    .in('id', parentIds);
  if (err2) throw err2;
  return data;
}

export async function getAnimauxByLot(lotId) {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .eq('lot_id', lotId);
  if (error) throw error;
  return data;
}

export async function getAnimauxActifs() {
  const { data, error } = await supabase
    .from('animal')
    .select('*')
    .is('date_sortie', null);
  if (error) throw error;
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateAnimal(id, updates) {
  const { data, error } = await supabase
    .from('animal')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEtatAnimal(id, etat) {
  return updateAnimal(id, { etat });
}

export async function updatePoidsAnimal(id, poids) {
  return updateAnimal(id, { poids });
}

export async function sortirAnimal(id, dateSortie) {
  return updateAnimal(id, { date_sortie: dateSortie });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteAnimal(id) {
  const { error } = await supabase
    .from('animal')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
