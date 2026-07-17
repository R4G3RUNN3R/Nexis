import { ALLOWED_ORIGINS, APP_BASE_URL } from "../config/env.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostFromUrl(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

const configuredOrigins = new Set([APP_BASE_URL, ...ALLOWED_ORIGINS].filter(Boolean));
const configuredHosts = new Set([...configuredOrigins].map(hostFromUrl).filter(Boolean));

function normalizeHost(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function isAllowedOrigin(origin, requestHost) {
  if (!origin) return true;
  if (configuredOrigins.has(origin)) return true;

  const originHost = hostFromUrl(origin);
  if (!originHost) return false;
  if (configuredHosts.has(originHost)) return true;

  const normalizedRequestHost = normalizeHost(requestHost);
  return Boolean(normalizedRequestHost && originHost === normalizedRequestHost);
}

export function requireTrustedOrigin(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : null;
  if (isAllowedOrigin(origin, req.headers.host)) {
    next();
    return;
  }

  console.warn("[origin-guard] rejected request", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    origin,
    host: req.headers.host,
  });

  res.status(403).json({ error: "Request origin is not trusted.", code: "ORIGIN_NOT_TRUSTED" });
}
