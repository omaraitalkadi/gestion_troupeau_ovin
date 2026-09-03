// server/routes/dashboard.js — GET /api/dashboard
import { Router } from "express";
import { getDashboard } from "../services/DashboardService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ data: await getDashboard(req.user.ferme_id) });
  } catch (e) { next(e); }
});

export default router;
// Monter : app.use("/api/dashboard", authenticate, dashboardRouter);
