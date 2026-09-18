import express from "express";
import {
  convertQuotationToInvoice,
  createQuotation,
  deleteQuotation,
  getQuotationById,
  getQuotationMetrics,
  getQuotations,
  updateQuotationStatus,
} from "../controllers/quotationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/metrics", getQuotationMetrics);
router.route("/").get(getQuotations).post(createQuotation);
router.post("/:id/convert-to-invoice", convertQuotationToInvoice);
router.patch("/:id/status", updateQuotationStatus);
router.route("/:id").get(getQuotationById).delete(deleteQuotation);

export default router;
