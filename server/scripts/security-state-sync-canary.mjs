const BASE_URL = process.env.NEXIS_CANARY_BASE_URL || "http://127.0.0.1:8787/api";
const now = Date.now();
const email = `security-canary-${now}@nexis.local`;
const password = `canary-${now}`;

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { response, payload };
}

function assert(condition, message, detail = null) {
  if (!condition) {
    console.error(`[security-canary] FAIL: ${message}`);
    if (detail) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

function runtimePlayer(payload) {
  return payload?.playerState?.runtimeState?.player ?? payload?.playerState?.player ?? {};
}

console.log(`[security-canary] base=${BASE_URL}`);

const registration = await request("/register", {
  method: "POST",
  body: JSON.stringify({ firstName: "Security", lastName: "Canary", email, password }),
});
assert(registration.response.status === 201, "canary registration failed", registration.payload);
const token = registration.payload.sessionToken;
assert(typeof token === "string" && token.length > 20, "registration did not return a session token", registration.payload);

const meBefore = await request("/me", { headers: { Authorization: `Bearer ${token}` } });
assert(meBefore.response.ok, "baseline /me failed", meBefore.payload);
const beforePlayer = runtimePlayer(meBefore.payload);
const beforeGold = beforePlayer.gold;
const beforeLevel = beforePlayer.level;
const beforeInventory = JSON.stringify(beforePlayer.inventory ?? {});

const evilOrigin = await request("/state", {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example" },
  body: JSON.stringify({ player: { bio: { bio: "blocked by origin" } } }),
});
assert(evilOrigin.response.status === 403, "untrusted origin was not blocked", evilOrigin.payload);

const stateAttack = await request("/state", {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    player: {
      gold: 99999999,
      level: 99,
      experience: 99999999,
      stats: { energy: 999, health: 999, maxHealth: 999 },
      inventory: { forged_item: { quantity: 99 } },
      bio: { bio: "Canary bio survives state allowlist." },
      ui: {
        dismissedGuideAt: "2026-07-17T00:00:00.000Z",
        cielTutorial: {
          version: 1,
          introSeenAt: "2026-07-17T00:00:00.000Z",
          spotlightPending: "true",
          lastStepId: "orders",
          completedStepIds: ["identity", "orders", "not-real"],
          bogus: "blocked",
        },
      },
    },
    guild: { publicId: 999 },
    consortium: { publicId: 999 },
    legacy: { points: { available: 999 } },
    travel: { status: "arrived" },
  }),
});
assert(stateAttack.response.ok, "/state allowlist request failed", stateAttack.payload);

const meAfter = await request("/me", { headers: { Authorization: `Bearer ${token}` } });
assert(meAfter.response.ok, "post-attack /me failed", meAfter.payload);
const afterPlayer = runtimePlayer(meAfter.payload);
assert(afterPlayer.gold === beforeGold, "client changed server-owned gold", { beforeGold, afterGold: afterPlayer.gold });
assert(afterPlayer.level === beforeLevel, "client changed server-owned level", { beforeLevel, afterLevel: afterPlayer.level });
assert(JSON.stringify(afterPlayer.inventory ?? {}) === beforeInventory, "client changed server-owned inventory", { beforeInventory, afterInventory: afterPlayer.inventory });
assert(afterPlayer.bio?.bio === "Canary bio survives state allowlist.", "allowed bio field did not persist", afterPlayer.bio);
assert(afterPlayer.ui?.cielTutorial?.spotlightPending === "true", "CIEL tutorial state did not persist", afterPlayer.ui);
assert(afterPlayer.ui?.cielTutorial?.completedStepIds?.includes("identity"), "CIEL tutorial completed steps did not persist", afterPlayer.ui);
assert(!afterPlayer.ui?.cielTutorial?.completedStepIds?.includes("not-real"), "CIEL tutorial accepted invalid step ids", afterPlayer.ui);
assert(!Object.prototype.hasOwnProperty.call(afterPlayer.ui?.cielTutorial ?? {}, "bogus"), "CIEL tutorial accepted unknown fields", afterPlayer.ui);

const adminProbe = await request("/admin/players", { headers: { Authorization: `Bearer ${token}` } });
assert(adminProbe.response.status === 403, "normal player could access admin player search", adminProbe.payload);

const guide = await request("/guide/command-brief", { headers: { Authorization: `Bearer ${token}` } });
assert(guide.response.ok, "command brief endpoint failed", guide.payload);
assert(guide.payload?.commandBrief?.primaryAction?.route, "command brief missing primary action", guide.payload);

console.log("[security-canary] PASS state allowlist, origin guard, admin gate, command brief");
