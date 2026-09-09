import express from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "../controllers/supplierController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getSuppliers).post(createSupplier);
router.route("/:id").get(getSupplierById).put(updateSupplier).delete(deleteSupplier);

export default router;
