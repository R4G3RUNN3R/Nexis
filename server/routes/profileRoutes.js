import { Router } from "express";
import multer from "multer";
import {
  getProfile,
  getProfileImage,
  postOwnProfileImage,
  postOwnPrestigeTitle,
} from "../controllers/profileController.js";
import { HttpError } from "../lib/errors.js";
import { attachOptionalSession } from "../middleware/attachOptionalSession.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, "Profile image must be PNG, JPEG, or WEBP.", "PROFILE_IMAGE_TYPE_INVALID"));
      return;
    }

    callback(null, true);
  },
});

function handleProfileImageUpload(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "Profile image must be 2 MB or smaller.", "PROFILE_IMAGE_TOO_LARGE"));
      return;
    }

    next(error);
  });
}

router.get("/profiles/:publicId", attachOptionalSession, getProfile);
router.get("/profile-images/:imageKey", getProfileImage);
router.get("/me/profile", requireSession, (req, res) => res.redirect(307, `/api/profiles/${req.auth.user.publicId}`));
router.post("/me/profile-image", requireSession, handleProfileImageUpload, postOwnProfileImage);
router.post("/me/title", requireSession, postOwnPrestigeTitle);

export default router;
