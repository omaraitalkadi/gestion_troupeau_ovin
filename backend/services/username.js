// server/services/username.js
// Username FERME-SCOPÉ : "<partie-locale-ou-nom>@<ferme_underscored>[-N]".
// Portée dans la valeur → unicité globale ; le suffixe -N garantit l'unicité
// réelle (le nom de ferme n'étant pas unique en base).
import { db } from "../tables/index.js";

// "Ferme Atlas" -> "ferme_atlas" ; accents retirés
const fermeSlug = (s) =>
  String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "ferme";

// partie avant @ d'un email, ou slug d'un nom
const partieBase = (s) =>
  String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40) || "user";

/**
 * @param {string} base       admin → email (on prend la partie locale) ; employé → nom choisi
 * @param {string} fermeNom   nom de la ferme (préfixe de portée)
 * @returns {Promise<string>} username unique, vérifié en base
 */
export async function genererUsername(base, fermeNom) {
  const candidatBase = `${partieBase(base)}@${fermeSlug(fermeNom)}`;
  for (let n = 1; n < 1000; n++) {
    const candidat = n === 1 ? candidatBase : `${candidatBase}-${n}`;
    const existant = await db.utilisateur.findOneBy("username", candidat, { select: "id" });
    if (!existant) return candidat;
  }
  return `${candidatBase}-${Math.random().toString(36).slice(2, 8)}`;
}