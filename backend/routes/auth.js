// server/routes/auth.js — routes minces : validation d'entrée + appel service.
import express from "express";
import { login, logout, changePassword, signup } from "../services/AuthService.js";
import { authenticate } from "../middleware/authenticate.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimiter.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  signed:   true,
  sameSite: "lax",
  secure:   process.env.NODE_ENV === "production",
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 jours
};

// POST /api/auth/signup
router.post("/signup", signupLimiter, async (req, res, next) => {
  try {
    const { utilisateur, ferme, sessionId } =  await signup(req.body, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.cookie("session_id", sessionId, COOKIE_OPTS);
    res.status(201).json({ utilisateur, ferme_id: ferme.id });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { identifiant, type, password } = req.body;
    if (!identifiant || !password)
      return res.status(400).json({ error: "identifiant et password requis" });
 
    const { sessionId, user, mustChangePassword } = await login({
      identifiant, type, password,
      ip: req.ip, userAgent: req.headers["user-agent"],
    });
 
    res.cookie("session_id", sessionId, COOKIE_OPTS);
    res.json({ user, mustChangePassword });
  } catch (err) { next(err); }
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