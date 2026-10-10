import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/authController";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  registerValidation,
  loginValidation,
  profileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../validators/auth";

const router = Router();

router.post("/register", registerValidation, asyncHandler(register));
router.post("/login", loginValidation, asyncHandler(login));
router.post("/refresh-token", asyncHandler(refreshToken));
router.get("/me", authenticate, asyncHandler(getMe));
router.put("/profile", authenticate, profileValidation, asyncHandler(updateProfile));
router.post("/forgot-password", forgotPasswordValidation, asyncHandler(forgotPassword));
router.post("/reset-password", resetPasswordValidation, asyncHandler(resetPassword));

export default router;
