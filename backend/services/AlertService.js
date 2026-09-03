// server/services/AlertService.js
import  supabase  from '../supabaseClient.js'

import { notificationApi } from '../tables/notification.js';
import { makeCrud } from '../tables/_base.js';
// Résolution polymorphique : quelle colonne libellé pour quelle table.
// null = pas de libellé nécessaire ({ id } suffit, aucune requête émise).
 const ENTITES_ALERTABLES = {
  animal:       "id, numero_legal",
  medicament:   "id, nom_commercial",
  aliment:      "id, nom",
  reproduction: null,
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

export const TypeAlerte = [
  "SANTE",
  "VACCINATION",
  "TRAITEMENT_ANTIPARASITAIRE",
  "REPRODUCTION_CHALEURS",
  "REPRODUCTION_MISE_BAS",
  "REPRODUCTION_INSEMINATION",
  "GESTATION_RETARD",
  "STOCK_ALIMENT_FAIBLE",
  "STOCK_MEDICAMENT_FAIBLE",
  "MOUVEMENT_ANIMAL",
  "PESEE_CONTROL",
  "ANOMALIE_SANTE",
  "SAUVEGARDE",
  "NOUVEAU_COMPTE"
];





const SELECT_NOTIFS = `id, lu, date_creation,
  alerte(id, type, priorite, titre, message, date_echeance,
    entite_nom, entite_id)`;

/**
 * @param {string} utilisateurId          req.user.id
 * @param {object} [opts]
 * @param {number} [opts.limit=20]         plafonné à 50
 * @param {boolean}[opts.lu]               true/false pour filtrer ; undefined = tout
 * @param {string} [opts.before]           curseur ISO : date_creation < before
 */
export async function listNotificationsForUser(utilisateurId, { limit = 20, lu, before } = {}) {
  // 1️⃣ Notifications + alerte
  const { data: notifications } = await notificationApi.list({
    select: SELECT_NOTIFS,
    withCount: false,
    filters: {
      utilisateur_id: utilisateurId,
      ...(typeof lu === 'boolean' ? { lu } : {}),
    },
    lt: before ? { date_creation: before } : undefined,
    orderBy: 'date_creation',
    ascending: false,
    limit: Math.min(limit, 50),
  });

  // 2️⃣ Regroupement des ids par type d'entité résoluble
  const idsParType = new Map(); // entite_nom -> Set<id>
  for (const n of notifications) {
    const { entite_nom, entite_id } = n.alerte ?? {};
    if (!entite_nom || !entite_id) continue;
    if (!(entite_nom in ENTITES_ALERTABLES)) continue;   // type inconnu → ignoré
    if (ENTITES_ALERTABLES[entite_nom] === null) continue; // pas de libellé à résoudre
    if (!idsParType.has(entite_nom)) idsParType.set(entite_nom, new Set());
    idsParType.get(entite_nom).add(entite_id);
  }

  // 3️⃣ Une requête batch par type présent, en parallèle, via la primitive findByIn
  const resolutions = await Promise.all(
    [...idsParType.entries()].map(async ([table, ids]) => {
      try {
        const rows = await makeCrud(table).findByIn('id', [...ids], {
          select: ENTITES_ALERTABLES[table],
        });
        return [table, new Map(rows.map((row) => [row.id, row]))];
      } catch (e) {
        console.log(`résolution ${table} error`, e);
        return [table, new Map()]; // dégradé : libellés absents, pas d'échec global
      }
    })
  );
  const entitesParType = new Map(resolutions); // entite_nom -> Map<id, row>

  // 4️⃣ Reconstruction : alerte.animal / alerte.medicament / alerte.aliment / alerte.reproduction
  return notifications.map((n) => {
    const alerte = { ...n.alerte };
    const { entite_nom, entite_id } = alerte;
    if (entite_nom && entite_id && entite_nom in ENTITES_ALERTABLES) {
      alerte[entite_nom] =
        ENTITES_ALERTABLES[entite_nom] === null
          ? { id: entite_id } // reproduction : l'id suffit pour la navigation
          : entitesParType.get(entite_nom)?.get(entite_id) ?? null;
    }
    delete alerte.entite_nom;
    delete alerte.entite_id;
    return { ...n, alerte };
  });
}
// ════════════════════════════════════════════════════════════
//  LIRE LES ALERTES
// ════════════════════════════════════════════════════════════
export async function getAlerts({ exploitationId, lue, niveau, page = 1, limit = 50 }) {
  let query = supabase
    .from("alerte")
    .select("*", { count: "exact" })
    .eq("ferme_id", exploitationId)
    .order("lue",         { ascending: true })
    .order("date_echeance", { ascending: true, nullsFirst: false })
    .order("date_creation",  { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (lue   !== undefined) query = query.eq("lue",    lue);
  if (niveau)              query = query.eq("niveau", niveau);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getUnreadCount(exploitationId) {
  const { count, error } = await supabase
    .from("alerte")
    .select("*", { count: "exact", head: true })
    .eq("exploitation_id", exploitationId)
    .eq("lue", false);

  if (error) throw error;
  return count ?? 0;
}

// ════════════════════════════════════════════════════════════
//  MARQUER COMME LUE
// ════════════════════════════════════════════════════════════
export async function markRead(alertId, exploitationId) {
  const { data, error } = await supabase
    .from("alerte")
    .update({ lue: true, date_lecture: new Date().toISOString() })
    .eq("id", alertId)
    .eq("exploitation_id", exploitationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markAllRead(exploitationId) {
  const { error } = await supabase
    .from("alerte")
    .update({ lue: true, date_lecture: new Date().toISOString() })
    .eq("exploitation_id", exploitationId)
    .eq("lue", false);

  if (error) throw error;
}

export async function deleteAlert(alertId, exploitationId) {
  const { error } = await supabase
    .from("alerte")
    .delete()
    .eq("id", alertId)
    .eq("exploitation_id", exploitationId);

  if (error) throw error;
}

// ════════════════════════════════════════════════════════════
//  GÉNÉRATION AUTOMATIQUE DES ALERTES
//  Appelé par le cron job toutes les heures
// ════════════════════════════════════════════════════════════
// Routing: quel rôle reçoit quel type
const ROUTAGE = {
  SANTE:                    ['ADMINISTRATEUR', 'VETERINAIRE'],
  VACCINATION:              ['ADMINISTRATEUR', 'VETERINAIRE', 'OPERATEUR'],
  REPRODUCTION_MISE_BAS:    ['ADMINISTRATEUR', 'OPERATEUR'],
  GESTATION_RETARD:         ['ADMINISTRATEUR', 'VETERINAIRE'],
  STOCK_ALIMENT_FAIBLE:     ['ADMINISTRATEUR', 'OPERATEUR'],
  STOCK_MEDICAMENT_FAIBLE:  ['ADMINISTRATEUR', 'VETERINAIRE'],
  MEDICAMENT_PERIME:        ['ADMINISTRATEUR', 'VETERINAIRE'],
  // ...
};

export async function creerAlerte({ fermeId, type, priorite = 'FAIBLE',
                                    titre, message, entiteName, entiteId,
                                    dateEcheance = null }) {
  // 1. Insert dédupliqué — le conflit sur l'index partiel = alerte déjà active
  const { data: alerte, error } = await supabase
    .from('alerte')
    .upsert(
      {
        ferme_id: fermeId, type, priorite, titre, message,
        entite_nom: entiteName, entite_id: entiteId, date_echeance: dateEcheance
       }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!alerte) return null; // déjà active, rien à faire

  // 2. Fan-out
 // const roles = ROUTAGE[type] ?? ['ADMINISTRATEUR'];
  const { data: users } = await supabase
    .from('utilisateur')
    .select('id')
    .eq('ferme_id', fermeId);

  if (users?.length) {
    await supabase.from('notification').insert(
      users.map(u => ({ alerte_id: alerte.id, utilisateur_id: u.id,titre ,message}))
    );
  }
  return alerte;
}




// ── Helper : insérer l'alerte seulement si elle n'existe pas déjà ──
async function upsertAlert(alert) {
  const { data: existing } = await supabase
    .from("alerte")
    .select("id")
    .eq("exploitation_id", alert.exploitation_id)
    .eq("type",            alert.type)
    .eq("animal_id",       alert.animal_id ?? null)
    .eq("lue",             false)
    .maybeSingle();

  if (existing) return; // déjà présente, pas de doublon

  await supabase.from("alerte").insert(alert);
}
export async function marquerLue({ notificationId, utilisateurId }) {
  const { data, error } = await supabase
    .from('notification')
    .update({ lu: true, date_lecture: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('utilisateur_id', utilisateurId)   // scoping dans le WHERE, pas en check préalable
    .eq('lu', false)                        // idempotence : ne réécrit pas date_lecture
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data; // null = inexistante, pas à lui, ou déjà lue
}

export async function toutMarquerLu({ utilisateurId }) {
  const { data, error } = await supabase
    .from('notification')
    .update({ lu: true, date_lecture: new Date().toISOString() })
    .eq('utilisateur_id', utilisateurId)
    .eq('lu', false)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
/**
 * Nombre de notifications non lues d'un utilisateur (badge).
 * @param {string} utilisateurId  req.user.id
 */
export async function countUnreadNotificationsForUser(utilisateurId) {
  return notificationApi.count({ utilisateur_id: utilisateurId, lu: false });
}
