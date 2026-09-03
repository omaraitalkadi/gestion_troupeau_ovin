// server/routes/alerts.js
import express from "express";
import * as AlertService from "../services/AlertService.js";
import supabase from "../supabaseClient.js";

const router = express.Router();

// GET /api/alerts
router.get("/", async (req, res, next) => {
  try {
    const { lue, niveau, page, limit } = req.query;
    const result = await AlertService.getAlerts({
      exploitationId: req.user.exploitation_id,
      lue:    lue   !== undefined ? lue === "true" : undefined,
      niveau: niveau || undefined,
      page:   Number(page  ?? 1),
      limit:  Number(limit ?? 50),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/alerts/count
router.get("/count", async (req, res, next) => {
  try {
    const count = await AlertService.getUnreadCount(req.user.exploitation_id);
    res.json({ count });
  } catch (err) { next(err); }
});




router.get("/notifications", async (req, res, next) => {
  try {
    const lu =
      req.query.lu === "true"  ? true  :
      req.query.lu === "false" ? false : undefined;

    const payload = await AlertService.listNotificationsForUser(req.user.id, {
      limit: parseInt(req.query.limit) || 20,
      lu,
      before: req.query.before,
    });

    res.json(payload);
  } catch (e) {
    next(e);
  }
});
router.get('/notifications/count', async (req, res, next) => {
  try {
    const count = await AlertService.countUnreadNotificationsForUser(req.user.id);
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

router.patch('/notifications/:id/lu',async (req,res)=> {
   try {
    const { id } = req.params;
    await AlertService.marquerLue({ notificationId: id, utilisateurId: req.user.id });
    return res.status(204).end();
  } catch (e) { next(e); }
} );   
router.patch('/notifications/tout-lu',async (req,res)=> {
   try {
    const count = await AlertService.toutMarquerLu({ utilisateurId: req.user.id });
    res.json({ marquees: count });
  } catch (e) { next(e); }
} );    
export default router;
