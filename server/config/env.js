export const API_PORT = Number(process.env.PORT || process.env.API_PORT || 8787);
export const DATABASE_URL = process.env.DATABASE_URL || null;
export const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24 * 14);
export const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60);
export const APP_BASE_URL = process.env.APP_BASE_URL || "http://178.104.1.195";
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

export const PLAYER_PUBLIC_ID_PREFIX = "P";
export const PUBLIC_ID_DIGITS = 7;
export const RESERVED_PLAYER_PUBLIC_ID_COUNT = 20;
export const PLAYER_PUBLIC_ID_BASE = 1_000_000;
export const FIRST_PLAYER_NUMERIC_ID =
  PLAYER_PUBLIC_ID_BASE + RESERVED_PLAYER_PUBLIC_ID_COUNT;
