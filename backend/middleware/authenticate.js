// server/middleware/authenticate.js
import { verifySession } from "../services/AuthService.js";

export async function authenticate(req, res, next) {
  const sessionId = req.signedCookies?.session_id;
  const ALLOWLIST = new Set(["PATCH /api/auth/password", "POST /api/auth/logout", "GET /api/auth/me"]);
// après avoir chargé req.user :
if (req.user.must_change_password && !ALLOWLIST.has(`${req.method} ${req.baseUrl}${req.path}`))
  return res.status(403).json({ error:"Changement de mot de passe requis.", code:"MUST_CHANGE_PASSWORD" 
});

  if (!sessionId) {
    console.log("non authentified ")
    return res.status(401).json({ error: "Non authentifié" });
  }

  const session = await verifySession(sessionId);

  if (!session) {
    res.clearCookie("session_id");
    return res.status(401).json({ error: "Session expirée ou invalide" });
  }

  req.user      = session.user;
  req.ferme_id=session.ferme_id;
  req.sessionId = sessionId;
  req.ferme=session.ferme;

  next();
}
