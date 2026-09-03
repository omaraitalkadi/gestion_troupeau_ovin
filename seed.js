import { supabase } from "./backend/supabaseClient.js"; // Adjust the import to your project

async function createMissingDossiersMedicaux() {
  // Get all animals
  const { data: animals, error: animalsError } = await supabase
    .from("animal")
    .select("id");

  if (animalsError) {
    console.error("Error fetching animals:", animalsError);
    return;
  }

  // Get existing medical dossiers
  const { data: dossiers, error: dossiersError } = await supabase
    .from("dossier_medical")
    .select("animal_id");

  if (dossiersError) {
    console.error("Error fetching dossiers:", dossiersError);
    return;
  }

  // Existing animal IDs that already have a dossier
  const existingAnimalIds = new Set(dossiers.map(d => d.animal_id));

  // Prepare inserts
  const recordsToInsert = animals
    .filter(animal => !existingAnimalIds.has(animal.id))
    .map(animal => ({
      animal_id: animal.id,
    }));

  if (recordsToInsert.length === 0) {
    console.log("All animals already have a medical dossier.");
    return;
  }

  const { error: insertError } = await supabase
    .from("dossier_medical")
    .insert(recordsToInsert);

  if (insertError) {
    console.error("Error inserting dossiers:", insertError);
    return;
  }

  console.log(`Created ${recordsToInsert.length} medical dossiers.`);
}

createMissingDossiersMedicaux();