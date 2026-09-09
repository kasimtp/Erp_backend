import express from "express";
import {
  createSale,
  deleteSale,
  getSaleById,
  getSales,
  getSalesMetrics,
  recordPayment,
} from "../controllers/salesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/metrics", getSalesMetrics);
router.route("/").get(getSales).post(createSale);
router.route("/:id").get(getSaleById).delete(deleteSale);
router.post("/:id/payments", recordPayment);

export default router;
