function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function actorKey(req) {
  const user = req.auth?.user;
  if (user?.internalId) return `user:${user.internalId}`;
  if (user?.publicId) return `player:${user.publicId}`;
  return `ip:${clientIp(req)}`;
}

function normalizedRoutePath(req) {
  return String(req.route?.path ?? req.path ?? "unknown").replace(/^\/api\b/, "");
}

export function createRateLimiter({ windowMs = 60_000, max = 60, keyPrefix = "route", keyBy = actorKey, skip = null } = {}) {
  const buckets = new Map();

  function sweep(expiryCutoff) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= expiryCutoff) buckets.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    if (typeof skip === "function" && skip(req)) {
      next();
      return;
    }

    const now = Date.now();
    if (buckets.size > 5000) sweep(now);

    const actor = keyBy(req);
    const key = `${keyPrefix}:${actor}:${normalizedRoutePath(req)}`;
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      console.warn("[rate-limit] blocked request", {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        keyPrefix,
        actor,
      });
      res.status(429).json({ error: "Too many requests. Slow down and try again shortly.", code: "RATE_LIMITED" });
      return;
    }

    next();
  };
}

export const authRateLimit = createRateLimiter({
  windowMs: 5 * 60_000,
  max: 20,
  keyPrefix: "auth",
  keyBy: (req) => `ip:${clientIp(req)}`,
});

export const passwordResetRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 6,
  keyPrefix: "password-reset",
  keyBy: (req) => `ip:${clientIp(req)}`,
});

export const profileUploadRateLimit = createRateLimiter({ windowMs: 10 * 60_000, max: 8, keyPrefix: "profile-upload" });
// Authenticated account-mutation actions (change password/email/name, close
// account). Default keyBy (actorKey) already resolves user:${internalId} for
// any authenticated request - no custom keyBy needed, unlike authRateLimit
// which is IP-keyed for the unauthenticated login/register surface.
export const accountMutationRateLimit = createRateLimiter({ windowMs: 60_000, max: 10, keyPrefix: "account-mutation" });
export const stateSyncRateLimit = createRateLimiter({ windowMs: 60_000, max: 45, keyPrefix: "state-sync" });
export const adminMutationRateLimit = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: "admin-mutation" });
export const unsafeApiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "unsafe-api",
  skip: (req) => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method),
});
