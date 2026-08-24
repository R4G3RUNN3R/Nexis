# Nexis v2 Retirement Register

> **Status:** Approved/default retirement and transformation register for the `voidsmith-source-of-truth` rebuild branch.  
> **Purpose:** Prevent old mechanics, scaffolds, naming debris and architectural accidents from re-entering v2 merely because they existed in the previous version.

Retirement does **not** automatically mean deleting history. Player history and valuable content are preserved where appropriate, while the active mechanic is removed or redesigned.

---

## 1. Active Life Paths

**Current source**
- `server/data/lifePathsData.js`
- `src/data/lifePathsData.ts`
- `src/pages/LifePaths.tsx`
- historical Life Path state inside player snapshots

**Decision:** **RETIRE as active progression.**

**Preserve**
- historical participation;
- old path names/icons/lore as archival content;
- existing player history as unobtainable Feats of Strength where appropriate.

**Do not preserve**
- class-like path selection;
- ongoing mechanical power based on the old path choice;
- path gating that competes with Education + Practical Mastery.

---

## 2. Uniform shallow academy template

**Decision:** **RETIRE.**

The previous assumption that every academy can be represented as the same small number of fixed ranks/courses with uniform durations is incompatible with the v2 Education spine.

**Replace with**
- institution-specific curricula;
- varied course durations;
- meaningful prerequisites;
- capability unlocks;
- certifications/examinations where appropriate;
- Silverbough-specific deep arcane branches.

Old course completion must be mapped deliberately rather than discarded.

---

## 3. Percentage-only Education as the main reward model

**Decision:** **RETIRE as default design.**

Education should primarily unlock knowledge, access, actions, professions, research, crafting, magic or other real capability.

Small passive bonuses can still exist where they represent genuine expertise, but courses should not exist merely to add another +1% line to a character sheet.

---

## 4. Old Spirit low/medium/high 3%/5%/10% system

**Current source**
- `src/data/spiritData.ts`

**Decision:** **RETIRE mechanics, preserve useful identity/art.**

**Replace with approved Spirit v2 design**
- individual Spirits;
- Fire/Water/Wind/Earth/Light/Dark;
- rare encounter + favour;
- permanent dormant Bond;
- Silverbough Attunement;
- continuous 0→5% mature Bond;
- one active Spirit;
- cooldown-only techniques;
- Greater Communion;
- 15-minute Manifestation / 24-hour cooldown;
- approved PvP affinity rules.

---

## 5. Life-path-like fixed character identity at registration

**Decision:** **RETIRE.**

V2 character identity emerges from actual history:

- Education;
- practical mastery;
- professions;
- discoveries;
- relationships;
- organizations;
- Chronicle;
- Spirits;
- Grimoires;
- titles/achievements.

Registration should not lock a player into a pseudo-class for the sake of having one.

---

## 6. Job Points as a generic direct stat shop

**Current source**
- `server/data/civicJobsData.js`
- `server/services/civicJobsService.js`

**Decision:** **RETIRE or sharply reduce direct stat-purchase behavior.**

**Preserve**
- employment;
- rank progression;
- salary;
- professional identity;
- promotion requirements;
- useful job-specific rewards.

**Replace with**
- actual world responsibilities/tasks;
- access/certification;
- professional services;
- employer/institution relationships;
- profession-linked opportunities.

---

## 7. Donor-gated existence of Chronicle

**Current source**
- `server/data/chronicleData.js`

**Decision:** **RETIRE.**

Every character has a Chronicle.

Donor status may affect cosmetic presentation or optional display/export features, but a character's history is not a premium feature.

---

## 8. Achievements + Legacy + Chronicle + Titles as one blurred progression surface

**Decision:** **RETIRE the conflation.**

**Replace with separate concepts**
- **Event Ledger:** authoritative history;
- **Chronicle:** player-facing biography/history;
- **Records:** detailed/private history;
- **Achievements:** accomplishments;
- **Feats of Strength:** rare/retired/non-repeatable historical prestige;
- **Titles:** earned display identity;
- **Legacy:** separately designed bounded progression/reward layer.

Existing legitimate history/points/rewards must be mapped before old storage is retired.

---

## 9. Legacy perks that exist only as another percentage pile

**Current source**
- `server/data/legacyAchievementsData.js`
- `src/data/legacyPerksData.ts`

**Decision:** **TRANSFORM heavily; retire individual effects that cannot justify themselves.**

Do not automatically port dozens of percentage bonuses merely because they were once implemented.

Each retained perk must answer at least one of:
- does it unlock a capability?
- does it represent meaningful specialization?
- does it improve quality-of-life without becoming mandatory power creep?
- is it necessary to preserve legitimate player value?

Where an old player has already earned/spent value, migration must preserve fair value through a mapped replacement or grandfathered history, not silently erase it.

---

## 10. Flat universal Bestiary knowledge

**Decision:** **RETIRE.**

Do not expose full enemy stats/lore merely because the enemy definition exists on the server.

**Replace with progressive research state**
- Unknown
- Encountered
- Studied
- Researched
- Mastered

Server objective truth and player-visible knowledge remain separate.

---

## 11. Flat Codex as one universal encyclopedia

**Decision:** **TRANSFORM.**

The current Atlas/Archives/Discoveries/Records/Manuals/Bestiary structure is useful and preserved, but the underlying assumption that every character sees the same truth is retired.

**Replace with**
- Knowledge/Rumour Graph;
- character-specific discovery;
- observations;
- hypotheses;
- accepted scholarship;
- contradictory claims;
- hidden knowledge;
- server-only objective canon.

---

## 12. Static authored News as the only News source

**Current source**
- `src/data/newsData.ts`
- `src/pages/News.tsx`

**Decision:** **TRANSFORM.**

Authored stories can remain as seed/editorial material, but v2 News should primarily project real public events from the Event Ledger/World State engine.

---

## 13. Decorative/dead duplicate world-event scaffolds

The old code contains multiple overlapping concepts:
- `WORLD_EVENT_TEMPLATES`;
- `CITY_THREAT_EVENTS`;
- `WORLD_BOSS_EVENTS`;
- relational `city_events`;
- player world-event profile state.

The current schema comments explicitly distinguish some of these as dead scaffold or decorative rotation.

**Decision:** **RETIRE duplication after extracting useful content.**

**Replace with** one authoritative World State/Event Engine with phases, contributors and consequences.

---

## 14. Placeholder Contacts/Rivals/Targets pages

**Current source**
- `src/pages/Contacts.tsx`
- `src/pages/Rivals.tsx`
- `src/pages/Targets.tsx`

**Decision:** **RETIRE placeholder implementations.**

The route concepts remain useful.

**Replace with** a real Relationship/Intelligence domain:
- Contacts;
- Rivals;
- Targets/investigations.

---

## 15. Tavern placeholder

**Current source**
- `src/pages/Tavern.tsx`

**Decision:** **RETIRE placeholder implementation; KEEP reserved concept.**

**Replace with** unofficial information/rumour/contract/social hub.

---

## 16. Bank placeholder as assumed Torn parity

**Current source**
- `src/pages/Bank.tsx`

**Decision:** **DEFER/RETIRE assumption that a Torn-like bank must exist.**

A Bank should only be built once the v2 economy design has a reason for deposits, reserves, interest or finance products.

Organization treasury remains separate and server-verified.

---

## 17. Targeting/bounty as direct click-to-attack gameplay

**Decision:** **RETIRE as primary bounty experience.**

**Replace with**
- lead;
- investigation;
- tracking;
- location uncertainty;
- interception;
- kill/capture choice;
- restraint/transport/delivery for captures.

NPC bounties come before unrestricted player capture.

---

## 18. Full player capture before abuse/offline rules exist

**Decision:** **DO NOT IMPLEMENT YET.**

Player capture is blocked until the dedicated design resolves:
- offline targeting;
- griefing;
- imprisonment duration;
- escape;
- PvP consent/eligibility;
- anti-farming;
- abuse reporting;
- economic consequences.

NPC bounty/capture can ship first.

---

## 19. CIEL as generic tutorial software

**Decision:** **RETIRE conceptually.**

CIEL may teach/guide players, but she is canonically a separated sliver of Hennet's mind who developed true individuality across immense time.

Do not write her as:
- generic assistant software;
- UI tooltip narrator;
- omniscient quest marker;
- cheerful tutorial mascot.

**Replace with** contextual analysis, interpretation, warnings and cross-system synthesis consistent with her canon.

---

## 20. CIEL as universal spoiler oracle

**Decision:** **FORBIDDEN.**

The server knowing objective canon does not mean CIEL should reveal it to ordinary characters.

Player-visible information must respect:
- what the player knows;
- what CIEL chooses/can reveal;
- Hennet's concealment;
- narrative mystery;
- world scholarship versus objective truth.

---

## 21. Hennet's true/admin profile in ordinary API payloads

**Decision:** **FORBIDDEN.**

No client-visible UI hiding is sufficient.

Unauthorized clients receive only Hennet's public ordinary-player projection. The true profile/admin data is never serialized to them.

---

## 22. Name/title/lore-based administrator authorization

**Decision:** **FORBIDDEN.**

Admin power never comes from:
- `Hennet Uthellien` display name;
- `The Absolute` title;
- Chronicle/lore flags;
- client state;
- public profile fields.

Server-side trusted account identity/roles are the only authority.

---

## 23. Blind-overwrite JSONB as the authority for transactional uniqueness

**Decision:** **RETIRE as a concurrency boundary.**

The old code already learned this lesson and introduced relational ledgers for one-shot grants/completions.

Do not put these solely in mutable player JSON:
- money transfers;
- market orders;
- contracts;
- escrow;
- unique rewards;
- shared projects;
- public world events;
- important historical events;
- organization ownership;
- provenance;
- one-time consumptions.

JSONB remains allowed for flexible low-contention state.

---

## 24. Duplicate client/server content authority

Several concepts exist as both `server/data/*.js` and `src/data/*.ts`.

**Decision:** **RETIRE duplicated authority where possible.**

V2 should have one canonical domain/data source and expose client-safe projections through APIs/shared packages where appropriate.

Frontend-only display metadata can remain client-side when it is genuinely presentation-only.

---

## 25. Dual router/database-client dependencies without a demonstrated need

Current `package.json` contains both:
- `react-router-dom` and `wouter`;
- `pg` and `@electric-sql/pglite`.

**Decision:** **REVIEW then RETIRE unused duplicate dependencies.**

Do not remove them until current usages are mapped, but the v2 architecture should not carry parallel foundational libraries by inertia.

---

## 26. Old service name `nexis-waitlist.service` as architecture terminology

The systemd unit currently runs the full Nexis API despite its historical waitlist name.

**Decision:** **RETIRE name in v2 deployment.**

The old service remains untouched on Hetzner.

New deployment gets explicit v2 service/container naming after application architecture is approved.

---

## 27. Old build output as active source

**Current source**
- `/srv/nexis/frontend/current`
- `dist/`

**Decision:** **ARCHIVE only.**

Compiled output is useful for visual/regression comparison but never becomes the source of truth for v2.

---

## 28. Old `node_modules`

**Decision:** **DO NOT MIGRATE into active v2 source.**

Dependencies are recreated from the lockfile/package manifest in a clean workspace.

---

## 29. Historical worktrees as active source

The old server contained roughly 7.3 GB of worktrees, many with duplicate dependencies and stale branches.

**Decision:** **ARCHIVE selective salvage only.**

Unique modified/untracked source files were preserved in `/srv/voidsmith/nexis/legacy/worktree-salvage`.

Do not merge them wholesale. Every salvaged change must be reviewed against current source and approved v2 design before reuse.

---

## 30. Temporary verification/codex probe files as product code

Examples include:
- `.codex-temp*`
- `.tmp-*`
- `tmp_*verify*`
- screenshots/test artifacts
- old canary scripts not deliberately adopted

**Decision:** **ARCHIVE.**

Extract lessons/test cases where useful; do not promote incidental debugging artifacts into v2 structure.

---

## 31. Old standalone HTML/CSS/JS prototypes as active application

Examples:
- `nexis_site_index.html`
- `nexis_site_login.html`
- `nexis_site_register.html`
- `nexis_site.css`
- `nexis_site.js`

**Decision:** **ARCHIVE after design/content extraction.**

React/TypeScript v2 becomes the maintained web application unless a later architecture decision explicitly changes that.

---

## 32. Old internal city naming debris

Examples include historical/internal identifiers that no longer match public city canon.

**Decision:** **TRANSFORM deliberately.**

Do not casually rename live IDs during migration. Build an explicit mapping table from old IDs to canonical v2 IDs and verify every player/item/route/world-state reference.

---

## 33. Hellenic Sphere as automatically launch-ready content

**Current source**
- `src/data/hellenicRegionalPack.ts`

**Decision:** **PRESERVE but DEFER launch inclusion.**

It remains valuable expansion material. Whether it belongs in the initial v2 playable world is a separate world-scope decision.

---

## 34. Generic daily caps as universal balancing tool

**Decision:** **DO NOT ADOPT as a design habit.**

Nexis already has strong pacing primitives:
- real-time Education;
- cooldowns;
- travel time;
- resources;
- world opportunity;
- research duration;
- organization/project requirements.

Daily caps may exist only where a specific design genuinely needs one.

---

## 35. New resource bars without a compelling systemic reason

**Decision:** **DO NOT ADOPT.**

The approved Spirit design deliberately uses cooldowns rather than a Spirit Energy bar so non-casters can participate cleanly.

New resources require a real modeling/balance purpose, not feature ornamentation.

---

## 36. Full-loot PvP

**Decision:** **DO NOT ADOPT.**

The current economy is not built around destruction/replacement at the scale required for full-loot PvP.

PvP risk can be meaningful without copying Albion/EVE's destruction economy wholesale.

---

## 37. Account-wide sharing of character-defining progression

**Decision:** **DO NOT ADOPT by default.**

Education, Bonds, discoveries, major titles and Chronicle are character-history systems.

Any future account-wide convenience must be explicitly designed so it does not erase character identity.

---

## 38. Implementation directly inside the preserved legacy tree

**Decision:** **FORBIDDEN.**

The preserved old Nexis lives under:

`/srv/voidsmith/nexis/legacy`

and remains reference/migration material.

Active v2 work is performed from the isolated source-of-truth workspace:

`/srv/voidsmith/nexis/worktrees/voidsmith-source-of-truth`

on branch:

`voidsmith-source-of-truth`.

---

## 39. Retirement review rule

Before any old feature is deleted from migration logic, answer all four questions:

1. Does a legitimate player currently own/progress/use anything tied to it?
2. Does it contain lore/content/assets worth preserving?
3. Does it encode an engineering or abuse-prevention lesson worth retaining?
4. Does it need a historical representation in Chronicle/Feats rather than disappearance?

Only after those are answered may the active mechanic be removed.