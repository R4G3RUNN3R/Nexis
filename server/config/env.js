export const API_PORT = Number(process.env.PORT || process.env.API_PORT || 8787);
export const DATABASE_URL = process.env.DATABASE_URL || null;
export const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24 * 14);

export const PLAYER_PUBLIC_ID_PREFIX = "P";
export const PUBLIC_ID_DIGITS = 7;
export const RESERVED_PLAYER_PUBLIC_ID_COUNT = 20;
export const PLAYER_PUBLIC_ID_BASE = 1_000_000;
export const FIRST_PLAYER_NUMERIC_ID =
  PLAYER_PUBLIC_ID_BASE + RESERVED_PLAYER_PUBLIC_ID_COUNT;
