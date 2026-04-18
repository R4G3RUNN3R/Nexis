import { getSessionUser } from "../services/authService.js";

function readBearerToken(authorizationHeader) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function requireSession(req, res, next) {
  try {
    const sessionToken = readBearerToken(req.headers.authorization);
    if (!sessionToken) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const session = await getSessionUser(sessionToken);
    if (!session) {
      res.status(401).json({ error: "Session expired or invalid." });
      return;
    }

    req.auth = { sessionToken, ...session };
    next();
  } catch (error) {
    next(error);
  }
}
