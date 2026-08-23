# Nexis v2 Spirit System Design

**Date:** 2026-08-23  
**Status:** Approved architectural design, pending implementation plan

## 1. Purpose

The Spirit system is a long-term progression subsystem that combines rare world discovery, relationship progression, Silverbough education, active supernatural techniques, PvP affinity strategy, Codex knowledge, and Chronicle history.

A Spirit is a real individual being, not an inventory buff. The player must find one, earn its favour, establish a permanent Bond, train at Silverbough to activate that Bond, and then deepen the relationship over months of real equipped time and affinity-aligned activity.

The system must work for casters and non-casters alike. Conventional magic and Spirit Magic are separate progression models.

## 2. Design Goals

The system must:

1. make Spirit discovery genuinely rare and memorable;
2. reward preparation and world knowledge without turning discovery into a deterministic farm;
3. keep Spirit individuality narrative rather than creating hidden mechanical quality rolls;
4. use Education as a progression gate rather than allowing rare RNG to bypass the rest of Nexis;
5. allow only one active Spirit at a time;
6. make Bond growth meaningful over months rather than days;
7. keep active Spirit techniques usable by non-caster builds;
8. preserve strategic elemental matchups without letting Spirits overpower the rest of the character build;
9. prevent cooldown resets, reroll exploits, trivial-action Bond farming, and client-authoritative abuse;
10. separate Codex knowledge, Spirit relationship state, Chronicle history, and Feats of Strength;
11. keep dramatic temporary power in Manifestation rather than permanent passive stacking.

## 3. Core Player Loop

The canonical progression loop is:

1. The player completes a qualifying adventure or exploration resolution.
2. The server determines whether that resolution is eligible for a Spirit encounter roll.
3. The server rolls the Spirit encounter chance.
4. If successful, the server rolls Spirit affinity.
5. The player completes that individual Spirit's favour trial.
6. Success establishes a permanent but dormant Bond.
7. The player equips/attunes that Spirit.
8. The player travels to Silverbough.
9. The player completes Spirit Attunement for that bonded Spirit.
10. The Bond becomes mechanically active and begins at 0% boon strength.
11. The player develops the Bond through active-equipped time plus qualifying affinity-aligned actions.
12. The player completes the affinity-specific Spirit Magic curriculum.
13. The passive boon grows continuously toward its mature value.
14. At mature Bond plus completed Manifestation training, Spirit Manifestation becomes available.

The system intentionally separates six concepts:

- **Discovery:** finding the Spirit.
- **Favour:** convincing the Spirit to accept the player.
- **Bond ownership:** permanent relationship state.
- **Education:** what the player knows how to do with the Spirit.
- **Bond development:** how deep and powerful the relationship has become.
- **Manifestation:** the strongest temporary expression of that relationship.

## 4. Spirit Discovery

### 4.1 Encounter eligibility

Spirit rolls occur only on genuine, server-validated discovery opportunities. Examples include resolved exploration, adventures, hidden-site outcomes, and other future world activities explicitly marked Spirit-eligible.

The following do not create Spirit encounter rolls by themselves:

- page refreshes;
- cancelled actions;
- repeated client requests;
- zero-value loops;
- fake or aborted travel;
- arbitrary button clicks.

### 4.2 Base encounter probability

The standard encounter chance is **0.25% per qualifying exploration/adventure resolution**, approximately 1 in 400 eligible opportunities.

Context may improve the chance:

- normal qualifying resolution: **0.25%**;
- strong elemental region/event/context: approximately **0.50%**;
- rare Spirit-focused site/event: up to approximately **1.00%**.

The server owns eligibility and probability resolution.

### 4.3 Affinity distribution

Affinity is rolled only after a Spirit encounter succeeds.

| Affinity | Chance |
|---|---:|
| Fire | 24% |
| Water | 24% |
| Wind | 24% |
| Earth | 24% |
| Light | 2% |
| Dark | 2% |

Each Apex affinity is therefore roughly 1 in 50 Spirit encounters, while either Apex affinity is roughly 1 in 25 Spirit encounters.

### 4.4 Knowledge-guided hunting

Knowledge can improve where a player chooses to search, but never reveals exact deterministic coordinates.

Clues may come from:

- Codex entries;
- History education;
- ruins and relic discoveries;
- NPC rumours;
- Spirit relationship scenes;
- old journals;
- expedition records;
- world events;
- environmental signs.

Clues describe likely environments, conditions, regions, or events. They can lead players toward more qualifying or boosted opportunities, but the rare encounter roll still applies.

## 5. Individual Spirit Identity

Spirits are unique individuals inside shared mechanical affinities.

Two Spirits of the same affinity may differ in:

- name;
- appearance;
- temperament;
- dialogue;
- favour trial structure;
- personal history;
- preferred regions or conditions;
- relationship scenes.

They do **not** differ in hidden mechanical power quality. A Fire Spirit at a given Bond state uses the same Fire-affinity mechanics as another Fire Spirit at the same Bond state.

This prevents rerolling for mechanically superior Spirits.

## 6. Favour Trials

Finding a Spirit does not grant the Bond automatically.

The Spirit presents a trial that may involve:

- questions;
- dilemmas;
- requested actions;
- proof of behaviour;
- short multi-stage tests.

Illustrative ordinary affinity values are:

- Fire: courage, decisiveness, passion, action;
- Wind: freedom, instinct, adaptability, refusal to be controlled;
- Water: patience, empathy, perception, adaptability;
- Earth: resolve, reliability, craftsmanship, protection.

Light and Dark favour trials are harder through content, not through an additional hidden RNG success check. Their trials may use stricter behavioural requirements, more demanding questions, multiple stages, or harder requested actions.

### 6.1 Failure and retry

Failing a favour trial does not destroy the encounter or reroll the Spirit.

- The discovered Spirit remains associated with that player.
- The player does not repeat the rare encounter roll.
- Failure starts a **7-day real-time retry cooldown**.
- After seven days, the player may retry.
- Repeated failures may repeat the same seven-day lockout.

The same rule applies to Light and Dark.

## 7. Bond Ownership and Collection

A player may establish at most **one permanent Bond per affinity**.

The maximum bonded affinity collection is therefore:

- Fire;
- Water;
- Wind;
- Earth;
- Light;
- Dark.

A player may still encounter additional individual Spirits of an affinity already bonded. Duplicate-affinity encounters:

- do not reroll into a missing affinity;
- do not stack bonuses;
- do not create a second Bond;
- do not replace the existing Spirit with a mechanically better roll;
- may add Codex entries, lore, clues, dialogue, ecology, and non-power relationship content.

An established Bond is permanent progression. It cannot be traded, sold, stolen, reset by switching, erased through routine death, or permanently destroyed as a narrative punishment.

Temporary story separation is permitted, but it cannot delete months of Bond progress.

## 8. Silverbough Spirit Studies

Spirit education is taught at Silverbough and uses a shared foundation followed by affinity-specific schools.

### 8.1 Shared foundation

The foundation is linear:

```text
Spirit Lore
   ↓
Spirit Communication
   ↓
Bond Theory
   ↓
[Real permanent Spirit Bond required]
   ↓
Spirit Attunement
   ↓
Bond activates
   ↓
Affinity-specific Spirit Magic school
```

**Spirit Lore, Spirit Communication, and Bond Theory are global theoretical courses and are completed only once per character.** They may be completed before the player has found any Spirit.

**Spirit Attunement is performed separately for each permanent Spirit Bond.** Every newly bonded affinity therefore requires its own 21-day Attunement before that specific Bond becomes mechanically active and its affinity curriculum opens.

### 8.2 Shared foundation durations

| Course | Duration |
|---|---:|
| Spirit Lore | 10 days |
| Spirit Communication | 14 days |
| Bond Theory | 18 days |
| Spirit Attunement | 21 days per bonded Spirit |

The one-time pre-Bond theoretical preparation totals 42 days. Each permanent Bond then requires its own 21-day Attunement.

### 8.3 Spirit Attunement effect

Completing Spirit Attunement for a specific Bond:

- changes that Bond from dormant to active;
- starts that Bond's numerical progression at 0%;
- starts active-equipped time accumulation for that Bond;
- enables activity-based Bond acceleration for that Bond;
- unlocks the matching affinity-specific Spirit Magic school.

## 9. Affinity-Specific Spirit Magic Schools

Each affinity has six courses:

1. initial channeling;
2. defensive or utility technique;
3. active affinity technique;
4. advanced affinity technique;
5. Greater Communion;
6. Manifestation training.

### 9.1 Ordinary affinity durations

Fire, Water, Wind, and Earth use:

| Course | Duration |
|---|---:|
| I | 10 days |
| II | 12 days |
| III | 14 days |
| IV | 16 days |
| V | 18 days |
| VI | 22 days |

Total: **92 days**.

### 9.2 Apex affinity durations

Light and Dark use:

| Course | Duration |
|---|---:|
| I | 12 days |
| II | 14 days |
| III | 16 days |
| IV | 18 days |
| V | 21 days |
| VI | 24 days |

Total: **105 days**.

Apex schools are longer but use the same six-course structure rather than extra filler courses.

## 10. Six Spirit Magic Curricula

### 10.1 Fire

1. **Ember Channeling**: manipulate minor flame, ignite mundane materials, and sense abnormal heat or fire sources.
2. **Flame Ward**: temporary protection against fire, burning, and severe heat.
3. **Combustive Projection**: active Spirit-powered offensive fire technique.
4. **Infernal Resonance**: temporarily infuse an attack or weapon with Spirit flame for stronger offensive pressure.
5. **Greater Fire Communion**: powerful temporary communion focused on aggression, flame control, and resistance to hostile fire.
6. **Fire Manifestation**: completes the educational requirement for Fire Manifestation.

### 10.2 Water

1. **Flow Channeling**: manipulate small quantities of water and sense nearby water or impurities.
2. **Tidal Veil**: defensive technique that cushions or redirects incoming force.
3. **Binding Current**: control technique that impedes, slows, or restrains a target.
4. **Restorative Current**: Spirit-assisted recovery capable of healing or removing lesser harmful conditions.
5. **Greater Water Communion**: major restorative/control state allowing stronger healing, cleansing, and battlefield control.
6. **Water Manifestation**: completes the educational requirement for Water Manifestation.

### 10.3 Wind

1. **Breeze Channeling**: manipulate airflow and sense changes in weather or air movement.
2. **Slipstream**: movement/evasion technique allowing rapid repositioning or escape.
3. **Gale Step**: stronger burst movement with combat and exploration applications.
4. **Cutting Gale**: offensive pressure through concentrated Spirit wind.
5. **Greater Wind Communion**: major mobility state improving movement, escape, evasion, and wind control.
6. **Wind Manifestation**: completes the educational requirement for Wind Manifestation.

### 10.4 Earth

1. **Stone Communion**: sense stone, minerals, instability, and structural weaknesses.
2. **Earthen Ward**: defensive barrier or reinforcement technique.
3. **Stonebind**: restrain, obstruct, or impede movement through earth and stone.
4. **Artisan's Resonance**: Spirit-assisted crafting affecting smithing, materials, and structural work.
5. **Greater Earth Communion**: major defensive/crafting communion improving fortification and material control.
6. **Earth Manifestation**: completes the educational requirement for Earth Manifestation.

### 10.5 Light

1. **Luminous Channeling**: produce and manipulate Spirit light and reveal some unnatural darkness or corruption.
2. **Radiant Ward**: strong protection-oriented Spirit technique.
3. **Purifying Touch**: remove or weaken poisons, curses, debuffs, or other harmful effects.
4. **Sanctuary**: create a temporary protected area focused on mitigation and recovery.
5. **Greater Light Communion**: major protection/restoration state capable of powerful cleansing and defensive support.
6. **Light Manifestation**: completes the educational requirement for Light Manifestation.

### 10.6 Dark

1. **Umbral Channeling**: manipulate shadow, suppress presence, and sense some hostile magical influence.
2. **Veil of Gloom**: concealment/suppression technique useful in combat and Shadow activities.
3. **Spirit Hex**: apply a meaningful curse or debuff to a target.
4. **Life Siphon**: offensive Spirit technique that drains vitality or weakens an opponent while benefiting the user in a limited fashion.
5. **Greater Dark Communion**: major offensive/debuff state increasing suppression, curse, and pressure capability.
6. **Dark Manifestation**: completes the educational requirement for Dark Manifestation.

## 11. Education vs Bond Progression

The two systems have separate responsibilities:

```text
EDUCATION
What can I do with this Spirit?

BOND
How deeply connected am I to this Spirit?
```

Education unlocks techniques and Manifestation training.

Bond controls the continuously growing passive boon and the maturity requirement for Manifestation.

Active Spirit techniques do not continuously rescale with every fractional Bond percentage. Their concrete values are defined explicitly in the combat, healing, crafting, or status-effect systems they use.

## 12. Active Spirit and Attunement

A player may own multiple Bonds, but only **one Spirit may be equipped/actively attuned at a time**.

Only the equipped Spirit:

- gains Bond progress;
- provides its passive boon;
- enables its matching active Spirit techniques;
- can use Greater Communion;
- can Manifest.

Inactive Spirits:

- do not gain passive Bond progress;
- do not gain activity Bond progress;
- provide no passive boon;
- cannot use their affinity techniques;
- preserve their exact Bond progress permanently.

### 12.1 Switching cooldown

Switching to another bonded Spirit starts a **12-hour real-time attunement cooldown**.

- The new Spirit becomes active immediately.
- Its boon and Bond progression apply immediately.
- Another Spirit cannot be selected until the 12-hour cooldown expires.
- The cooldown does not weaken or pause the newly selected Spirit.
- Spirit choice is locked after PvP begins.

## 13. Bond Development

### 13.1 Hybrid progression

Bond progression uses both:

1. passive real active-equipped time; and
2. qualifying affinity-aligned activity.

Illustrative aligned activity themes:

- Fire: combat, danger, decisive/offensive actions;
- Wind: travel, evasion, exploration, mobility;
- Water: spellcasting, support, adaptive/restorative actions where relevant;
- Earth: crafting, defense, endurance, protection;
- Light: healing, cleansing, warding, protection, rescue;
- Dark: curses, debuffs, concealment, pressure.

Activity gains are server validated.

### 13.2 Anti-farming

The system must reject or ignore progress from trivial/replayed actions such as:

- repeated trivial fights;
- zero-value crafting loops;
- refresh spam;
- cancelled travel;
- fake healing where no meaningful damage existed;
- duplicated/replayed requests;
- client-side timer manipulation.

Implementation may use eligibility rules, diminishing returns, contribution ceilings, or contextual weights as needed, but these mechanisms must not allow the maturity floor to be bypassed.

### 13.3 Timeline

A mature 5% Bond is deliberately long-term:

- passive equipped time alone: approximately **9 months**;
- aligned activity can accelerate development;
- activity may reduce the total effective development time by at most roughly one-third;
- absolute intended minimum: approximately **6 months**;
- regular active-player expectation: roughly **7-8 months**.

Unequipping freezes progress immediately without losing previously earned progress.

### 13.4 Continuous boon curve

The boon grows continuously:

- first 3 months of passive-equivalent progress: **0% to 3%**;
- next 6 months of passive-equivalent progress: **3% to 5%**.

Activity accelerates advancement along this same underlying curve while respecting the 6-month floor.

The UI may display precise values such as +1.47%, +3.62%, or +4.91%.

## 14. Mature Ordinary Spirit Boons

The four ordinary affinities are:

- **Fire:** offensive / attack effectiveness;
- **Water:** magical / spell / skill effectiveness;
- **Wind:** evasion / avoidance / dodge;
- **Earth:** defense and crafting effectiveness.

A mature ordinary Spirit has a **5% total boon budget** before PvP affinity adjustment.

## 15. Light and Dark Apex Spirits

Light and Dark sit outside the ordinary four-element wheel.

They are rarer, harder to earn favour from, and strategically stronger in affinity matchups, but do not receive a larger permanent raw boon budget.

### 15.1 Light mature boon

Light uses an even split:

- **+2.5% protection / mitigation effectiveness**;
- **+2.5% restoration / cleansing effectiveness**.

### 15.2 Dark mature boon

Dark uses an even split:

- **+2.5% offensive pressure**;
- **+2.5% curse / debuff effectiveness**.

The exact definitions of these terms belong to the combat/healing/status systems and must preserve the combined 5% mature budget.

## 16. PvP Affinity

Spirit affinity modifies the active Spirit boon, not the player's entire build.

### 16.1 Ordinary elemental wheel

| Active Spirit | Advantage over | Disadvantage against | Neutral against |
|---|---|---|---|
| Fire | Earth | Water | Fire / Wind |
| Water | Fire | Wind | Water / Earth |
| Wind | Water | Earth | Wind / Fire |
| Earth | Wind | Fire | Earth / Water |

Mature ordinary values:

- disadvantage: **4%** effective boon;
- neutral: **5%** effective boon;
- advantage: **6%** effective boon.

### 16.2 Apex relationships

Light and Dark use the same total-boon matchup scale while preserving their even two-part specialisation split.

- Light has advantage over Fire, Water, Wind, and Earth.
- Dark has advantage over Fire, Water, Wind, and Earth.
- Ordinary elements do not gain advantage over Light or Dark; their own Spirit boon remains at the neutral **5%** level against an Apex Spirit.
- Light and Dark are both advantaged against each other.
- Light vs Light is neutral.
- Dark vs Dark is neutral.

At mature Bond:

- an Apex Spirit in an advantaged matchup uses **6% total boon**, split evenly as **3% + 3%** across its two specialisations;
- an Apex Spirit in a neutral matchup uses **5% total boon**, split as the normal **2.5% + 2.5%**;
- there is no ordinary-element matchup that gives Fire, Water, Wind, or Earth an advantage over Light or Dark.

While Manifested, both neutral and advantaged Apex matchups cap at **10% total boon**, split **5% + 5%**, consistent with the absolute Spirit ceiling.

Spirit choice is locked when PvP begins.

## 17. Spirit Technique Resource Model

Spirit Magic uses **cooldowns, not mana**.

This is intentional so fighters, archers, rogues, crafters, and other non-caster builds can fully use Spirit progression.

Spirit techniques:

- require no mana by default;
- use no separate Spirit Energy bar;
- are limited by cooldowns and contextual rules;
- remain unavailable when their Spirit is not equipped.

The approved cooldown bands are:

| Technique class | Cooldown band |
|---|---:|
| Minor utility | 5-10 minutes |
| Standard active technique | 1-3 minutes |
| Advanced technique | 10-20 minutes |
| Greater Communion | 6 hours |
| Spirit Manifestation | 24 hours |

Exact per-technique values are selected in the connected system specs once action pacing is defined.

### 17.1 Cooldown persistence

Cooldowns are stored and resolved as server-authoritative elapsed-time states.

Switching Spirits, unequipping, logging out, or re-equipping later does not reset or shorten them.

## 18. Greater Communion

Course V of each affinity unlocks a powerful temporary Greater Communion state appropriate to that affinity.

Greater Communion:

- uses the currently equipped Spirit;
- uses the approved **6-hour cooldown**;
- has its exact duration and numerical effects defined by the connected combat/healing/crafting/status spec;
- cannot overlap with Spirit Manifestation.

If Manifestation is activated while Greater Communion is active, Greater Communion ends immediately before Manifestation begins.

Greater Communion cannot be activated while Manifestation is active.

## 19. Spirit Manifestation

Manifestation is a manual tactical activation and the strongest temporary expression of the Bond.

It requires both:

1. completion of the matching Manifestation education course; and
2. a mature **5% Bond** with that Spirit.

Manifestation rules:

- only the currently equipped Spirit may Manifest;
- activation is manual;
- duration is **15 minutes**;
- cooldown is **24 hours**;
- cooldown starts at activation, not at the end of the 15-minute window;
- consumes no mana;
- consumes no separate Spirit resource;
- cannot be transferred to another Spirit by switching;
- is mutually exclusive with Greater Communion.

Manifestation works anywhere the underlying Spirit boon is legitimately relevant unless a future game mode explicitly normalizes or suppresses Spirit effects as part of that mode's own rules.

### 19.1 Manifested boon ceiling

The absolute Spirit boon ceiling is **10%**.

Ordinary PvP values while Manifested:

- disadvantage: **8%**;
- neutral: **10%**;
- advantage: **10%**.

The advantage case caps at 10% instead of scaling to 12%.

For Light and Dark, the mature 2.5% + 2.5% split may rise to 5% + 5% while Manifested, preserving the same 10% total ceiling.

## 20. Relationship Milestones

Each bonded Spirit may receive narrative relationship scenes at:

- **1% Bond:** first deeper interaction;
- **3% Bond:** established relationship scene;
- **5% Bond:** mature Bond scene;
- **first Manifestation:** unique post-Manifestation interaction.

These scenes may reveal personality, memories, backstory, opinions, Spirit lore, clues, or world history.

They grant no hidden statistical advantage and do not create mechanically superior Spirit individuals.

## 21. Codex, Spirit Profile, Chronicle, and Feats of Strength

These records have distinct responsibilities.

### 21.1 Codex

The Codex records what the character knows:

- Spirit affinity;
- encounter location;
- encounter date;
- known lore;
- duplicate-individual discoveries;
- environmental clues and historical knowledge.

### 21.2 Spirit Profile

The Spirit profile records the relationship:

- individual Spirit name;
- personality/history;
- dormant/active status;
- equipped/inactive status;
- Bond progress;
- current boon percentage;
- progression toward maturity;
- technique availability;
- Manifestation availability and cooldown.

### 21.3 Chronicle

Chronicle milestones include:

- mature 5% Bond;
- first successful Manifestation;
- exceptional Spirit discoveries where appropriate.

### 21.4 Feats of Strength

Discovering Light or Dark is suitable for a rare Feat-of-Strength-style prestige record.

The record itself grants no additional mechanical power.

## 22. Server Authority and Data Flow

The client is presentation and input only. The server is authoritative for all Spirit state transitions.

Canonical data flow:

```text
Client requests qualifying action
        ↓
Server resolves action outcome
        ↓
Server determines Spirit eligibility
        ↓
Server rolls encounter and affinity if eligible
        ↓
Server persists discovery/favour/Bond state
        ↓
Education engine validates course prerequisites and timers
        ↓
Server activates Bond after completed per-Bond Attunement
        ↓
Server accrues Bond progress from elapsed equipped time
        +
Server validates activity-based Bond contributions
        ↓
Server calculates current boon
        ↓
Server validates equipped Spirit before active technique use
        ↓
Server validates cooldown / state / PvP lock
        ↓
Server resolves technique and persists cooldown
        ↓
Client receives resulting state for display
```

No Spirit encounter, affinity, favour success, Bond gain, cooldown reset, Manifestation use, or Spirit switch is trusted solely from client state.

## 23. Conceptual Domain Components

Implementation should keep the subsystem modular even if it remains inside a modular monolith.

Recommended domain responsibilities:

- **SpiritCatalog:** affinity definitions, curriculum metadata, technique definitions, rarity weights.
- **SpiritDiscoveryService:** eligible encounter checks, contextual encounter chances, affinity resolution.
- **SpiritFavourService:** trial state, retry cooldown, favour completion.
- **SpiritBondService:** Bond ownership, active/inactive state, equipped-time progression, maturity curve.
- **SpiritAttunementService:** per-Bond activation plus active Spirit selection and 12-hour switch lock.
- **SpiritTechniqueService:** technique access, equipped-affinity validation, cooldown persistence, Greater Communion/Manifestation exclusivity.
- **SpiritManifestationService:** maturity/training validation, 15-minute active state, 24-hour cooldown, 10% ceiling.
- **SpiritRecordService:** Codex, Spirit profile, Chronicle, and Feats-of-Strength events.

These are responsibility boundaries, not a requirement to deploy separate services or microservices.

## 24. Failure and Error Handling

The server must return explicit, player-readable reasons for rejected actions.

Examples include:

- Spirit technique unavailable because the matching Spirit is not equipped;
- Spirit switching unavailable because attunement cooldown remains;
- favour retry unavailable until the seven-day cooldown expires;
- Spirit Attunement unavailable because no permanent Bond exists;
- affinity school unavailable because that Bond's Attunement is incomplete;
- Manifestation unavailable because Bond is below 5%;
- Manifestation unavailable because the capstone course is incomplete;
- Manifestation unavailable because its 24-hour cooldown remains;
- Greater Communion unavailable while Manifestation is active;
- a duplicate-affinity Spirit cannot form a second Bond.

Cooldowns and progression timers must use server time, not client clocks.

## 25. Security and Exploit Resistance

The implementation must specifically guard against:

- replaying action-completion requests;
- forging elapsed-time progression;
- client-modified Bond values;
- Spirit encounter rerolls by refresh/retry abuse;
- duplicate-affinity reroll exploits;
- cooldown resets by switching or logout;
- rapid Spirit swapping during PvP;
- repeated trivial actions for accelerated Bond gains;
- fake healing/crafting/combat events that exist only to feed Spirit progress.

Server-side idempotency and authoritative timestamps should be used for state-changing operations where replay would be harmful.

## 26. Testing Requirements

The implementation plan must include automated coverage for at least the following classes of behavior.

### 26.1 Discovery

- only qualifying outcomes can roll Spirit encounters;
- contextual rates apply correctly;
- affinity weights sum to 100%;
- duplicate affinities do not reroll;
- Light/Dark remain 2% each after encounter success.

### 26.2 Favour

- failure preserves discovery;
- retry is blocked for seven days;
- retry becomes available after cooldown;
- repeated failure restarts the same cooldown pattern.

### 26.3 Bond and Attunement

- Bond begins dormant;
- the three theory courses are one-time character education;
- Spirit Attunement is required separately for each permanent Bond;
- completing a Bond's Attunement activates that Bond at 0%;
- only equipped Spirit progresses;
- inactive Spirit freezes exactly;
- switching preserves prior Bond values;
- 12-hour switching lock works;
- PvP blocks mid-fight switching.

### 26.4 Progression

- passive-equivalent curve reaches approximately 3% at the first stage and 5% at maturity;
- activity acceleration cannot reduce total maturation below six months;
- invalid/trivial actions do not grant activity progress;
- server time, not client time, drives progression.

### 26.5 Techniques

- only equipped-affinity techniques are usable;
- learned techniques remain learned when inactive;
- cooldowns persist through switch/logout/re-equip;
- Greater Communion cannot start during Manifestation;
- starting Manifestation cancels Greater Communion;
- active techniques do not silently scale with every Bond fraction.

### 26.6 PvP affinity

- ordinary wheel applies 4/5/6 mature values correctly;
- an ordinary Spirit receives no advantage against Light or Dark;
- Light/Dark use 6% total in advantaged matchups and preserve an even 3% + 3% split;
- Light vs Dark treats both sides as advantaged;
- same-Apex matchups are neutral at 2.5% + 2.5%;
- Manifested Apex matchups never exceed 5% + 5%.

### 26.7 Manifestation

- requires both 5% Bond and completed capstone course;
- lasts 15 minutes;
- starts 24-hour cooldown at activation;
- consumes no mana or separate Spirit resource;
- cannot be transferred to another Spirit;
- respects 8/10/10 ordinary PvP values;
- never exceeds the 10% Spirit ceiling.

### 26.8 Records

- encounter creates Codex history;
- favour creates the Spirit relationship profile;
- 5% maturity produces Chronicle milestone;
- first Manifestation produces Chronicle milestone;
- Light/Dark discovery creates the appropriate prestige history without additional power.

## 27. Explicit Dependencies and Deferred Tuning

The Spirit architecture is complete without inventing values that belong to other systems.

The following are intentionally resolved later in their owning specs:

- exact damage values for offensive Spirit techniques;
- exact healing and cleansing values;
- exact mitigation values;
- exact slow/restraint/curse/status formulas;
- exact durations for temporary technique effects and Greater Communion;
- exact Earth crafting modifiers;
- mode-specific normalization or suppression rules for future competitive/economic modes.

These are dependencies, not open architectural questions. The Spirit subsystem already defines who may use the effect, how it is unlocked, which Spirit must be equipped, which cooldown class applies, and how the state interacts with Manifestation.

## 28. Out of Scope for This Spec

This design does not define:

- the complete v2 combat formula;
- the complete status-effect engine;
- the full healing model;
- the full crafting formula;
- the visual design of Spirit creatures;
- final authored favour dialogue;
- every Spirit individual personality;
- full world-region Spirit encounter tables;
- implementation code or database schema.

Those items depend on their respective subsystem designs or implementation plan.

## 29. Acceptance Criteria

The Spirit subsystem design is considered implemented correctly when:

1. players can discover rare individual Spirits only through qualifying server-authoritative opportunities;
2. affinity distribution uses 24/24/24/24/2/2 after encounter success;
3. failed favour attempts preserve the discovered Spirit and impose a seven-day retry cooldown;
4. each player may form only one permanent Bond per affinity;
5. the three theoretical Spirit Studies courses are one-time character education, while every new permanent Bond requires its own 21-day Spirit Attunement;
6. Bond begins dormant and activates only after its own Silverbough Spirit Attunement;
7. only one Spirit is active at a time and switching is locked for 12 hours;
8. only the active Spirit progresses and inactive Spirits freeze exactly;
9. Bond growth follows the long-term 9-month passive / roughly 6-month minimum model;
10. mature ordinary boon is 5% and Apex boon is split 2.5% + 2.5%;
11. Spirit Magic is cooldown-based and does not require mana;
12. only the equipped Spirit's techniques are usable;
13. cooldowns persist through switching and logout;
14. Greater Communion and Manifestation cannot overlap;
15. Manifestation requires both mature Bond and capstone training;
16. Manifestation lasts 15 minutes, has a 24-hour cooldown, and never exceeds a 10% Spirit boon ceiling;
17. ordinary PvP affinity uses the locked 4/5/6 mature values, while Apex advantage uses 6% total split 3% + 3% and ordinary elements never gain advantage over Apex Spirits;
18. Codex, Spirit profile, Chronicle, and Feats of Strength record different aspects of the system;
19. all state-changing Spirit operations are validated by the server and covered by automated tests.
