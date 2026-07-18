// Ticket A: explicit, named, server-authoritative player mutations. Every
// function here locks the player_state row (SELECT ... FOR UPDATE) before
// reading it, mutates in memory, and writes back inside the same
// transaction - closing the lost-update race where two concurrent
// mutations of the same player both read a pre-mutation snapshot and the
// later commit silently discards the earlier one's changes.
//
// Deliberately NOT a generic "patch any player field" helper - each
// function does exactly one named thing with a fixed, validated shape.
// Callers pass a `client` already inside a withTransaction(...) block (the
// established pattern across every service in this codebase) so the lock
// held by findPlayerStateByUserInternalId(..., { forUpdate: true }) stays
// held until that transaction commits or rolls back.
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { addPlayerExperience } from "./progressionService.js";
import { addInventory, removeInventory } from "./itemService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export async function loadLockedRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate: true });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

// amount must be a non-negative integer computed by the caller from
// server-side data (a reward table, a combat result, etc.) - never accept
// this value directly from a request body.
export async function awardGold(client, user, amount, { source = "award" } = {}) {
  const grant = Math.max(0, Math.floor(asNumber(amount, 0)));
  const { runtimeState } = await loadLockedRuntimeState(client, user);
  const player = asRecord(runtimeState.player);
  player.gold = Math.max(0, Math.floor(asNumber(player.gold, 0)) + grant);
  runtimeState.player = player;
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState, goldAwarded: grant, gold: player.gold, source };
}

// Throws GOLD_INSUFFICIENT_FUNDS (409) rather than silently clamping - the
// caller decides what "afford" means for its own action, this function
// only guarantees the deduction is atomic with the balance check that
// authorized it (both happen under the same row lock).
export async function spendGold(client, user, amount, { source = "spend", errorMessage = "Not enough gold." } = {}) {
  const cost = Math.max(0, Math.floor(asNumber(amount, 0)));
  const { runtimeState } = await loadLockedRuntimeState(client, user);
  const player = asRecord(runtimeState.player);
  const currentGold = Math.max(0, Math.floor(asNumber(player.gold, 0)));
  if (currentGold < cost) {
    throw new HttpError(409, errorMessage, "GOLD_INSUFFICIENT_FUNDS");
  }
  player.gold = currentGold - cost;
  runtimeState.player = player;
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState, goldSpent: cost, gold: player.gold, source };
}

export async function awardExperience(client, user, amount, source = "progression", options = {}) {
  const { runtimeState } = await loadLockedRuntimeState(client, user);
  const result = addPlayerExperience(runtimeState, amount, source, options);
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState, ...result };
}

// items: array of { itemId, quantity }. Grants are applied atomically as a
// batch under one lock - either all items land or (on an unexpected error)
// none do, since the transaction rolls back as a whole.
export async function grantInventoryItems(client, user, items = []) {
  const { runtimeState } = await loadLockedRuntimeState(client, user);
  for (const { itemId, quantity } of items) {
    if (typeof itemId === "string" && itemId.trim()) addInventory(runtimeState, itemId.trim(), quantity ?? 1);
  }
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState };
}

// Throws ITEM_INSUFFICIENT_QUANTITY (409, via removeInventory) if any
// single item in the batch isn't held in sufficient quantity - checked
// against the locked, just-read snapshot, so a concurrent consumption of
// the same items cannot both pass this check for the same physical stock.
export async function removeInventoryItems(client, user, items = []) {
  const { runtimeState } = await loadLockedRuntimeState(client, user);
  for (const { itemId, quantity } of items) {
    if (typeof itemId === "string" && itemId.trim()) removeInventory(runtimeState, itemId.trim(), quantity ?? 1);
  }
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState };
}
