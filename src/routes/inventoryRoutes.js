import express from "express";
import {
  createStockAdjustment,
  getInventoryMetrics,
  getLowStockList,
  getStockAdjustments,
  getStockList,
  getStockTransactions,
} from "../controllers/inventoryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/metrics", getInventoryMetrics);
router.get("/stock", getStockList);
router.get("/low-stock", getLowStockList);
router.get("/transactions", getStockTransactions);
router.route("/adjustments").get(getStockAdjustments).post(createStockAdjustment);

export default router;
