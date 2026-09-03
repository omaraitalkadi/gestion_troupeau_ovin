// Query helpers for table: consommation_alimentaire
import { getConsommationsAlimentaire } from '../services/AlimentationService.js';
import { makeCrud } from './_base.js';
import supabase from '../supabaseClient.js';

const crud = makeCrud('consommation_alimentaire');

export const consommationAlimentaireApi = {
  // --- generic CRUD ---
  list:   crud.list,    // ({ select, limit, offset, orderBy, ascending, filters }) -> { data, count }
  get:    crud.get,     // (id) -> row
  create: crud.create,  // (values | values[]) -> row | rows
  update: crud.update,  // (id, patch) -> row
  remove: crud.remove,  // (id) -> true
  count:  crud.count,   // (filters?) -> number
  findByIn: crud.findByIn,
  getOneBy: crud.getOneBy, //(filters,select?) -> row
  getBy:crud.getBy,
  findBy:crud.findBy,
  findOneBy:crud.findOneBy,

  // --- relationship lookups ---
  getByAnimalId: (animalId, options) => crud.findBy('animal_id', animalId, options),  // -> row[]
  getByAlimentId: (alimentId, options) => crud.findBy('aliment_id', alimentId, options),  // -> row[]
  getByDistributionId: (distributionId, options) => crud.findBy('distribution_id', distributionId, options),  // -> row[]
  getConsommationsAlimentaire: async (fermeId,filters)=>{
     let q=supabase.from("consommation_alimentaire")
  .select(`
    id,
    date_consommation,
    cout_unitaire,
    quantite,
    animal!inner(id)
  `);

  q.eq("animal.ferme_id", fermeId);
  for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
  const {data,error}=await q;

  


  if (error) {
    throw error
  }
  else return data
  }

};

export default consommationAlimentaireApi;
