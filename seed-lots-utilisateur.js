/**
 * scripts/seed-animaux-par-lot.js
 *
 * Récupère le premier utilisateur (même logique que
 * seed-lots-premier-utilisateur.js), retrouve tous les lots de sa ferme,
 * et crée entre 10 et 20 animaux aléatoires par lot.
 *
 * Pour chaque animal créé, enregistre aussi un mouvement TRANSFERT
 * (lot_origine_id: null, lot_dest_id: lot.id) via enregistrerMouvement,
 * pour rester cohérent avec ce que fait POST /api/animals en production.
 *
 * HYPOTHÈSES (mêmes que le script précédent, + ceci) :
 *   - db.lot.getByFermeId(fermeId) existe, même convention que
 *     animalApi.getByFermeId (crud.findBy('ferme_id', fermeId))
 *   - db.animal.create(values[]) accepte un tableau (insert en lot)
 *   - la table animal a les colonnes : numero_rfid, numero_legal, sexe,
 *     race, date_naissance, date_arrivee, poids, etat_animal,
 *     condition_corporelle, status_animal, ferme_id, lot_id
 *   - pas de contrainte NOT NULL sur des colonnes non listées ici
 *     (mere_id/pere_id restent null — ce ne sont pas des animaux nés
 *     sur la ferme via une vraie Reproduction, juste des données de seed)
 *
 * Ce script n'a PAS de rollback si un mouvement échoue après la création
 * d'un animal : il log un avertissement et continue, plutôt que de
 * compenser comme le fait la route de production (annulerait tout
 * l'intérêt d'un seed rapide). Si un animal se retrouve sans mouvement
 * d'entrée, il faudra le rattraper manuellement.
 *
 * Usage :
 *   node scripts/seed-animaux-par-lot.js
 */

import { randomUUID } from 'node:crypto';
import db from './backend/tables/index.js';
import { enregistrerMouvement } from './backend/services/animal.js';

const MIN_PAR_LOT = 10;
const MAX_PAR_LOT = 20;

const RACES = ['Sardi', 'Timahdite', "D'man", 'Boujaad', 'Beni Guil', 'Sardi-Ouled Djellal'];
const ETATS_PONDERES = ['SAIN',  'MALADE', 'SOUS_TRAITEMENT', 'ISOLE'];
const CONDITIONS_PONDEREES = ['NORMALE', 'MAIGRE', 'GRASSE'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function randDateNaissance() {
  // entre 0 et 5 ans avant aujourd'hui
  const joursEnArriere = randInt(0, 5 * 365);
  const d = new Date();
  d.setDate(d.getDate() - joursEnArriere);
  return d.toISOString().slice(0, 10);
}

function genererAnimal(fermeId, lotId) {
  const suffixe = randomUUID().slice(0, 8).toUpperCase();
  const dateNaissance = randDateNaissance();
  const sexe = Math.random() < 0.65 ? 'FEMELLE' : 'MALE';

  return {
    numero_rfid: `FR-${suffixe}`,
    numero_legal: `LEG-${suffixe}`,
    sexe,
    race: pick(RACES),
    date_naissance: dateNaissance,
    date_arrivee: dateNaissance,
    poids: Number((randInt(150, 900) / 10).toFixed(1)), // 15.0 – 90.0 kg
    etat: pick(ETATS_PONDERES),
    condition_corporelle: pick(CONDITIONS_PONDEREES),
    status: 'ACTIF',
    ferme_id: fermeId,
    lot_id: lotId,
  };
}

async function main() {
  // ── 1. Premier utilisateur + sa ferme ───────────────────────────────────
  const { data: utilisateurs } = await db.utilisateur.list({
    limit: 1,
    orderBy: 'date_creation',
    ascending: true,
  });

  const utilisateur = utilisateurs?.[0];
  if (!utilisateur) {
    console.error("Aucun utilisateur trouvé — la table 'utilisateur' est vide.");
    process.exit(1);
  }
  if (!utilisateur.ferme_id) {
    console.error(`L'utilisateur ${utilisateur.id} n'a pas de ferme_id associé.`);
    process.exit(1);
  }

  console.log(`Utilisateur : ${utilisateur.nom ?? utilisateur.email ?? utilisateur.id} (ferme_id=${utilisateur.ferme_id})`);

  // ── 2. Lots de cette ferme ───────────────────────────────────────────────
  const lots = await db.lot.getByFermeId(utilisateur.ferme_id);
  if (!lots || lots.length === 0) {
    console.error(
      "Aucun lot trouvé pour cette ferme — exécute d'abord seed-lots-premier-utilisateur.js."
    );
    process.exit(1);
  }
  console.log(`${lots.length} lot(s) trouvé(s) : ${lots.map((l) => l.nom).join(', ')}`);

  // ── 3. Animaux par lot ───────────────────────────────────────────────────
  let totalAnimaux = 0;
  let totalMouvementsEchoues = 0;

  for (const lot of lots) {
    const nbAnimaux = randInt(MIN_PAR_LOT, MAX_PAR_LOT);
    const payload = Array.from({ length: nbAnimaux }, () => genererAnimal(utilisateur.ferme_id, lot.id));

    const animauxCrees = await db.animal.create(payload);
    const liste = Array.isArray(animauxCrees) ? animauxCrees : [animauxCrees];

    console.log(`  ${lot.nom} : ${liste.length} animaux créés`);
    totalAnimaux += liste.length;

    for (const animal of liste) {
      try {
        await enregistrerMouvement({
          animal_id: animal.id,
          type: 'TRANSFERT',
          lot_origine_id: null,
          lot_dest_id: lot.id,
          description: 'Introduction initiale à la ferme (seed)',
          date_mouvement: animal.date_arrivee,
        });
      } catch (err) {
        totalMouvementsEchoues += 1;
        console.warn(`    ⚠ Mouvement non créé pour l'animal ${animal.id} : ${err.message}`);
      }
    }
  }

  console.log(`\nTerminé : ${totalAnimaux} animaux créés au total sur ${lots.length} lot(s).`);
  if (totalMouvementsEchoues > 0) {
    console.warn(`${totalMouvementsEchoues} mouvement(s) d'introduction n'ont pas pu être enregistrés — voir les avertissements ci-dessus.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Échec du script :', err.message);
    process.exit(1);
  });