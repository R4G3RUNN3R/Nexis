export function securityHeaders(req, res, next) {
  const requestId = req.headers["x-request-id"] || `nxs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = Array.isArray(requestId) ? requestId[0] : String(requestId);

  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  if (req.path.startsWith("/api") || req.accepts(["json", "html"]) === "json") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
  }

  next();
}
