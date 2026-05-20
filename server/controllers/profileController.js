import path from "node:path";
import {
  getProfileForViewer,
  resolveProfileImagePath,
  updateOwnProfileImage,
  updateOwnPrestigeTitle,
} from "../services/profileService.js";

export async function getProfile(req, res, next) {
  try {
    const profile = await getProfileForViewer(req.auth?.user ?? null, req.params.publicId);
    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}

export async function postOwnProfileImage(req, res, next) {
  try {
    const result = await updateOwnProfileImage(req.auth?.user ?? null, req.file ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}


export async function postOwnPrestigeTitle(req, res, next) {
  try {
    const result = await updateOwnPrestigeTitle(req.auth?.user ?? null, req.body?.titleId ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProfileImage(req, res, next) {
  try {
    const imagePath = await resolveProfileImagePath(req.params.imageKey);
    const extension = path.extname(imagePath).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";

    res.setHeader("Cache-Control", "public, max-age=300");
    res.type(contentType);
    res.sendFile(imagePath, { dotfiles: "allow" });
  } catch (error) {
    next(error);
  }
}
