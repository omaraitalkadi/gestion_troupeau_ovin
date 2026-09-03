// server/services/EmailService.js
// Envoi d'emails via Resend (https://resend.com). Le SDK gère l'appel API ;
// la clé vient de l'environnement, jamais en dur.
//
// .env :
//   RESEND_API_KEY=re_xxxxxxxx
//   EMAIL_FROM="Ovinéa <no-reply@tondomaine.com>"   # domaine vérifié chez Resend
//   APP_NAME=Ovinéa
//
// ⚠️ En dev, sans domaine vérifié, Resend n'autorise l'envoi que vers TON
//    adresse de compte et depuis "onboarding@resend.dev". Vérifie un domaine
//    pour envoyer à de vrais utilisateurs.
import { Resend } from "resend";

const APP_NAME = process.env.APP_NAME || "Ovinéa";
const FROM      = process.env.EMAIL_FROM || "Ovinéa <onboarding@resend.dev>";

// Instancié paresseusement : si la clé manque, on le signale clairement au 1er envoi.
let _resend = null;
function client() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw Object.assign(new Error("RESEND_API_KEY manquante (configuration email)"), { status: 500 });
  _resend = new Resend(key);
  return _resend;
}

// Enveloppe HTML minimale et sobre (les clients email supportent mal le CSS avancé).
function gabarit({ titre, intro, encadre, pied }) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1f2421;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;padding:32px;max-width:440px;">
        <tr><td style="font-size:20px;font-weight:bold;padding-bottom:4px;">🐑 ${APP_NAME}</td></tr>
        <tr><td style="font-size:16px;font-weight:bold;padding:12px 0 4px;">${titre}</td></tr>
        <tr><td style="font-size:14px;line-height:1.5;color:#4a524c;">${intro}</td></tr>
        ${encadre ? `<tr><td align="center" style="padding:20px 0;">${encadre}</td></tr>` : ""}
        <tr><td style="font-size:12px;color:#8a908b;padding-top:16px;border-top:1px solid #eee;">${pied}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function envoyer({ to, subject, html }) {
  const { data, error } = await client().emails.send({ from: FROM, to, subject, html });
  if (error) {
    // Resend renvoie l'erreur dans `error` (pas un throw) → on la propage nous-mêmes.
    throw Object.assign(new Error(`Envoi email échoué : ${error.message || error.name || "inconnu"}`), { status: 502 });
  }
  return data; // { id }
}

/**
 * Code de vérification d'inscription (6 chiffres).
 * @param {string} email
 * @param {string} code   6 chiffres
 * @param {number} [ttlMin=20]
 */
export async function envoyerCodeVerification(email, code, ttlMin = 20) {
  const encadre = `
    <div style="font-size:30px;font-weight:bold;letter-spacing:8px;
                background:#f0f3ef;border-radius:10px;padding:14px 20px;display:inline-block;">
      ${code}
    </div>`;
  return envoyer({
    to: email,
    subject: `${APP_NAME} — Votre code de vérification`,
    html: gabarit({
      titre: "Confirmez votre adresse email",
      intro: `Voici le code pour finaliser la création de votre exploitation. Il expire dans <strong>${ttlMin} minutes</strong>.`,
      encadre,
      pied: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    }),
  });
}

/**
 * Lien de réinitialisation de mot de passe (admin uniquement).
 * @param {string} email
 * @param {string} lien  URL complète avec token
 */
export async function envoyerLienReset(email, lien) {
  const encadre = `
    <a href="${lien}" style="background:#2f6f4e;color:#fff;text-decoration:none;
       font-size:14px;font-weight:bold;border-radius:8px;padding:12px 22px;display:inline-block;">
      Réinitialiser mon mot de passe
    </a>`;
  return envoyer({
    to: email,
    subject: `${APP_NAME} — Réinitialisation du mot de passe`,
    html: gabarit({
      titre: "Réinitialiser votre mot de passe",
      intro: "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable une durée limitée.",
      encadre,
      pied: "Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.",
    }),
  });
}
