import { Router } from "express";
import {
  getMe,
  postForgotPassword,
  postLogin,
  postRegister,
  postResetPassword,
} from "../controllers/authController.js";
import { requireSession } from "../middleware/requireSession.js";
import { authRateLimit, passwordResetRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", authRateLimit, postRegister);
router.post("/login", authRateLimit, postLogin);
router.post("/forgot-password", passwordResetRateLimit, postForgotPassword);
router.post("/reset-password", passwordResetRateLimit, postResetPassword);
router.get("/me", requireSession, getMe);

export default router;
