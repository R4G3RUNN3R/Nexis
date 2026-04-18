import { Router } from "express";
import { getProfile } from "../controllers/profileController.js";

const router = Router();

router.get("/profiles/:publicId", getProfile);

export default router;
