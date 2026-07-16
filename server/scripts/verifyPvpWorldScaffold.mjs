import assert from "node:assert/strict";

import { PVP_MODES, PVP_SAFETY_RULES, getNotorietyTier } from "../data/pvpData.js";
import { CITY_DIARIES, QUALITY_DEFINITIONS, WORLD_EVENT_TEMPLATES } from "../data/worldProgressionData.js";
import { ORGANIZATION_ONE_SHOT_MIN_SIGNUPS, ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE, getOrganizationOneShotCampaigns } from "../data/organizationOneShotData.js";
import { buildOrganizationOneShotBoardSnapshot, canResolveOrganizationOneShot, normalizeOrganizationOneShotState, consumeOrganizationOneShotToken, refundOrganizationOneShotToken, shouldRefundOrganizationOneShotToken } from "../services/organizationOneShotService.js";

assert.equal(PVP_MODES.length >= 6, true, "PvP scaffold should expose at least six playable modes");
assert.equal(PVP_SAFETY_RULES.some((rule) => rule.id === "same_city_default"), true, "PvP safety rules should document same-city default safety");
assert.equal(getNotorietyTier(0).id, "clean");
assert.equal(getNotorietyTier(75).id, "outlaw");
assert.equal(getNotorietyTier(125).id, "infamous");

assert.equal(Object.keys(CITY_DIARIES).length >= 5, true, "Every major launch city should have a diary scaffold");
assert.equal(Object.keys(QUALITY_DEFINITIONS).length >= 6, true, "Quality flags should cover remembered choices and status");
assert.equal(WORLD_EVENT_TEMPLATES.length >= 5, true, "World-event templates should cover all major cities");

assert.equal(ORGANIZATION_ONE_SHOT_MIN_SIGNUPS, 5, "Group one-shots require five signups");
assert.equal(getOrganizationOneShotCampaigns("guild").length >= 5, true, "Guilds should have at least five one-shot campaigns");
assert.equal(getOrganizationOneShotCampaigns("consortium").length >= 5, true, "Consortiums should have at least five one-shot campaigns");

assert.equal(ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE, 0.0001, "Group one-shot token refund chance should be 0.01%");
assert.equal(getOrganizationOneShotCampaigns("guild").every((campaign) => campaign.theme === "dungeon_monster"), true, "Guild one-shots should be dungeon / monster fighting themed");
assert.equal(getOrganizationOneShotCampaigns("consortium").every((campaign) => ["trade", "espionage", "sabotage"].includes(campaign.theme)), true, "Consortium one-shots should be trade / espionage / sabotage themed");

const state = normalizeOrganizationOneShotState({
  campaigns: {
    "guild-bonecrypt-depths": { signups: [
      { publicId: 1, displayName: "One", tokenCommitment: { source: "patron_bound", consumedAt: 1 } },
      { publicId: 2, displayName: "Two", tokenCommitment: { source: "sealed", consumedAt: 2 } },
      { publicId: 3, displayName: "Three", tokenCommitment: { source: "patron_bound", consumedAt: 3 } },
      { publicId: 4, displayName: "Four", tokenCommitment: { source: "sealed", consumedAt: 4 } },
    ] },
  },
});
assert.equal(canResolveOrganizationOneShot(state.campaigns["guild-bonecrypt-depths"], 5), false, "Four signups is not enough");
state.campaigns["guild-bonecrypt-depths"].signups.push({ publicId: 5, displayName: "Five", tokenCommitment: { source: "patron_bound", consumedAt: 5 } });
assert.equal(canResolveOrganizationOneShot(state.campaigns["guild-bonecrypt-depths"], 5), true, "Five signups unlocks resolution");

const board = buildOrganizationOneShotBoardSnapshot({
  organization: { type: "guild", metadata: { organizationOneShots: state } },
  viewerPublicId: 1,
});
const dungeon = board.campaigns.find((campaign) => campaign.id === "guild-bonecrypt-depths");
assert.equal(Boolean(dungeon), true, "Guild dungeon campaign should appear on the board");
assert.equal(dungeon.signupCount, 5);
assert.equal(dungeon.tokenCommittedCount, 5);
assert.equal(dungeon.viewerSignedUp, true);
assert.equal(dungeon.rewardTarget, "guild_legacy_and_treasury");
assert.equal(dungeon.tokenCost, 1);

const tokenRuntime = { player: { dmosOneShots: { tokens: { patronBound: 1, sealed: 1, lifetimeSpent: 0 } } } };
const firstCommitment = consumeOrganizationOneShotToken(tokenRuntime, { privilegeRole: "player" }, 10);
assert.equal(firstCommitment.source, "patron_bound");
assert.equal(tokenRuntime.player.dmosOneShots.tokens.patronBound, 0);
assert.equal(tokenRuntime.player.dmosOneShots.tokens.lifetimeSpent, 1);
const secondCommitment = consumeOrganizationOneShotToken(tokenRuntime, { privilegeRole: "player" }, 20);
assert.equal(secondCommitment.source, "sealed");
assert.equal(tokenRuntime.player.dmosOneShots.tokens.sealed, 0);
assert.throws(() => consumeOrganizationOneShotToken(tokenRuntime, { privilegeRole: "player" }, 30), /No Nexis one-shot token available/);
refundOrganizationOneShotToken(tokenRuntime, secondCommitment, 40);
assert.equal(tokenRuntime.player.dmosOneShots.tokens.sealed, 1);
assert.equal(shouldRefundOrganizationOneShotToken(() => 0.00009), true);
assert.equal(shouldRefundOrganizationOneShotToken(() => 0.00011), false);

console.log("pvp/world/org one-shot scaffold verification passed");
