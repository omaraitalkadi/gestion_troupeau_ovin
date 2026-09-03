// server/middleware/authorize.js
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Non authentifié" });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Accès refusé — rôle insuffisant" });
    next();
  };
}

export function isAllowed(){
  
}