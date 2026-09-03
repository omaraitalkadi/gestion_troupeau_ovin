// server/middleware/rateLimiter.js
import rateLimit from "express-rate-limit";


// ── API générale : 200 req / min par IP ──────────────────
export const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Trop de requêtes. Ralentissez." },
});



// ── Login : 10 tentatives / 15 min par IP ────────────────
export const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              15,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
  skipSuccessfulRequests: true,
  //prevent password guessing 
  keyGenerator:(req) => {
    const body=req.body;
    const email = (typeof body?.email ==='string'? body.email : "global").toLowerCase().trim();
    return email;
  }
});

export const signupLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
  skipSuccessfulRequests: true
});