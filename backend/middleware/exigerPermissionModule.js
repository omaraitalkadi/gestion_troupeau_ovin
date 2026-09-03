// server/middleware/permission.js
// Fabrique un middleware de permission PAR MODULE, injecté sur un routeur.
// Mappe la MÉTHODE HTTP → action requise :
//   GET / HEAD                    → LIRE
//   POST / PATCH / PUT / DELETE   → ECRIRE
// L'admin (ADMINISTRATEUR) passe toujours (tous droits, matrice non stockée).
//
// Usage (monter sur tout le routeur d'un module) :
//   import { permissionModule } from "../middleware/permission.js";
//   app.use("/api/finance", authenticate, permissionModule("FINANCE"), financeRouter);
//
// ou par route :
//   router.get("/", permissionModule("TROUPEAU"), handler);
import { db } from "../tables/index.js";

const forbidden = (m) => Object.assign(new Error(m), { status: 403 });

// Méthode → action de permission
const ACTION_PAR_METHODE = {
  GET: "LIRE", HEAD: "LIRE", OPTIONS: "LIRE",
  POST: "ECRIRE", PATCH: "ECRIRE", PUT: "ECRIRE", DELETE: "ECRIRE",
};

export function permissionModule(module) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return next(forbidden("Non authentifié."));

      // Admin : tous les droits, aucun contrôle de matrice.
      if (user.role === "ADMINISTRATEUR") return next();

      const action = ACTION_PAR_METHODE[req.method];
      if (!action) return next(forbidden(`Méthode ${req.method} non autorisée.`));

      // Permissions de l'utilisateur (mises en cache sur req.user pour ne pas
      // refaire la requête à chaque middleware de la même requête).
      if (!user._permissions) {
        const rows = await db.utilisateurPermission.findBy("utilisateur_id", user.id, {
          select: "module, action, accorde",
        });
        user._permissions = Array.isArray(rows) ? rows : (rows?.data ?? []);
      }

      const accorde = user._permissions.some(
        (p) => p.module === module && p.action === action && p.accorde === true
      );
      if (!accorde) {
        return next(forbidden(
          `Permission refusée : ${action} sur ${module} non accordé.`
        ));
      }
      next();
    } catch (e) { next(e); }
  };
}
