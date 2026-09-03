/**
 * Mapping arc exclusif → navigation.
 * SEUL fichier front à toucher quand un nouveau type d'entité alertable
 * est ajouté (avec la colonne SQL et le CHECK). Ne jamais disperser ce
 * switch dans les composants.
 *
 * ⚠️ Aligner les chemins sur les routes RÉELLEMENT déclarées dans le
 * routeur (ex. /troupeau/:id vs /animaux/:id).
 */
export function routeDepuisAlerte(alerte) {
  if (!alerte) return null;
  if (alerte.animal)  return `/troupeau/${alerte.animal.id}`;            // ✓ confirmé
  if (alerte.aliment) return `/alimentation/aliments/${alerte.aliment.id}`; // était /alimentation/:id → faux
  // Pas encore de pages détail pour ces entités → pas de navigation.
  // Ton fallback "*" redirige vers "/", donc une mauvaise route ne 404 pas :
  // elle envoie silencieusement au Dashboard — pire qu'un 404, on ne le voit pas.
  if (alerte.medicament)   return null;  // à brancher quand /sanitaire existera
  if (alerte.reproduction) return null;  // idem /reproduction
  return null;
}

/** Libellé humain de l'entité concernée (numéro légal, nom commercial…). */
export function libelleEntite(alerte) {
  if (!alerte) return null;
  return (
    alerte.animal?.numero_legal ??
    alerte.medicament?.nom_commercial ??
    alerte.aliment?.nom ??
    null
  );
}

/**
 * "il y a 2 h", "hier", puis date absolue au-delà de 7 jours.
 * Intl natif, pas de lib.
 */
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const dtf = new Intl.DateTimeFormat("fr-MA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateRelative(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMs / 3600000);
  const diffJ = Math.round(diffMs / 86400000);

  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");
  if (Math.abs(diffJ) <= 7) return rtf.format(diffJ, "day");
  return dtf.format(date);
}
