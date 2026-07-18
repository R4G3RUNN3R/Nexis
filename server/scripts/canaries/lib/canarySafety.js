// Ticket A Phase A5: shared safety guard for canaries that hit a real running
// HTTP instance (as opposed to the canaries that self-host an in-process
// server against a disposable pglite database and never touch the network).
//
// Root cause this closes: legacy-achievements-canary.mjs previously defaulted
// straight to `http://127.0.0.1:3001/api` - the live nexis-waitlist.service
// port - so simply running it with no environment configured would register
// real accounts and mutate real production data. mass-assignment-audit-canary.mjs
// had the same class of risk one step removed (a documented-but-unenforced
// convention, no runtime check).
//
// This does not try to guess a safe default port, since there usually isn't
// one already running. Instead it requires the operator to say explicitly
// where the isolated test instance lives, and it refuses known-production
// hosts (port 3001, nexis.nexus) even if someone passes them explicitly,
// unless NEXIS_CANARY_ALLOW_PRODUCTION=true is also set.

const PRODUCTION_HOSTNAME_PATTERNS = [/(^|\.)nexis\.nexus$/i];
const PRODUCTION_PORTS = new Set(["3001"]);

function isProductionTarget(url) {
  const hostnameIsProduction = PRODUCTION_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname));
  const portIsProduction = PRODUCTION_PORTS.has(url.port);
  return hostnameIsProduction || portIsProduction;
}

// envVar: which environment variable carries the base URL for this canary.
// requireExplicit: if true (default), there is no built-in default - the
// operator must set the env var to their own isolated instance.
export function resolveCanaryBaseUrl({ envVar = "NEXIS_CANARY_BASE_URL", requireExplicit = true, defaultUrl = null } = {}) {
  const raw = process.env[envVar] || defaultUrl;
  if (!raw) {
    if (requireExplicit) {
      throw new Error(
        `${envVar} is not set. This canary hits a real running HTTP instance and refuses to guess a target. ` +
        `Start an isolated instance (DATABASE_URL unset, disposable pglite) and set ${envVar} to its base URL before running this canary.`,
      );
    }
    throw new Error(`${envVar} is not set and no default was provided.`);
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${envVar}="${raw}" is not a valid URL.`);
  }

  const allowProduction = process.env.NEXIS_CANARY_ALLOW_PRODUCTION === "true";
  if (isProductionTarget(url) && !allowProduction) {
    throw new Error(
      `Refusing to run this canary against "${raw}" - that looks like the live production instance ` +
      `(port 3001 and/or nexis.nexus are treated as production). This canary registers accounts and ` +
      `mutates real data. If you genuinely intend a one-off production smoke test, set ` +
      `NEXIS_CANARY_ALLOW_PRODUCTION=true explicitly and understand the consequences.`,
    );
  }

  return raw;
}
