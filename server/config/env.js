export const API_PORT = Number(process.env.PORT || process.env.API_PORT || 8787);
export const DATABASE_URL = process.env.DATABASE_URL || null;
export const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24 * 14);
export const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60);
export const APP_BASE_URL = process.env.APP_BASE_URL || "http://178.104.1.195";
export const ALLOWED_ORIGINS = String(
  process.env.ALLOWED_ORIGINS || "https://nexis.nexus,https://www.nexis.nexus,http://178.104.1.195",
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
export const SMTP_HOST = process.env.SMTP_HOST || null;
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
export const SMTP_USER = process.env.SMTP_USER || null;
export const SMTP_PASS = process.env.SMTP_PASS || null;
export const SMTP_FROM = process.env.SMTP_FROM || null;
export const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
export const ORG_BASE_SWEEP_ENABLED = String(process.env.ORG_BASE_SWEEP_ENABLED || "true").toLowerCase() !== "false";
export const ORG_BASE_SWEEP_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.ORG_BASE_SWEEP_INTERVAL_MS || 5 * 60 * 1000),
);

// Google Identity Services web client ID (not a secret - safe to send to the
// browser so it can initialize the sign-in SDK). Absent by default: Google
// auth stays fully optional and every backend entry point must fail safely
// (controlled config-error response, not a crash) when this is unset.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
export const GOOGLE_PENDING_REGISTRATION_TTL_MINUTES = Number(
  process.env.GOOGLE_PENDING_REGISTRATION_TTL_MINUTES || 15,
);

export const PLAYER_PUBLIC_ID_PREFIX = "P";
export const PUBLIC_ID_DIGITS = 7;
export const RESERVED_PLAYER_PUBLIC_ID_COUNT = 20;
export const PLAYER_PUBLIC_ID_BASE = 1_000_000;
export const FIRST_PLAYER_NUMERIC_ID =
  PLAYER_PUBLIC_ID_BASE + RESERVED_PLAYER_PUBLIC_ID_COUNT;
