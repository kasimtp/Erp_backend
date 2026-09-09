import express from "express";
import {
  createPurchase,
  deletePurchase,
  getPurchaseById,
  getPurchaseMetrics,
  getPurchases,
  recordSupplierPayment,
} from "../controllers/purchaseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/metrics", getPurchaseMetrics);
router.route("/").get(getPurchases).post(createPurchase);
router.route("/:id").get(getPurchaseById).delete(deletePurchase);
router.post("/:id/payments", recordSupplierPayment);

export default router;
