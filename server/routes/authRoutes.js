import { Router } from "express";
import { getMe, postLogin, postRegister } from "../controllers/authController.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/me", requireSession, getMe);

export default router;
