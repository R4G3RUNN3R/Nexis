import { getSessionUser } from "../services/authService.js";
import { getProfileView } from "../services/profileService.js";

function readBearerToken(authorizationHeader) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function getProfile(req, res, next) {
  try {
    const token = readBearerToken(req.headers.authorization);
    const session = token ? await getSessionUser(token) : null;
    const profile = await getProfileView(session?.user ?? null, req.params.publicId);
    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}
