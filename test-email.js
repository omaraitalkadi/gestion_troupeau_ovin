// test-email.js — test isolé de l'envoi email (Nodemailer + Gmail).
// À placer dans server/ (ajuste le chemin d'import selon ton arborescence).
//
// Usage :
//   1. npm install nodemailer dotenv
//   2. .env : GMAIL_USER, GMAIL_APP_PASSWORD, APP_NAME
//   3. node test-email.js  destinataire@exemple.com
//      (avec Gmail App Password : n'importe quel destinataire fonctionne)
import dotenv from "dotenv";
dotenv.config();
import { envoyerCodeVerification } from "./backend/services/EmailService.js"; // ← ajuste le chemin

const destinataire = process.argv[2];
if (!destinataire) {
  console.error("Usage : node test-email.js  destinataire@exemple.com");
  process.exit(1);
}

console.log("GMAIL_USER présent :", !!process.env.GMAIL_USER);
console.log("GMAIL_APP_PASSWORD présent :", !!process.env.GMAIL_APP_PASSWORD);
console.log("Envoi d'un code de test à", destinataire, "…");

try {
  const r = await envoyerCodeVerification(destinataire, "123456", 20);
  console.log("✅ Envoyé. messageId :", r?.messageId ?? r);
} catch (e) {
  console.error("❌ Échec :", e.message);
  console.error("   → 2-Step activé ? App Password (pas le vrai mdp) ? GMAIL_USER correct ?");
}
