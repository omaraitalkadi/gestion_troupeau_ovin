// server/services/EmailService.js
// Envoi via Nodemailer + Gmail (App Password). Envoie depuis TON Gmail vers
// n'importe quel destinataire — pas de domaine à vérifier.
//
// Prérequis Google :
//   1. Validation en 2 étapes ACTIVÉE sur le compte Google.
//   2. Compte Google → Sécurité → "Mots de passe des applications" → générer
//      un mot de passe (16 caractères) pour "Mail".
//
// .env :
//   GMAIL_USER=tonadresse@gmail.com
//   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx      # le mot de passe d'application, PAS ton vrai mdp
//   APP_NAME=Ovinéa
//   EMAIL_FROM="Ovinéa <tonadresse@gmail.com>"   # optionnel ; défaut = GMAIL_USER
import nodemailer from "nodemailer";

const APP_NAME = process.env.APP_NAME || "Ovinéa";

// Transport créé paresseusement ; erreur claire si config manquante.
let _transport = null;
function transport() {
  if (_transport) return _transport;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass)
    throw Object.assign(new Error("GMAIL_USER / GMAIL_APP_PASSWORD manquants (config email)"), { status: 500 });
  _transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return _transport;
}

function from() {
  return process.env.EMAIL_FROM || `${APP_NAME} <${process.env.GMAIL_USER}>`;
}

// Gabarit HTML sobre (les clients mail supportent mal le CSS avancé).
function gabarit({ titre, intro, encadre, pied }) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1f2421;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;padding:32px;max-width:440px;">
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
  try {
    return await transport().sendMail({ from: from(), to, subject, html });
  } catch (e) {
    throw Object.assign(new Error(`Envoi email échoué : ${e.message}`), { status: 502 });
  }
}

/**
 * Code de vérification d'inscription (6 chiffres).
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
 * Lien de réinitialisation de mot de passe (admin).
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
      pied: "Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.",
    }),
  });
}