import { supabase } from './client.js';

// ════════════════════════════════════════════
// TRANSACTION FINANCIÈRE (base)
// ════════════════════════════════════════════

export async function getTransactionById(id) {
  const { data, error } = await supabase
    .from('transaction_financiere')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllTransactions({ type } = {}) {
  let query = supabase.from('transaction_financiere').select('*');
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTransactionsByDateRange(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('transaction_financiere')
    .select('*')
    .gte('date_transaction', dateDebut)
    .lte('date_transaction', dateFin)
    .order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transaction_financiere').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// COÛT
// ════════════════════════════════════════════

export async function createCout(data) {
  const { data: result, error } = await supabase
    .from('cout')
    .insert([{ ...data, type: 'COUT' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getCoutsByAnimal(animalId) {
  const { data, error } = await supabase
    .from('cout')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCoutsByCategorie(categorie) {
  const { data, error } = await supabase
    .from('cout')
    .select('*')
    .eq('categorie', categorie)
    .order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTotalCoutsAnimal(animalId) {
  const { data, error } = await supabase
    .from('cout')
    .select('montant')
    .eq('animal_id', animalId);
  if (error) throw error;
  return data.reduce((sum, c) => sum + (c.montant || 0), 0);
}

export async function updateCout(id, updates) {
  const { data, error } = await supabase
    .from('cout')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// REVENU
// ════════════════════════════════════════════

export async function createRevenu(data) {
  const { data: result, error } = await supabase
    .from('revenu')
    .insert([{ ...data, type: 'REVENU' }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getRevenusByAnimal(animalId) {
  const { data, error } = await supabase
    .from('revenu')
    .select('*')
    .eq('animal_id', animalId)
    .order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRevenusBySource(source) {
  const { data, error } = await supabase
    .from('revenu')
    .select('*')
    .eq('source', source)
    .order('date_transaction', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTotalRevenusAnimal(animalId) {
  const { data, error } = await supabase
    .from('revenu')
    .select('montant')
    .eq('animal_id', animalId);
  if (error) throw error;
  return data.reduce((sum, r) => sum + (r.montant || 0), 0);
}

export async function updateRevenu(id, updates) {
  const { data, error } = await supabase
    .from('revenu')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ════════════════════════════════════════════
// BUDGET
// ════════════════════════════════════════════

export async function createBudget(data) {
  const { data: result, error } = await supabase
    .from('budget')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getBudgetById(id) {
  const { data, error } = await supabase
    .from('budget')
    .select('*, transaction_financiere(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllBudgets() {
  const { data, error } = await supabase
    .from('budget')
    .select('*')
    .order('periode', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBudgetByPeriode(periode) {
  const { data, error } = await supabase
    .from('budget')
    .select('*, transaction_financiere(*)')
    .eq('periode', periode)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBudget(id, updates) {
  const { data, error } = await supabase
    .from('budget')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budget').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ════════════════════════════════════════════
// CALCUL RENTABILITÉ ANIMAL
// ════════════════════════════════════════════

export async function getRentabiliteAnimal(animalId) {
  const [couts, revenus] = await Promise.all([
    getTotalCoutsAnimal(animalId),
    getTotalRevenusAnimal(animalId),
  ]);
  return {
    animalId,
    totalCouts: couts,
    totalRevenus: revenus,
    marge: revenus - couts,
  };
}
