import express from "express";
import {
  createUser,
  deleteUser,
  getMe,
  getUsers,
  loginUser,
  logoutUser,
  registerUser,
  updateUser,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.post("/logout", logoutUser);

router.get("/users", protect, getUsers);
router.post("/users", protect, createUser);
router.put("/users/:id", protect, updateUser);
router.delete("/users/:id", protect, deleteUser);

export default router;

