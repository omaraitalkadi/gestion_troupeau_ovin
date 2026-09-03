import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();
// Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enums
const sexes = ["MALE", "FEMELLE"];
const etats = ['SAIN', 'MALADE', 'SOUS_TRAITEMENT', 'ISOLE'];
const conditions = ["MAIGRE", "NORMALE", "GRASSE"];

// Helpers
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomDate = (startYear = 2018) => {
  const start = new Date(`${startYear}-01-01`).getTime();
  const end = Date.now();
  return new Date(start + Math.random() * (end - start)).toISOString();
};

// Generator
function generateAnimal() {
  return {
    numero_rfid: `RFID-${Math.floor(Math.random() * 1e8)}`,
    numero_legal: `NL-${Math.floor(Math.random() * 1e8)}`,
    sexe: pick(sexes),
    date_naissance: randomDate(2015),
    date_arrivee: randomDate(2022),
    date_sortie: Math.random() > 0.7 ? randomDate(2024) : null,
    race: pick(["Sardi", "Bergui", "D'man", "Crossbreed"]),
    poids: +(Math.random() * 80 + 20).toFixed(2),
    etat: pick(etats),
    condition_corporelle: pick(conditions),
    mere_id: null,
    pere_id: null,
    proprietaire_id: null
  };
}

// Seeder function (IMPORT THIS)
export async function seedAnimals(count = 20) {
  const animals = Array.from({ length: count }, generateAnimal);

  const { data, error } = await supabase
    .from("animal")
    .insert(animals)
    .select();

  if (error) throw error;

  console.log(`Inserted ${data.length} animals`);
  return data;
}

