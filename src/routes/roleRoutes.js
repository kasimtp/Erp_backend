import express from "express";
import {
  createRole,
  deleteRole,
  getRoleById,
  getRoles,
  updateRole,
} from "../controllers/roleController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getRoles).post(createRole);
router.route("/:id").get(getRoleById).put(updateRole).delete(deleteRole);

export default router;
