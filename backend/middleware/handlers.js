// server/middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  const status  = err.status ?? 500;
  const message = err.message ?? "Erreur interne du serveur";

  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err);
  }

  res.status(status).json({ error: message });
}

// server/middleware/notFound.js
export function notFound(req, res) {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
}
