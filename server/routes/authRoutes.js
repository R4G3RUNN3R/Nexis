import { Router } from "express";
import {
  getAuthIdentities,
  getGoogleAuthConfig,
  getMe,
  postForgotPassword,
  postGoogleAuth,
  postGoogleCompleteRegistration,
  postGoogleLink,
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

router.get("/auth/google/config", getGoogleAuthConfig);
router.post("/auth/google", authRateLimit, postGoogleAuth);
router.post("/auth/google/complete-registration", authRateLimit, postGoogleCompleteRegistration);
router.post("/auth/google/link", authRateLimit, requireSession, postGoogleLink);
router.get("/auth/identities", requireSession, getAuthIdentities);

export default router;
