# Nexis 2.0 Canon and Lore Manifest

_Status: approved canonical world/lore decision, 2026-08-25._

## Purpose

This document preserves the authoritative identity of the Nexis world independently of legacy implementation details.

The Nexis 2.0 rebuild is a technical/system rebuild, not a setting reboot. Old code, data files, UI copy, map aliases or partially implemented mechanics may be useful evidence, but they do not override current approved canon.

For worldbuilding, geography, institutions, academy identity and lore, use this precedence:

1. explicit current human-approved canon;
2. this `CANON-AND-LORE.md` manifest;
3. other approved v2 canon/specification documents that do not conflict with this manifest;
4. legacy v1 content/data as preservation evidence;
5. research/brainstorm material;
6. agent inference only where canon is genuinely silent.

If legacy source contradicts this manifest, preserve the legacy source for migration/history but do not reproduce its contradiction in Nexis 2.0.

## Permanent preservation rule

Agents may redesign mechanics, balance, formulas, UI, persistence and code architecture while preserving the world identity underneath them.

Do not casually rename, merge, split, relocate or reinterpret canonical cities, academies, cultures or institutional purposes during implementation work.

If a task would materially change canon, it requires an explicit canon/design decision rather than an implementation-side assumption.

### Additive world-expansion rule

When the human asks to **add**, **create**, **introduce** or **expand** a city, region, academy, faction, culture or other canonical world element, the default meaning is additive.

The implementer must not make room for the new element by silently replacing, merging, aliasing, renaming, relocating or retiring an existing canonical element.

A fixed enum, compass slot, UI layout, database shape, route model or other implementation limitation is a software constraint to be redesigned. It is never authority to rewrite canon.

Replacing or merging an existing canonical world element requires explicit human approval stating that the existing element is being replaced, merged, retired or reinterpreted.

The Ironhall/Akai Tetsu incident is the standing example: Ironhall was requested as a new city; replacing Akai Tetsu with Ironhall was not requested and was canon drift.

## Core academy/world canon

### Nexis City

Nexis City remains the central/core city and primary world anchor.

This document does not redefine every civic institution in Nexis City. Existing useful civic/economic/lore material may be preserved where it does not conflict with later approved canon.

### Silverbough

**Canonical identity:** the principal academy/location for formal magical education.

Silverbough teaches:

- magical fundamentals;
- access to and control of Mana;
- the progression that grants/unlocks the player's Mana bar;
- item magic infusion;
- magical item enhancement and related enchantment/infusion disciplines.

Silverbough is not to be reinterpreted as the primary general healing academy merely because older data mixed healing, relic and arcane themes together.

Healing magic belongs primarily to the Sacred Grove path described below.

Exact spell lists, Mana values, course durations, costs and balance numbers are mechanics and may be redesigned unless separately locked.

### Ironhall

**Canonical identity:** a separately intended dwarven/tinkering-race city and the principal crafting, engineering and building centre.

Ironhall was conceived as an **additional city** during expansion of the original Nexis world. It was not intended to replace, rename or absorb Akai Tetsu.

Ironhall is home to dwarves and other tinkering/building peoples such as gnomes and equivalent setting-appropriate crafting cultures.

Ironhall teaches broadly:

- crafting;
- building;
- fabrication;
- engineering/tinkering;
- tools and workshop disciplines;
- material handling;
- construction and creation-oriented practical skills.

Ironhall is not primarily the combat/tactics academy. Any implementation that replaces Akai Tetsu with Ironhall or makes Ironhall's academy chiefly a battle-stat school is legacy AI drift, not approved canon.

The exact geographic placement of Ironhall relative to the original five world anchors remains available for deliberate map/world design; lack of a free legacy compass slot must never be solved by deleting another city.

### Akai Tetsu Dojo

**Canonical identity:** a major academy inspired by Edo-period Japan.

Akai Tetsu Dojo teaches:

- combat fundamentals;
- tactical fundamentals;
- martial discipline;
- battlefield awareness and related martial/tactical progression.

Akai Tetsu is a distinct academy identity. It must not be silently folded into Ironhall merely because old code used an alias tying `akai_tetsu_war_dojo` to the eastern/Ironhall location model.

Akai Tetsu predates Ironhall in the surviving early Nexis material. The later request to create Ironhall was additive and did not supersede Akai Tetsu.

The exact geographic placement, city/settlement relationship and detailed curriculum beyond the approved identity above remain subject to later canon/specification where not already established elsewhere.

### Sacred Grove

**Canonical geography:** directly south of Nexis City, across the sea, on an island.

**Canonical identity:** sacred Druidic/Shamanic academy and spiritual healing centre.

The Sacred Grove is where Druids, Shamans and related traditions teach healing magic.

Its progression includes:

- healing magic;
- advanced restorative magic;
- for suitably **gifted** characters, access to resurrection magic.

The Sacred Grove therefore fills the broad gameplay role analogous to Torn's Medical progression, but expressed through Nexis's fantasy world and academy system rather than modern medicine.

`Gifted` is a real progression/canon gate. The exact eligibility rule, discovery method, rarity, mechanical prerequisites and resurrection balance are not defined by this document and must be designed deliberately later.

The Sacred Grove is not Highcourt, is not a Highcourt sub-academy, and must not be collapsed into the Blackharbor/Highcourt academy.

## Blackharbor / Highcourt unified city and academy

### Canonical city relationship

Blackharbor and Highcourt are **essentially one city**, not two unrelated major academy cities.

For Nexis 2.0, treat them as one shared urban/city entity for academy and progression purposes unless a later canon decision defines internal districts, quarters or naming more precisely.

Do not implement separate Blackharbor and Highcourt academy progressions from the old v1 split.

### One academy, shared foundation

The city has **one academy**.

The first three education lessons form the shared/common foundation.

After the third lesson, the academy path **diverges** and the player chooses exactly one of two mutually exclusive specializations:

1. **Light Path**
2. **Shadow Path**

Choosing one forfeits active access to the other path unless the player later completes the formal path-switch process.

### Light Path

The Light Path develops a bounty-hunter / lawful hunter skillset.

Its intended capability identity includes:

- taking up bounties;
- tracking or pursuing bounty targets as later systems define;
- capturing targets;
- delivering/processing targets through lawful bounty/custody systems;
- related lawful pursuit and capture capabilities.

Exact abilities, contracts, rewards, legality rules, tracking precision and capture mechanics remain separate gameplay-design work.

### Shadow Path

The Shadow Path develops a headhunter/assassin skillset.

Its intended capability identity includes:

- taking up kill/capture contracts;
- hunting contracted targets;
- killing targets where the contract/rules allow;
- capturing targets where the contract/rules allow;
- related covert pursuit and contract-execution capabilities.

Exact assassination, PvP, capture, contract, legality, consequence and anti-abuse mechanics remain separate gameplay-design work.

### Mutual exclusivity and path switching

The Light and Shadow paths are mutually exclusive as the character's currently active academy specialization.

Rules:

- after the shared third lesson, the player chooses Light or Shadow;
- taking one forfeits the other as the active path;
- the player may later change paths;
- changing paths requires a significant cost/requirements package and a significant cooldown;
- when changing to the other path, the player must perform that path's training if it has not already been completed;
- previously completed training is permanently remembered and is **not erased** by switching away;
- therefore, if a player later returns to a path whose training they already completed, that historical completion remains valid;
- repeat switching becomes progressively more expensive/restrictive rather than allowing casual oscillation;
- after the player has already paid for/completed one path change, the requirements and cooldown for changing again are doubled;
- each further repeated change should continue the same escalating-doubling principle unless later explicitly superseded.

The exact base monetary/material/reputation requirements and base cooldown duration are intentionally not fixed here. They must be balanced later without weakening the canonical commitment cost of changing specialization.

## Canon versus mechanics

The following are **canon/product identity** and should survive implementation changes:

- Silverbough = magic, Mana, item infusion/enhancement;
- Ironhall = a separately added dwarven/tinkering-race crafting, engineering and building city, not an Akai Tetsu replacement;
- Akai Tetsu Dojo = Edo-Japan-inspired combat/tactics academy;
- Sacred Grove = island directly south of Nexis City, Druid/Shaman healing and gifted resurrection path;
- Blackharbor + Highcourt = one shared city identity for academy/progression purposes;
- Blackharbor/Highcourt academy = three common lessons followed by mutually exclusive Light/Shadow specialization;
- Light = bounty hunter/capture identity;
- Shadow = headhunter/assassin kill-or-capture identity;
- switching paths is possible but costly, cooldown-gated and increasingly punitive with repeated switching;
- completed path training is remembered permanently even when inactive;
- requests to add new world content are additive unless explicit human approval says an existing canonical element is to be replaced/merged/retired.

The following are **mechanics/balance** unless separately approved and may change:

- exact percentage bonuses;
- exact Mana values;
- exact currency/material costs;
- exact cooldown duration;
- lesson/course duration;
- exact number of later specialization lessons;
- exact tracking precision;
- exact capture/kill formulas;
- exact resurrection eligibility algorithm or cost;
- exact item-enhancement success rates.

## Known legacy contradictions

The following existing v1 data is preservation evidence but is **not authoritative where it conflicts with this document**:

- early April Nexis material correctly preserves Akai Tetsu as the eastern combat/tactics academy and the Sacred Grove/Spiritwood Sacred Isle as the southern healing/revival academy;
- Ironhall was later requested as a new additional dwarven/tinkering/crafting city; the request did not authorize replacement of Akai Tetsu;
- the 17 May 2026 `Implement city-local hubs and travel encounters` change introduced a five-slot normalized city model that replaced Akai Tetsu with Ironhall in the east slot and replaced the Sacred Isle with Highcourt in the south slot, while aliasing the old locations into those replacements; those substitutions are AI implementation drift, not canon evolution;
- `server/data/cityData.js` models Blackharbor and Highcourt as separate primary city identities and aliases Akai Tetsu into the eastern/Ironhall bucket;
- later `src/data/academyData.ts` assigns combat-heavy progression to Ironhall, combines broad healing with Silverbough, and models separate Blackharbor/Highcourt academy identities rather than the approved unified academy divergence;
- `src/data/worldMapData.ts` contains useful coordinates, regions, routes and continuity evidence, but any city/academy association that conflicts with this document must be transformed during v2 canon migration rather than copied blindly;
- legacy aliases that collapse Sacred Grove/Spiritwood into Highcourt are superseded for canon purposes.

Do not delete these legacy sources merely because they are wrong for current canon. They remain useful migration/history evidence and may contain valid non-conflicting lore.

## Preservation/migration expectation

Before world/education/travel migration is considered complete:

1. inventory legacy city, region, academy, Codex and map content;
2. classify each datum as `ORIGINAL_CANON`, `APPROVED_EVOLUTION`, `COMPATIBLE_EXPANSION`, `AI_DRIFT`, `SUPERSEDED`, `RUMOURED`, `EXPANDABLE`, `RETIRED` or `UNRESOLVED`;
3. preserve non-conflicting lore and named-world history;
4. distinguish additive approved expansions such as Ironhall from unauthorized replacement/merging decisions introduced during implementation;
5. transform conflicting academy/city mappings into this approved canon;
6. never silently drop meaningful worldbuilding because its old implementation model changed;
7. keep source references/provenance where practical so future engineers can tell which world facts were inherited versus newly expanded.

## Agent rule

Any Claude/Codex/other agent working on World, Travel, Education, Academies, Magic, Crafting, Combat, Justice/Bounties, Contracts, Healing/Recovery, Codex, CIEL lore synthesis or migration must read this document before implementation.

An agent may identify a contradiction or propose a richer canon model. It may not silently rewrite these approved facts while implementing code.

When asked to add a new canonical world element, the agent must preserve existing canonical elements by default and expand the model to accommodate the addition. It may not treat an implementation limit as permission to overwrite canon.
