import express from "express";
import {
  createExpense,
  deleteExpense,
  getExpenseMetrics,
  getExpenses,
  updateExpense,
} from "../controllers/expenseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/metrics", getExpenseMetrics);
router.get("/",        getExpenses);
router.post("/",       createExpense);
router.put("/:id",     updateExpense);
router.delete("/:id",  deleteExpense);

export default router;
