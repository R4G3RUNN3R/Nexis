import { withTransaction } from "../db/pool.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { findOrganizationForUserByType } from "../repositories/organizationRepository.js";
import { ensureEducationState } from "./educationService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hasRecord(runtimeState, predicate) {
  return asArray(asRecord(runtimeState.player?.records).entries).some((entry) => predicate(asRecord(entry)));
}

function hasTravelRecord(runtimeState) {
  return hasRecord(runtimeState, (entry) => entry.category === "travel" || entry.source === "travel");
}

function hasContractRecord(runtimeState) {
  return hasRecord(
    runtimeState,
    (entry) => entry.category === "contract" || entry.source === "contract" || String(entry.route || "").includes("city"),
  );
}

function hasOneShotRecord(runtimeState) {
  return hasRecord(
    runtimeState,
    (entry) => entry.category === "chronicle" || entry.source === "nexis-one-shot" || String(entry.route || "").includes("one-shots"),
  );
}

function legacyPointsAvailable(runtimeState) {
  const legacy = asRecord(runtimeState.legacy);
  const points = asRecord(legacy.points);
  if (Number.isFinite(Number(points.available))) return Math.max(0, Math.floor(Number(points.available)));

  const awarded = asRecord(asRecord(legacy.achievements).awarded);
  const ranks = asRecord(asRecord(legacy.perks).ranks);
  const earned = Object.values(awarded).reduce(
    (sum, award) => sum + Math.max(1, Math.floor(asNumber(asRecord(award).rewardPoints, 1))),
    0,
  );
  const spent = Object.values(ranks).reduce((sum, rank) => {
    const safeRank = Math.max(0, Math.floor(asNumber(rank, 0)));
    return sum + (safeRank * (safeRank + 1)) / 2;
  }, 0);
  return Math.max(0, earned - spent);
}

function makeStep(id, label, status, route, detail) {
  return { id, label, status, route, detail };
}

function makeAction(id, label, route, reason, cta = "Open") {
  return { id, label, route, reason, cta };
}

function firstIncompleteStep(steps) {
  return steps.find((step) => step.status !== "complete") ?? null;
}

function buildBrief({ runtimeState, guild, consortium }) {
  const player = asRecord(runtimeState.player);
  const stats = asRecord(player.stats);
  const current = asRecord(player.current);
  const travel = asRecord(runtimeState.travel ?? current.travel);
  const education = ensureEducationState(runtimeState);
  const activeEducation = asRecord(education.activeCourse);
  const completedCourses = asArray(education.completedCourses);
  const academy = asRecord(player.cityAcademy);
  const activeAcademyStudy = asRecord(academy.activeStudy);
  const dmos = asRecord(player.dmosOneShots);
  const tokens = asRecord(dmos.tokens);
  const oneShotTokenCount = Math.max(0, Math.floor(asNumber(tokens.patronBound, 0) + asNumber(tokens.sealed, 0)));
  const isTraveling = travel.status === "in_transit";
  const activeContract = typeof current.job === "string" && current.job.trim() ? current.job.trim() : null;
  const lowEnergy = asNumber(stats.energy, 100) < 25;
  const lowHealth = asNumber(stats.health, 100) <= Math.ceil(asNumber(stats.maxHealth, 100) * 0.25);
  const legacyAvailable = legacyPointsAvailable(runtimeState);

  const steps = [
    makeStep(
      "life-path",
      "Choose a Life Path",
      asRecord(player.lifePath).current ? "complete" : "available",
      "/life-paths",
      asRecord(player.lifePath).current
        ? "Origin chosen. Suggested work can now be more personal."
        : "Pick your opening identity and suggested first route.",
    ),
    makeStep(
      "education",
      "Begin Education",
      activeEducation.courseId ? "current" : completedCourses.length ? "complete" : "available",
      "/education",
      activeEducation.courseId
        ? "A course is underway. Check its timer."
        : completedCourses.length
          ? `${completedCourses.length} course(s) completed.`
          : "Start Basic Literacy or Practical Arithmetic to unlock more systems.",
    ),
    makeStep(
      "local-action",
      "Do Local Work",
      activeContract ? "current" : hasContractRecord(runtimeState) ? "complete" : "available",
      "/city",
      activeContract ? `Active contract: ${activeContract}.` : "Use City, Civic Jobs, or Adventure for your first practical reward.",
    ),
    makeStep(
      "travel",
      "Travel or Explore",
      isTraveling ? "current" : hasTravelRecord(runtimeState) ? "complete" : "available",
      "/travel",
      isTraveling ? "A caravan is already moving." : "Travel creates discovery, route, market, and excursion opportunities.",
    ),
    makeStep(
      "one-shot",
      "Record a One-Shot Chronicle",
      hasOneShotRecord(runtimeState) ? "complete" : oneShotTokenCount > 0 ? "available" : "locked",
      "/one-shots",
      hasOneShotRecord(runtimeState)
        ? "At least one campaign is recorded."
        : oneShotTokenCount > 0
          ? "A token is ready for a personal, guild, or consortium one-shot."
          : "Requires a Patron or Sealed one-shot token.",
    ),
    makeStep(
      "organization",
      "Join or Build an Organization",
      guild || consortium ? "complete" : "available",
      guild ? "/guilds" : consortium ? "/consortiums" : "/guilds",
      guild || consortium
        ? "Organization identity is active."
        : "Guilds are operations; consortiums are companies. Pick the pressure you enjoy.",
    ),
  ];

  const actions = [];
  if (lowHealth) actions.push(makeAction("low-health", "Recover before risky work", "/hospital", "Health is low enough to make combat and travel riskier.", "Recover"));
  if (lowEnergy) actions.push(makeAction("low-energy", "Recover energy before real fights", "/arena", "Real fights cost 25 energy, and you are below that line.", "Review"));
  if (activeEducation.courseId) actions.push(makeAction("education-active", "Check current education", "/education", "Education runs over time and may be ready to complete.", "Check"));
  else actions.push(makeAction("education-start", "Start a course", "/education", "Education unlocks commerce, travel discovery, civic systems, and other hard gates.", "Study"));
  if (activeAcademyStudy.academyId) actions.push(makeAction("academy-active", "Check academy study", "/city#academy", "Academy study is separate from education and city-bound.", "Check"));
  if (isTraveling) actions.push(makeAction("travel-active", "Track caravan", "/travel", "Travel owns movement and arrival state.", "Track"));
  else actions.push(makeAction("travel-explore", "Pick a route or excursion", "/travel", "Travel creates discoveries, materials, recipes, and route records.", "Travel"));
  if (legacyAvailable > 0) actions.push(makeAction("legacy-spend", "Spend Legacy Points", "/achievements", `${legacyAvailable} point${legacyAvailable === 1 ? " is" : "s are"} available for permanent merits.`, "Spend"));
  if (!guild) actions.push(makeAction("guild", "Consider a guild", "/guilds", "Guilds are faction operations, expeditions, and group one-shots.", "Review"));
  if (!consortium) actions.push(makeAction("consortium", "Consider a consortium", "/consortiums", "Consortiums are companies, logistics, treasury, and trade identity.", "Review"));
  if (oneShotTokenCount > 0) actions.push(makeAction("one-shot-token", "Use a one-shot token", "/one-shots", "Tokens can become personal, guild, or consortium chronicles.", "Open"));

  const nextStep = firstIncompleteStep(steps);
  const primaryAction = actions[0] ?? (nextStep
    ? makeAction(nextStep.id, nextStep.label, nextStep.route, nextStep.detail, "Open")
    : makeAction("ready", "Choose your next order", "/city", "You are ready for contracts, travel, study, or organization work.", "Open"));

  return {
    phase: completedCourses.length < 2 ? "Foundations" : guild || consortium ? "World Commitments" : "Open City Work",
    summary: nextStep ? nextStep.detail : "Core onboarding steps are complete. Follow rewards, organizations, and discoveries now.",
    primaryAction,
    nextActions: actions.slice(0, 6),
    firstSteps: steps,
    blockers: [
      ...(lowEnergy ? [{ id: "energy", label: "Low energy", detail: "Real fights need 25 energy." }] : []),
      ...(lowHealth ? [{ id: "health", label: "Low health", detail: "Recover before dangerous actions." }] : []),
    ],
  };
}

export async function getPlayerCommandBrief(user) {
  return withTransaction(async (client) => {
    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    const guild = await findOrganizationForUserByType(client, user.internalId, "guild");
    const consortium = await findOrganizationForUserByType(client, user.internalId, "consortium");
    return { ok: true, commandBrief: buildBrief({ runtimeState, guild, consortium }) };
  });
}
