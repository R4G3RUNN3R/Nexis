import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

let oauthClient = null;
function getOAuthClient() {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

export function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

// Real implementation: signature, audience, issuer, and expiry are all
// validated by google-auth-library itself (verifyIdToken), not by any code
// in this file - see GOOGLE TOKEN VERIFICATION requirements. This is the
// only production call site of verifyIdToken.
async function verifyWithGoogle(idToken) {
  const client = getOAuthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// Overridable seam for deterministic automated testing only. Production
// code never calls this setter - see server/scripts/canaries/google-auth-canary.mjs,
// which substitutes a fake payload/rejection here instead of hitting real
// Google infrastructure. Real credential verification against live Google
// keys is exercised manually once GOOGLE_CLIENT_ID is configured, per the
// ticket's "one controlled real Google browser verification" requirement.
let verifyIdTokenImpl = verifyWithGoogle;

export function __setGoogleIdTokenVerifierForTests(fn) {
  verifyIdTokenImpl = typeof fn === "function" ? fn : verifyWithGoogle;
}

export function __resetGoogleIdTokenVerifierForTests() {
  verifyIdTokenImpl = verifyWithGoogle;
}

// Verifies a Google ID token and returns only the fields Nexis is allowed to
// trust from it. Every field on the return value comes from the verified
// payload - nothing here is ever taken from a separate, unverified request
// field. Throws HttpError for every rejection case so callers never need to
// distinguish "Google said no" from "the payload was structurally invalid."
export async function verifyGoogleCredential(idToken) {
  if (!isGoogleAuthConfigured()) {
    throw new HttpError(503, "Google sign-in is not configured on this server.", "GOOGLE_AUTH_NOT_CONFIGURED");
  }
  if (!idToken || typeof idToken !== "string") {
    throw new HttpError(400, "A Google credential is required.", "GOOGLE_CREDENTIAL_REQUIRED");
  }

  let payload;
  try {
    payload = await verifyIdTokenImpl(idToken);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // google-auth-library throws plain Errors for bad signature, wrong
    // audience, wrong issuer, and expired tokens alike - collapse all of
    // them to one generic rejection so nothing about *why* it failed leaks
    // to the client, and never let a raw library exception reach the global
    // error handler as an accidental 500.
    throw new HttpError(401, "Invalid or expired Google credential.", "GOOGLE_TOKEN_INVALID");
  }

  if (!payload || typeof payload.sub !== "string" || !payload.sub) {
    throw new HttpError(401, "Google credential is missing a subject identifier.", "GOOGLE_TOKEN_INVALID");
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    throw new HttpError(401, "Google credential is missing an email address.", "GOOGLE_TOKEN_INVALID");
  }

  if (payload.email_verified !== true) {
    throw new HttpError(401, "This Google account's email address is not verified.", "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return {
    subject: payload.sub,
    email,
    emailVerified: true,
    firstName: typeof payload.given_name === "string" ? payload.given_name.trim() : "",
    lastName: typeof payload.family_name === "string" ? payload.family_name.trim() : "",
  };
}
