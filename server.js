// server.js — Serveur Express pour servir le build React (Ovinéa)
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";
import animalsRouter from "./backend/routes/animal.js";
import  usersRouter from "./backend/routes/utilisateur.js";
import  lotsRouter from "./backend/routes/lot.js";
import { randomBytes } from "crypto";
import authRouter         from "./backend/routes/auth.js";
import { apiLimiter }             from "./backend/middleware/rateLimiter.js";
import { authenticate } from "./backend/middleware/authenticate.js";
import  alimentation  from "./backend/routes/alimentation.js";
import  finance       from "./backend/routes/finance.js";
import { loadEnvFile } from 'node:process'
import './backend/jobs/alerte.js';  
import alereteApi from './backend/routes/alerts.js'
import sante from './backend/routes/sante.js'
import test from './backend/routes/testTemps.js'
import reproduction from './backend/routes/reproduction.js'
import dashboard from './backend/routes/route_dashboard.js';
import permissionModule from './backend/middleware/exigerPermissionModule.js';

 

loadEnvFile()




//dotenv.config();



 // signe les cookies



// __dirname n'existe pas en ESM — on le recrée
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 80;
const BUILD_DIR = path.join(__dirname, "dist"); // Vite => "dist", CRA => "build"
app.set("trust proxy",1)






// ─── Middlewares ─────────────────────────────────────────────
// Sécurité : en-têtes HTTP standards
app.use(
  helmet({
    contentSecurityPolicy: false, // À configurer selon tes besoins
  })
);

// Compression gzip/brotli
app.use(compression());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.json());
app.use(cookieParser(
 process.env.COOKIE_SECRET || randomBytes(32).toString("hex"),
)); 
app.use("/api",apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api",authenticate);


 



app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});


app.use("/api/alimentation",permissionModule('ALIMENTATION'),alimentation);
app.use("/api/finance",permissionModule('FINANCE'),finance);
app.use("/api/animals",permissionModule('TROUPEAU'), animalsRouter);
app.use("/api/utilisateur", usersRouter);
app.use("/api/lots",permissionModule('TROUPEAU'), lotsRouter);
app.use("/api/alertes",alereteApi);
app.use("/api/sante",permissionModule('SANTE'),sante);
app.use("/api/test",test);
app.use("/api/reproduction",permissionModule('REPRODUCTION'),reproduction);
app.use("/api/dashboard",dashboard);






// ─── Fichiers statiques ──────────────────────────────────────
// Sert /assets/*, /favicon.ico, etc. avec cache long pour les fichiers hashés
app.use(
  express.static(BUILD_DIR, {
    maxAge: "1y",
    etag: true,
    setHeaders: (res, filePath) => {
      // index.html ne doit JAMAIS être mis en cache
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  })
);

// Catch-all : renvoie index.html pour toute autre route 
// C'est ce qui permet à React Router de gérer /troupeau, /finance, etc.
// Sans ça, un refresh sur /finance renverrait un 404.
/*
 Cette route doit être définie en dernier afin de permettre
 aux autres routes d'être évaluées avant elle.
 Sinon, elle capturera toutes les requêtes GET.
 */
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(BUILD_DIR, "index.html"));
});

//await seedAnimals(20);

// ─── Démarrage ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Ovinéa server running on http://localhost:${PORT}`);

});
