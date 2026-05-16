import { Router } from "express";
import {
  getMe,
  postForgotPassword,
  postLogin,
  postRegister,
  postResetPassword,
} from "../controllers/authController.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.post("/forgot-password", postForgotPassword);
router.post("/reset-password", postResetPassword);
router.get("/me", requireSession, getMe);

export default router;
