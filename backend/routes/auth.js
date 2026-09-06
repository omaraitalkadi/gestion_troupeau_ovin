// server/routes/auth.js — routes minces : validation d'entrée + appel service.
import express from "express";
import { login, logout, changePassword, signup } from "../services/AuthService.js";
import { authenticate } from "../middleware/authenticate.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimiter.js";
import dotenv from "dotenv";
import { demarrerInscription,confirmerInscription,renvoyerCode } from "../services/SignupService.js";
dotenv.config();

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  signed:   true,
  sameSite: "lax",
  secure:   process.env.NODE_ENV === "production",
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 jours
};

router.post("/signup/start",   signupLimiter, async (req,res,next)=>{ 
  try{ 
    res.json(await demarrerInscription(req.body,{ip:req.ip})); 
  }catch(e){
    next(e);
  } 
});


router.post("/signup/verify",  signupLimiter, async (req,res,next)=>{ 
  try{
   const { utilisateur, ferme_id, sessionId } = await confirmerInscription(req.body,{ip:req.ip,userAgent:req.headers["user-agent"]});
   res.cookie("session_id", sessionId, COOKIE_OPTS); res.status(201).json({ utilisateur, ferme_id });
  }catch(e){
    next(e);

  } 
});


router.post("/signup/resend",  signupLimiter, async (req,res,next)=>{ 
  try{ 
    res.json(await renvoyerCode(req.body)); }catch(e){
      next(e);

    } 
  });

// login : le body porte { identifiant, type: "admin"|"employe", password }
router.post("/login", loginLimiter, async (req,res,next)=>{ try{
  const { identifiant, type, password } = req.body;
  if (!identifiant || !password) return res.status(400).json({ error:"identifiant et password requis" });
  const { sessionId, user, mustChangePassword } = await login({ identifiant, type, password, ip:req.ip, userAgent:req.headers["user-agent"] });
  res.cookie("session_id", sessionId, COOKIE_OPTS);
  res.json({ user, mustChangePassword });
  }catch(e){
    next(e);

   } 
});
 

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await logout(req.sessionId);
    res.clearCookie("session_id");
    res.status(200).json({ message: "Déconnecté" });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/password
router.patch("/password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "currentPassword et newPassword requis" });

    await changePassword({ userId: req.user.id, currentPassword, newPassword });
    res.clearCookie("session_id"); // force re-login
    res.json({ message: "Mot de passe modifié. Veuillez vous reconnecter." });
  } catch (err) { next(err); }
});

export default router;