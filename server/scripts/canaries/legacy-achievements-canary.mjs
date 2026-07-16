const API_BASE = process.env.NEXIS_CANARY_BASE_URL ?? "http://127.0.0.1:3001/api";
const PASSWORD = `legacy-canary-${Date.now()}`;
const EMAIL = `canary.legacy.${Date.now()}@nexis.local`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

async function main() {
  const register = await request("/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Legacy",
      lastName: "Canary",
      email: EMAIL,
      password: PASSWORD,
    }),
  });

  assert(register.response.ok, `registration failed: ${register.response.status} ${JSON.stringify(register.payload)}`);
  const token = register.payload?.sessionToken;
  assert(typeof token === "string" && token.length > 20, "registration did not return a usable session token");

  const achievementState = await request("/legacy/achievements", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(
    achievementState.response.ok,
    `legacy achievements API failed: ${achievementState.response.status} ${JSON.stringify(achievementState.payload)}`,
  );
  assert(Array.isArray(achievementState.payload?.achievements), "achievement API did not return achievements");
  assert(achievementState.payload.achievements.some((achievement) => achievement.completed), "no baseline achievement was awarded");
  assert(Number(achievementState.payload.legacyPoints?.totalEarned ?? 0) >= 1, "legacy points were not awarded");
  assert(
    Array.isArray(achievementState.payload.legacy?.visibleEntries) &&
      achievementState.payload.legacy.visibleEntries.some((entry) => entry.kind === "achievement"),
    "achievement award was not written into the visible Chronicle entries",
  );

  const spend = await request("/legacy/perks/rank", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ perkId: "education-length" }),
  });

  assert(spend.response.ok, `legacy perk spend failed: ${spend.response.status} ${JSON.stringify(spend.payload)}`);
  assert(Number(spend.payload?.perkRanks?.["education-length"] ?? 0) === 1, "legacy perk rank did not persist after spend");

  const reloaded = await request("/legacy/achievements", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(reloaded.response.ok, `legacy achievement reload failed: ${reloaded.response.status} ${JSON.stringify(reloaded.payload)}`);
  assert(Number(reloaded.payload?.perkRanks?.["education-length"] ?? 0) === 1, "legacy perk rank did not survive reload");

  console.log(JSON.stringify({
    ok: true,
    email: EMAIL,
    achievementsAwarded: reloaded.payload.achievements.filter((achievement) => achievement.completed).length,
    legacyPoints: reloaded.payload.legacyPoints,
    educationLengthRank: reloaded.payload.perkRanks["education-length"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
