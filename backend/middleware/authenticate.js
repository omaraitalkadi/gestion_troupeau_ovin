// server/middleware/authenticate.js
import { verifySession } from "../services/AuthService.js";

export async function authenticate(req, res, next) {
  const sessionId = req.signedCookies?.session_id;

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
