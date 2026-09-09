import express from "express";
import {
  getCustomerLedgerReport,
  getExpenseReport,
  getInventoryReport,
  getProfitLossReport,
  getPurchaseReport,
  getSalesReport,
  getSupplierLedgerReport,
} from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/sales",            getSalesReport);
router.get("/purchases",        getPurchaseReport);
router.get("/inventory",        getInventoryReport);
router.get("/expenses",         getExpenseReport);
router.get("/profit-loss",      getProfitLossReport);
router.get("/customer-ledger",  getCustomerLedgerReport);
router.get("/supplier-ledger",  getSupplierLedgerReport);

export default router;
