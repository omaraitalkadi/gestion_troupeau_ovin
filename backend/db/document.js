import { supabase } from './client.js';

// ════════════════════════════════════════════
// DOCUMENT (base)
// ════════════════════════════════════════════

export async function getDocumentById(id) {
  const { data, error } = await supabase
    .from('document')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getDocumentsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('document')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDocumentsByType(type) {
  const { data, error } = await supabase
    .from('document')
    .select('*, animal(id, numero_rfid, numero_legal)')
    .eq('type', type)
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteDocument(id) {
  const { error } = await supabase.from('document').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// REGISTRE D'ÉLEVAGE
// ════════════════════════════════════════════

export async function createRegistreElevage(data) {
  const { data: result, error } = await supabase
    .from('registre_elevage')
    .insert([{ ...data, type: 'REGISTRE_ELEVAGE' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getAllRegistres() {
  const { data, error } = await supabase
    .from('registre_elevage')
    .select('*')
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRegistresByPeriode(periode) {
  const { data, error } = await supabase
    .from('registre_elevage')
    .select('*')
    .ilike('periode', `%${periode}%`);
  if (error) throw error;
  return data;
}

export async function updateRegistreElevage(id, updates) {
  const { data, error } = await supabase
    .from('registre_elevage')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// CARNET SANITAIRE
// ════════════════════════════════════════════

export async function createCarnetSanitaire(data) {
  const { data: result, error } = await supabase
    .from('carnet_sanitaire')
    .insert([{ ...data, type: 'CARNET_SANITAIRE' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getCarnetSanitaireByNumero(numero) {
  const { data, error } = await supabase
    .from('carnet_sanitaire')
    .select('*, animal(id, numero_rfid, numero_legal)')
    .eq('numero', numero)
    .single();
  if (error) throw error;
  return data;
}

export async function getCarnetsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('carnet_sanitaire')
    .select('*')
    .eq('animal_id', animalId);
  if (error) throw error;
  return data;
}

export async function updateCarnetSanitaire(id, updates) {
  const { data, error } = await supabase
    .from('carnet_sanitaire')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// DOCUMENT DE TRANSPORT
// ════════════════════════════════════════════

export async function createDocumentTransport(data) {
  const { data: result, error } = await supabase
    .from('document_transport')
    .insert([{ ...data, type: 'TRANSPORT' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getDocumentsTransportByAnimal(animalId) {
  const { data, error } = await supabase
    .from('document_transport')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_creation', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDocumentsTransportByDestination(destination) {
  const { data, error } = await supabase
    .from('document_transport')
    .select('*, animal(id, numero_rfid, numero_legal)')
    .ilike('destination', `%${destination}%`);
  if (error) throw error;
  return data;
}

export async function updateDocumentTransport(id, updates) {
  const { data, error } = await supabase
    .from('document_transport')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
