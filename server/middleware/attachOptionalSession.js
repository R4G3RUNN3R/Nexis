import { getSessionUser } from "../services/authService.js";

function readBearerToken(authorizationHeader) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function attachOptionalSession(req, _res, next) {
  try {
    const sessionToken = readBearerToken(req.headers.authorization);
    if (!sessionToken) {
      next();
      return;
    }

    const session = await getSessionUser(sessionToken);
    if (session) {
      req.auth = { sessionToken, ...session };
    }

    next();
  } catch (error) {
    next(error);
  }
}
