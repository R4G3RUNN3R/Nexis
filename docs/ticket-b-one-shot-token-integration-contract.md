# Ticket B integration contract: one-shot token and entitlement consumption

Written during the Admin Panel hotfix (target-resolution fix + one-shot
token grant controls). Documents the intended consumption order and
integration points for Ticket B's personal one-shot narrative/reward
overhaul. Not implemented here - Ticket B implements the consumption
flow; this ticket only adds the primitives and records the contract.

## What exists after this ticket

- `player_state.player_snapshot.dmosOneShots.tokens.sealed` - tradeable
  one-shot tokens. Existing counter, consumed first-priority-last by
  `nexisOneShotService.js`'s `consumeToken()` (patronBound checked before
  sealed). Now grantable by staff via the Admin Panel
  (`grantOneShotTokenForUser` in `server/services/adminService.js`).
- `player_state.player_snapshot.dmosOneShots.tokens.patronBound` - donor
  one-shot tokens (non-tradeable, "bound"). Same existing counter, same
  consumption function, now also grantable by staff.
- `player_entitlement_consumptions` (Ticket A) - a real, unique-constrained
  ledger for "at most one consumption of entitlementKey per (user,
  periodKey)". Built and tested in Ticket A
  (`server/services/entitlementService.js`) but never wired into any
  route or the one-shot completion flow. This is the "current monthly
  donor entitlement" tier below.
- `one_shot_completions` (Ticket A) - a real, unique-constrained ledger
  preventing duplicate completion rewards for the same (user, campaign).
  Already wired into `nexisOneShotService.js`'s `advanceOneShotForUser`
  as a defense-in-depth backstop alongside the row lock.
- `hospitalService.js` (Ticket A) - `applyHospitalStay()` primitive,
  built and tested, not yet called from any live gameplay path.

## Required consumption order (as specified)

When a player starts (or the server needs to authorize) a personal
one-shot, availability/consumption should check, in this order:

1. **Available bonus donor one-shot credit** - `dmosOneShots.tokens.patronBound`
   (this ticket's donor grants land here). Already first-priority in
   `consumeToken()` - no change needed to the priority order itself, only
   to what surrounds it (see below).
2. **Current monthly donor entitlement** - NOT YET WIRED. This is where
   `entitlementService.js`'s `consumeMonthlyEntitlement()` /
   `player_entitlement_consumptions` belongs: a real donor-tier-derived
   monthly allowance (e.g. "one one-shot per calendar month for tier_2+"),
   distinct from the persistent bonus-credit balance above. Ticket B must
   decide the entitlement key/eligibility rule (likely gated on
   `chronicleService.js`'s `legacy.donorTier`, mirroring how Chronicle
   access itself is gated) and call `consumeMonthlyEntitlement()` at this
   point in the chain, before falling through to tradeable tokens.
3. **Tradeable token, only when explicitly selected by the player** -
   `dmosOneShots.tokens.sealed`. This is a change from the CURRENT
   behavior: `consumeToken()` today falls through to `sealed` automatically
   whenever `patronBound` is empty, with no player choice involved.
   Ticket B must make this an explicit, player-initiated choice (e.g. a
   confirmation step: "No bonus/monthly access remaining - spend 1
   tradeable token?") rather than silent automatic consumption, since
   tradeable tokens have real trade value and a player may not want one
   auto-spent.

## Other mandatory Ticket B prerequisites (carried over, not yet done)

1. Wire `hospitalService.js` into personal one-shot resolution (hospital
   consequence outcomes currently have no live trigger path).
2. Wire `entitlementService.js` into personal one-shot entitlement
   consumption (see step 2 above - the primitive exists, nothing calls it
   yet).
3. Fix the mid-month donor-tier eligibility cache bug: `chronicleService.js`'s
   `ensureChronicleEntitlement()` only recomputes `legacy.monthly.eligible`
   when `legacy.monthly.monthKey` differs from the current month - but
   default hydration already stamps `monthly.monthKey` with the current
   month (eligible:false) from a player's very first contact with the
   system, so a donor-tier upgrade mid-month never unlocks Chronicle
   access until the next calendar month. Whatever Ticket B builds for
   entitlement gating should not repeat this bug: recompute eligibility
   whenever donor tier changes, not only once per month-key transition.
4. Commit reward, hospital state, Chronicle writes, entitlement
   consumption, and completion in ONE transaction (matching the pattern
   already used for the row lock + `recordOneShotCompletion` in
   `advanceOneShotForUser` - extend that same transaction, don't add a
   second one).
5. Test concurrent one-shot completion against real PostgreSQL, not only
   sequential or single-process pglite calls (Ticket A's concurrency
   canary already proves pglite's `FOR UPDATE` genuinely blocks a second
   transaction - the remaining gap is proving the same under real network
   latency against production-shaped Postgres, not pglite specifically).
6. Preserve all historical Chronicle records in BOTH formats - see below.

## Chronicle discrepancy finding (Phase 6 of this ticket)

There are two separate, both game-facing "Chronicle" concepts sharing the
word in this codebase - Ticket B must not conflate them:

- `chronicleService.js`'s donor-tier-gated **monthly Chronicle**
  (`legacy.chronicleHistory`) - currently empty on every production
  account (genuinely never used yet, confirmed via direct read).
- `nexisOneShotService.js`'s **personal one-shot completion history**
  (`dmosOneShots.history`), which the game's own narrative text and API
  field name (`recentChronicles`, "recorded in your Chronicle") also
  calls a Chronicle. Confirmed intact and unaffected by Ticket A via
  direct production read: the one real account with completion history
  (Hennet, P1000000) has 6 well-formed entries, byte-identical in shape
  to what `nexisOneShotService.js` writes today.

Ticket A's live-verification report stating "production has no Chronicle
history" was accurate for the first (monthly) system specifically, not a
wrong-table error - it simply didn't check the second (one-shot) system,
which is where the visible entries actually live. No data was lost or is
at risk; nothing in Ticket A's or this hotfix's changes touches
`dmosOneShots.history`'s write path. Ticket B's narrative overhaul must
preserve both formats' existing historical entries when it changes how
new one-shots are authored and resolved.
