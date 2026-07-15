# Nexis Research Recommendations — Fit Filter

**Purpose.** This document synthesizes two prior research passes into one decision-ready
filter: what to act on now, what to bring to the user for approval, what to reject, and
what to defer. It does not introduce new mechanics research of its own — every
recommendation below traces back to one or both of:

1. `research/torn-mechanics` → `docs/research/torn-mechanics-to-nexis.md` (Torn-inspired
   patterns across Education, Travel, Consortiums, Guilds, Legacy Points, Home/UI).
2. `research/browser-rpg-opportunities` → `docs/research/browser-rpg-feature-opportunities.md`
   (21 rows across the mafia-crime genre, Kingdom of Loathing, Cyber Nations, NationStates,
   Melvor Idle, Fallen London, Legend of the Green Dragon, Urban Dead, and a
   cross-industry moderation pattern).

Both source documents remain the record of raw findings; this document's job is to
pre-filter them against what's already approved and in flight, so nothing here should be
read as a substitute for reading the originals if more detail is needed on any single row.

**What's already approved and in flight** (five workstreams, being built in parallel by
other agents right now — nothing below re-recommends these as new ideas, only as
refinements of them where applicable):

1. Home page cleanup — trimming `Home.tsx` to a compact status dashboard.
2. Travel splash/interstitial visuals — dedicated traveling-state screen, original art.
3. Admin Mode toggle — admin-only UI toggle, server-enforced regardless of toggle state.
4. Admin Panel refinement — compact tabbed control panel, queued after (3).
5. Adventure item-gated chain MVP — Adventure A drops an item Adventure B requires,
   server-authoritative, pity protection.
6. Guilds faction rework — embedding named skill branches (Armory/Chaining/Expedition/
   Fortification/Recruitment/Territory/Medical/Looting/Training/Diplomacy-equivalent)
   into the existing but under-utilized `GUILD_SKILL_TREE`. **Not** full PvP/territory war.
7. Consortiums company rework — star-tier passive/active perks per consortium type on
   `consortiumTypes.js`, enforcing the existing `Civic Fundamentals` gate.

(6) and (7) are queued to start once this report lands, so their subsections below are
written directly as input to those two agents.

---

## Highest-Value Ideas To Add

Ranked, pulled from across both source docs, restricted to ideas that go **beyond**
what's already approved (see "Present To User For Approval" for full detail on each):

1. **Guild Warfare** — the single clearest gap either research pass found: Nexis Guilds
   have zero war/territory/PvP mechanic today, and it's the primary reason Torn's
   factions matter competitively. Highest confidence, highest impact, but needs full
   design review for matchmaking/streak-abuse safeguards before any build starts.
2. **Consortium Roster Requests + Onboarding Hold** (employee/hiring loop for
   Consortiums) — the second-biggest structural gap identified; Consortiums currently
   read as reward trees with no real employee system, and this is the natural next
   phase once the in-flight star-tier perk rework ships.
3. **Guild Charters** (leader-defined custom ranks with fine-grained, toggleable
   permissions) — closes a real trust/security gap (over-granted armory/treasury access
   is the classic internal-theft vector in this genre), and directly complements the
   in-flight skill-branch rework by giving guild leadership a matching management tool.
4. **Caravan Trade Runs** (formalized cross-city price differentials making cargo
   hauling reliably profitable) — Torn's strongest emergent-economy engine, and it
   builds directly on the transport/cargo system Nexis already merged; needs cargo
   caps and escort risk tuned in to avoid becoming a bot-farming vector.
5. **Bold Strike difficulty toggle** (Cautious/Standard/Reckless risk selector on
   existing Arena/Adventure encounters, with a small "Momentum" streak bonus for clean
   wins) — cheapest item on this list to build since it reuses existing encounter
   content, and adds real replay value with minimal new-content cost.

---

## 1. Implement Now

Refinements to the five in-flight workstreams only — nothing here is a new system on
its own; each bullet is scoped as a suggested addition or design detail for a branch
that's already approved and being actively built.

### Adventure item-gated chain MVP

- **Make gating items ("Keystones") tradeable/purchasable on the marketplace, not
  soulbound-only.** This is both docs' consolidated top item-gating finding (Kingdom of
  Loathing precedent, cross-referenced against the Torn doc's general gating patterns):
  a bad drop streak should never hard-wall progression when a marketplace or slower
  alternate-grind path can absorb it, and it creates organic marketplace demand for the
  gating item as a side effect. Flag this as a refinement suggestion for the in-flight
  branch, not a new system.
- **Give each chain-leg resolution its own full-panel result page** (dedicated layout,
  art slot, explicit loot/Keystone reveal) instead of resolving inline — the Kingdom of
  Loathing "vignette" pattern. Scope this to the adventure chain specifically now;
  reusing the same component for Job/Crime resolutions later is a good idea but belongs
  in Later Expansion, not this MVP.
- **Structure chain legs with rising gear requirements and a small chance of a setback**
  (time lost, minor injury) at the hardest legs, mirroring the mafia-crime genre's
  ranked job-tier pattern — but always keep a slower, guaranteed-success path available.
  Never let a failure roll be the only way through required story content.
- **Audit whether Adventures and Arena currently share a resource/cooldown pool.** If
  they do, give the new chain content its own dedicated pool so upcoming adventure-chain
  engagement doesn't cannibalize Arena engagement (both loops should be able to run in
  the same session without competing for the same bar).

### Guilds faction rework (skill-branch embedding)

- **Structure the embedded branches as a small fixed "core" branch everyone gets, plus
  the larger named pool (Armory/Chaining/Expedition/Fortification/Recruitment/
  Territory/Medical/Looting/Training/Diplomacy-equivalent) as optional specializations
  with a capped number active at once.** Allow respec/swap, but tune the cost so
  switching is a real strategic decision rather than a free daily toggle. This is the
  single most concrete, directly-applicable structural recommendation out of the Torn
  research — it's the exact fix for the "under-utilized, single fixed 6-node path"
  problem already confirmed in `organizationService.js`.
- **Design Fortification's and Territory's reward hooks to be forward-compatible with a
  possible future Guild Warfare system** (see Present To User) without building any war
  mechanic now — e.g., don't hard-code their effect summaries in a way that assumes no
  territory/combat context will ever exist. Costs nothing extra now, avoids painful
  rework later if Guild Warfare is approved.

### Consortiums company rework (star-tier perks)

- **Layer a three-metric performance model (Efficiency / Conditions / Standing-style)
  onto the existing star-tier system** so a consortium's rank reflects active
  management across distinct levers instead of one flat score. This is the highest-
  priority Companies row in the Torn research and slots directly into "building on the
  existing `consortiumTypes.js` foundation."
- **Add a director-specific reward channel** — a small passive working-stat trickle plus
  bonus training charges, both scaling with star tier — so the director role feels
  mechanically distinct from ordinary membership, not just a title.
- **Resolve, as part of this rework, whether `CONSORTIUM_RANDOM_REWARD_POOLS` and the
  star-tier trees already give directors a spendable, chosen reward, or whether a light
  explicit currency is needed for that.** The Torn research flagged this as an open
  question rather than a confirmed gap — settle it during the rework instead of after.

### Home page cleanup

- **Convert the Current Activity / Progression Snapshot static rows into live progress
  bars with timers and click-through**, matching the pattern the Property/Inventory/
  Equipment summary panels already use on Home.
- **Confirm the hero status line reflects live travel destination, not just city**,
  matching the `Travelling: <destination>` string already used in the Guild roster view
  — this is a two-line change, not new plumbing, and ties the Home cleanup and Travel
  splash workstreams together correctly.
- **Promote the Notifications unread count into a persistent header badge.**
- **Audit for remaining static, non-linked rows** (Current Education, Travel status) and
  convert them to inline links, matching the pattern the Property/Inventory panels
  already use.
- **Reuse the existing Chronicle data (already wired via `feature/profile-chronicle-wiring`)
  for a compact "recent activity" module on the trimmed Home**, rather than inventing a
  new feed system. Keep it to a handful of lines — this is explicitly a compacting
  pass, not a place to grow a new social-timeline feature.
- **Keep the "compact summary + link out" pattern generic enough that a future Guild or
  Consortium summary panel could slot in later without a rearchitect.** Forward-
  compatibility note only — no new panel should be built now.

### Travel splash / Admin Mode toggle / Admin Panel refinement

No direct refinements surfaced for these three from either research doc. The
Travel-adjacent economy ideas found (cross-city trade, purchasable transport upgrades,
per-city vendor tiers) are economy systems, not interstitial visuals, so they're
scoped under Present To User / Later Expansion instead. The closest Admin-adjacent
idea (a moderation sanction ladder, see below) is a bigger feature than a UI/toggle
refinement and is scoped as a follow-on phase, not a refinement of the current work.

---

## 2. Present To User For Approval

Ideas that go beyond what's already approved. Genuinely promising, but each needs an
explicit yes before any build work starts.

- **Guild Warfare** (Torn research, top pick). Territory holdings granting passive
  Reputation, a timed wall/objective-capture war mode, and a separate zero-sum raid
  mode, plus a "Warpath Streak" consecutive-attack bonus. This is the single clearest
  structural gap identified across both documents — Nexis Guilds have no war/territory/
  PvP system today. Real abuse/balance risk: needs matchmaking or size-parity
  safeguards so small guilds can't be endlessly farmed by large ones, opt-in/inactive-
  guild protections, and a deliberately slow-growing streak multiplier (not linear) with
  cooldowns to blunt bot/multi-account farming. Do not greenlight without a full design
  pass on those safeguards specifically.
- **Consortium Roster Requests + Onboarding Hold.** A real employee/hiring loop for
  Consortiums — multi-apply, time-limited, director-reviewed applications, plus a short
  probation window before new hires get special-tier access. This is the second-
  biggest gap the Torn research found: Consortiums currently read as star-tier reward
  trees with no actual hiring mechanic. Natural next phase after the in-flight star-tier
  perk rework ships, since it needs that foundation in place first.
- **Outreach Budget.** Director-controlled daily advertising spend for Consortium
  growth, boosted by specific education courses and/or a dedicated "marketer" roster
  role. Ties Education, Consortiums, and (once approved) Roster Requests together.
  Needs diminishing returns on spend so it doesn't become pure pay-to-win for whichever
  consortium has the deepest gold reserves. Sequence after Roster Requests, not before.
- **Guild Charters** (leader-defined custom ranks with individually toggleable
  permissions — armory access, quest management, etc.). Closes a real trust gap: in
  games like this, over-granted permissions on a fixed rank list are the leading cause
  of internal guild theft. Needs a clear warning UI on permission grants; Nexis's
  existing guild audit log already covers the accountability side.
- **Operation Capacity + Linked Contracts.** A regenerating resource capping how many
  guild quests/dungeons a guild can run at once (keeps large guilds from brute-forcing
  every operation regardless of size), plus optional 2-3-stage quest chains that only
  pay out on full completion. Reasonable balance/content additions once the skill-
  branch rework is live and guild activity volume is better understood.
- **Caravan Trade Runs** (+ smaller companion ideas: a purchasable "Swift Passage"
  travel-time upgrade, a purchasable cargo-capacity item, a three-tier destination-shop
  taxonomy per city). Formalizes cross-city price differentials so hauling cargo is
  reliably profitable — the strongest emergent-economy engine in the Torn research, and
  it builds directly on the already-merged transport/cargo system. Primary risk is
  gold-farming/multi-accounting; needs cargo caps, escort risk, and likely a
  diminishing-returns curve on repeated identical runs before this ships.
- **Bold Strike difficulty toggle.** A Cautious/Standard/Reckless selector before Arena
  or Adventure encounters, scaling reward/risk, with a small "Momentum" bonus for
  consecutive clean wins. Cheap to build (reuses existing encounter content), adds
  replay value, no new content pipeline required. Keep it mechanically separate from
  the adventure-chain's own resource costs so the two systems don't confusingly stack.
- **Nexis Stalls** (personal player storefronts, unlocked at a level/reputation
  threshold, self-set prices). Matures the marketplace beyond a single global exchange
  board and pairs naturally with the tradeable-Keystone refinement already going into
  the Adventure chain MVP. Hard requirement if built: keep any premium/real-money
  currency non-resellable through storefronts — unrestricted player shops laundering
  premium currency into free-trade wealth is a known failure mode in this genre.
- **Warden's Ledger** (graduated moderation sanction ladder — warning, timed
  travel/jail lock, suspension — plus a player report intake queue and a player-visible
  appeal flow, all tied into the existing admin audit log). Natural next phase after
  Admin Panel refinement ships; the current admin panel is server-authoritative and
  fully audit-logged but centers on one-off manual corrections rather than a structured
  sanction/report workflow. Keep a human admin decision in the loop — don't let
  unverified player reports trigger automatic action.
- **Guild Sanctum.** Treasury-funded hall upgrades granting small passive member-wide
  buffs and eventually unlocking guild-only cooperative dungeon content. Gives guild
  treasuries — which already persist real numbers — a visible, active spend target.
  Could reuse Fortification/Territory branch flavor from the in-flight skill-branch
  rework once that's live. Cap buff magnitude so small/new guilds aren't locked out of
  competing elsewhere.
- **Consortium Rivalries.** A periodic ranked leaderboard scoring existing Consortiums
  against each other (e.g., aggregate weekly trade activity) using only plumbing that
  already exists — no new organization type. Light, cheap complement to the in-flight
  Consortium rework once it's live.
- **Calling perks.** A minor passive bonus (a sliver of bonus XP in one subsystem, a
  small discount somewhere) attached to the class/portrait already chosen at
  registration (Warrior, Mage, Rogue, Healer, Scout, Scholar). Makes an existing
  decision feel more meaningful for very little build cost. Keep it flavor-level only —
  don't let it create a real combat/economy power gap between starting classes.
- **Mastery Diplomas.** A capstone course per Education specialist branch, gated on
  completing every other course in that branch, granting a unique unlock not available
  any other way. Gives long-horizon players a clear finish line per tree. Needs reward
  parity across branches so no single branch feels mandatory.

---

## 3. Reject/Avoid

- **Any 4X-style nation/land/infrastructure/tax-simulation layer** (Cyber Nations
  pattern) — the browser-RPG research doc explicitly filtered against this genre, and
  it's the single clearest "do not become this" boundary in either document. Reaffirmed
  on double-check: nothing in either source doc actually argues for building this: it's
  presented only as a comparison point.
- **Consortium Trade Pacts** (Cyber Nations inter-alliance resource-sharing, even a
  "capped, minor" version) — imports 4X-genre plumbing wholesale; if Nexis ever wants
  inter-Consortium cooperation, design it from Nexis's own economy rather than
  backporting an alliance resource-share mechanic from the genre it explicitly isn't
  building.
- **NationStates-style issue popups / "Council Dispatches"** — sourced from a
  narrative-decision-only genre with no combat or trading, itself flagged low-priority
  in the source doc; even the narrowed "flavor-only popup" version isn't worth the
  identity risk of borrowing from an off-theme genre for marginal payoff.
- **Melvor Idle's "Refinement" mastery sub-track** (secondary XP bar that rewards
  repeating one specific action over and over for slow quality-of-life unlocks) — even
  bounded and non-offline, this is structurally an idle-game mechanic (grind-the-same-
  action-for-passive-upgrades is the core idle-game loop, with or without an offline
  simulator attached). Double-checked per the task brief's explicit idle-game concern:
  skip it. The one genuinely useful part of that research row — auditing that
  Education/Jobs/Crafting actually feed each other — is worth doing as a design sanity
  check, not as a shipped feature.
- **Melvor Idle's offline/AFK progression simulation** — an explicit idle-game mechanic;
  both the source doc and Nexis's own identity rule this out outright.
- **Urban Dead's unified single action-point pool with no NPCs** — would flatten
  Nexis's distinct Adventure/Arena/Job resource loops into one pool and abandon the
  NPC-driven encounter design that's core to Nexis's identity. The source doc itself
  frames this as a cautionary contrast, not something to adopt.
- **Ventures** (personal passive-income business slots that accrue currency on a timer
  and require a manual "collect" click) — this is an idle-tycoon accrue-then-collect
  loop; requiring a manual click doesn't change the underlying idle-game shape, and it
  functionally overlaps with Nexis's existing Property/Housing and (once reworked)
  Consortium economic sinks. Skip rather than add a third overlapping economy system
  with idle-adjacent DNA.
- **A third "Family/Cartel"-tier organization structure** sitting between solo play and
  Guild/Consortium — redundant with the existing two-tier split; the source doc itself
  says reuse existing Guild/Consortium plumbing instead of forking a third org type.
- **A second merit-like currency parallel to Legacy Points** — fragments an already-
  working single-currency system. If Legacy Points feels shallow in any subsystem, audit
  its category breadth (see Later Expansion) rather than launching a competing currency.

---

## 4. Later Expansion

Good ideas, correctly out of scope until the core game is live and stable. Not
rejected — just sequenced after everything above.

- **Legacy Points category-breadth audit** (ensure spend categories span crafting,
  guild, marketplace — not just combat), plus extending categories as Guild Warfare,
  Consortium Rosters, and Mastery Diplomas ship; **Chronicle Completion Bonus** (extra
  points for 100%-clearing a category); **Legacy Milestone Trickle** (small point grant
  every N character levels); categorized-vs-searchable achievement browsing split.
  All low-risk, but several are dependent on systems (Guild Warfare, Rosters) that
  aren't approved yet — sequence after those land, or after this audit if done sooner.
- **Travel safety patterns for a future PvP world** — Transit Ward (in-transit
  immunity), Landing Grace (short post-arrival grace window), Discreet Passage
  (destination-hiding perk). Explicitly low urgency until Guild Warfare (or any other
  PvP surface) exists; worth reserving the pattern now, building nothing yet.
  Similarly: destination-shop 3-tier taxonomy (general/equipment/restricted per city) —
  content-structuring polish for Travel, not urgent.
- **Guild Charter Requests** (multi-apply, editable/withdrawable join applications),
  **Initiate probation rank** for new guild members, and recallable **Guild Loan** mode
  for armory items (vs. permanent donation) — all solid guild-management hardening,
  lower priority than the Guild Warfare / Guild Charters items already surfaced for
  approval, and better sequenced after the in-flight skill-branch rework settles.
- **Per-member guild contribution-balance visibility** for permitted leadership roles,
  tied into the existing guild audit log — a reasonable transparency feature, not
  urgent.
- **Study Efficiency stacking cap, District Access (capstone-unlocked map locations),
  Apprenticeship Legacy (permanent starter-job passive), Course Forfeiture (course
  restart penalty on risky mid-course behavior)** — all reasonable Education-system
  depth from the Torn research, but Education isn't one of the five in-flight
  workstreams right now, so none of this is urgent relative to what's already queued.
- **"Nearby Wanderers" presence counter** (shows how many other players are in the same
  City Board zone/dungeon tier right now) — a cheap, low-risk social-presence signal
  worth adding eventually, but it's polish, not a system, and there's no urgency.
- **Shared "Mission Chronicle" result-page component reused across Job and future
  Crime-chain resolutions** (not just Adventures) — good consistency goal once the
  Adventure-chain version of this pattern (see Implement Now) has shipped and proven
  out; premature to generalize it before the first instance exists.

---

## Cross-reference notes

- Both source docs converged independently on **item-gated progression with a
  tradeable/marketplace fallback** (Kingdom of Loathing row in the browser-RPG doc;
  general gating-pattern discussion implicit in the Torn doc's Education/Travel
  sections). Consolidated into one Implement Now entry rather than repeated.
- Both source docs converged on **Consortiums needing a real employee/hiring loop**
  beyond their current reward-tree shape (Torn doc's Companies §3 "Consortium Roster
  Requests," and the browser-RPG doc's mafia-crime-genre business/job-tier rows more
  generally). Consolidated into the single Roster Requests entry above.
- The **Guild skill-tree expansion** described in the Torn doc's Factions §4 last row
  ("fixed core branch plus a pool of optional specializations, capped active count,
  tuned respec cost") is not a new idea to present — it's a structural description of
  the work already approved and queued. It was moved into Implement Now as a concrete
  design detail for that in-flight branch rather than repeated in Present To User.
