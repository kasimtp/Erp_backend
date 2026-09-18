import express from "express";
import {
  convertQuotationToInvoice,
  createSale,
  deleteSale,
  getQuotationMetrics,
  getSaleById,
  getSales,
  getSalesMetrics,
  recordPayment,
  updateSaleStatus,
} from "../controllers/salesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/metrics", getSalesMetrics);
router.get("/quotations/metrics", getQuotationMetrics);
router.route("/").get(getSales).post(createSale);
router.post("/:id/convert-to-invoice", convertQuotationToInvoice);
router.patch("/:id/status", updateSaleStatus);
router.route("/:id").get(getSaleById).delete(deleteSale);
router.post("/:id/payments", recordPayment);

export default router;

