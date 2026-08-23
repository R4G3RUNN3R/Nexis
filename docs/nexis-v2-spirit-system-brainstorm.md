# Nexis v2 Spirit System Brainstorm

> **Status:** Living product brainstorm, not an implementation specification.
>
> This file captures the Spirit-system decisions made during the wider Nexis v2 redesign. It is intentionally separate from the final implementation spec so the system can continue evolving without pretending every number is settled.

_Last updated: 2026-08-23_

## 1. Core Direction

The old Spirit Binding system is being rebuilt as a combination of **real spirit entities** and **formal Elemental Spirit Magic** taught through Silverbough.

A Spirit is not simply a passive stat item. It is a rare being that must be found, approached and persuaded to favour the player before any Bond can exist.

The core progression loop is:

1. Adventure/explore.
2. Hit a qualifying Spirit-discovery opportunity.
3. Roll the rare Spirit encounter.
4. Resolve the Spirit's affinity.
5. Complete that Spirit's favour test.
6. Establish a permanent but initially dormant Bond.
7. Equip/attune that Spirit.
8. Travel to Silverbough.
9. Complete foundational Spirit Attunement training for that affinity.
10. Activate the Bond and begin numerical Bond progression.
11. Deepen the Bond over real equipped time plus affinity-aligned activity.
12. Gain the Spirit's passive boon continuously as Bond matures.
13. At mature Bond/training, unlock Spirit Manifestation for a limited temporary power state.

The system intentionally separates **discovery, favour, Bond ownership, formal training, Bond development and manifestation**.

## 2. Discovery and Favour

### 2.1 Qualifying encounter chance

The game separates **whether a Spirit encounter occurs** from **which affinity the Spirit has**.

Only genuine server-validated discovery opportunities make a Spirit encounter roll. Ordinary button clicks, refreshes, cancelled actions or trivial loops do not.

The standard encounter rate is:

- **0.25% per qualifying exploration/adventure resolution** (roughly 1 in 400 eligible opportunities).

Context can legitimately improve the chance:

- normal qualifying exploration: **0.25%**;
- strong elemental region/event/context: roughly **0.50%**;
- rare Spirit-focused site/event: up to roughly **1.00%**.

These percentages are encounter chances, not affinity chances. Region, hidden-site, world-event and elemental context may affect eligibility or the encounter rate, but the system should remain extremely rare overall.

### 2.2 Affinity rarity after a Spirit encounter

Once the Spirit encounter itself succeeds, affinity is rolled using this distribution:

| Affinity | Chance after Spirit encounter |
|---|---:|
| Fire | 24% |
| Water | 24% |
| Wind | 24% |
| Earth | 24% |
| **Light** | **2%** |
| **Dark** | **2%** |

Each individual Apex affinity is therefore approximately **1 in 50 Spirit encounters**, while either Light or Dark is approximately **1 in 25 Spirit encounters**.

Because the Spirit encounter itself is already rare, Light and Dark become extremely scarce without requiring absurd raw percentages.

### 2.3 Favour challenge

Finding a Spirit does **not** immediately grant it.

The Spirit presents a favour challenge such as:

- several questions;
- a dilemma;
- a requested action;
- proof of a value or behaviour;
- a short multi-stage test where appropriate.

Different affinities care about different qualities rather than sharing one universal answer pattern.

Illustrative temperament direction:

- **Fire:** courage, decisiveness, passion, action.
- **Wind:** freedom, instinct, adaptability, refusal to be controlled.
- **Water:** patience, empathy, perception, adaptability.
- **Earth:** resolve, reliability, craftsmanship, protection.

These are themes, not final dialogue trees.

### 2.4 Light and Dark favour difficulty

Light and Dark are harder to earn favour from than ordinary elemental Spirits, but **not through an extra RNG success roll**.

Their increased difficulty comes from the content of the trial:

- more demanding questions;
- stricter behavioural requirements;
- potentially multiple stages;
- harder requested actions;
- more complex dilemmas or proofs of character.

If the player performs the required actions correctly, success should not then be denied by another hidden dice roll.

### 2.5 Failed favour attempt

Failing a Spirit's favour challenge does **not** destroy or reroll the rare encounter.

- The discovered Spirit remains available to that player.
- The player does not need to rediscover that Spirit or repeat the rare encounter roll.
- A failed favour attempt starts a **7-day real-time retry cooldown**.
- During those seven days, the player cannot attempt to earn that Spirit's favour again.
- Once the cooldown expires, the player may retry.
- Repeated failures may repeat the same seven-day lockout rather than permanently closing the Spirit path.

The same retry rule applies to Light and Dark.

### 2.6 Individual Spirit identity

Spirits are **unique individuals within a shared mechanical affinity**.

Two Spirits of the same affinity can differ in:

- name;
- appearance;
- temperament;
- dialogue style;
- favour questions, dilemmas or requested actions;
- personal history;
- preferred regions, environments or encounter conditions.

Those differences are narrative and discovery-facing, not a hidden power-roll system. A Fire Spirit still uses the same Fire-affinity mechanics as any other Fire Spirit at equivalent Bond progress.

Players should never need to reroll Spirits looking for a mechanically superior individual.

### 2.7 One Bond per affinity

A player can establish **at most one permanent Bond per affinity**.

The eventual maximum bonded collection is therefore:

- Fire;
- Water;
- Wind;
- Earth;
- Light;
- Dark.

### 2.8 Duplicate-affinity encounters

Already owning a Bond for an affinity does **not** make future encounters of that affinity reroll into something else.

For example, a player with a Fire Bond can still encounter another Fire Spirit.

A duplicate-affinity Spirit:

- cannot create a second Bond;
- cannot stack another boon;
- cannot replace the existing Spirit with a mechanically superior roll;
- does not trigger duplicate protection or an automatic reroll toward missing affinities;
- can unlock a new individual Codex entry;
- can reveal new personality, history, ecology, dialogue, clues or world lore;
- may provide non-power relationship/discovery content later.

This preserves the rarity of Light and Dark and keeps individual Spirits meaningful without creating a Spirit reroll economy.

## 3. Silverbough Training and Bond Activation

### 3.1 Favour creates a dormant Bond

When a Spirit grants favour, the permanent Bond exists but begins **dormant**.

The player owns the relationship, but the numerical boon and Bond-development clock do not start merely because the Spirit accepted them.

The flow is:

```text
Spirit grants favour
        ↓
Permanent dormant Bond established
        ↓
Travel to Silverbough
        ↓
Complete foundational Spirit Attunement training
        ↓
Bond becomes active
        ↓
0% → 5% Bond progression begins
```

### 3.2 Bond is an educational prerequisite

The player cannot simply enrol in a matching Elemental Spirit Magic discipline because they have enough gold or completed a generic course. The Spirit must first have accepted them.

Silverbough then teaches the player how to channel and work with that Bond safely and effectively.

This produces a two-way gate:

- **Spirit favour is required to access that affinity's Spirit training.**
- **Foundational Spirit Attunement training is required before numerical Bond progression and its boon become active.**

This keeps Education as the progression spine instead of letting a rare encounter bypass the rest of Nexis.

## 4. One Active Spirit

Players can eventually discover and bond with multiple Spirits, potentially all six affinities, but **only one Spirit can be equipped/actively attuned at a time**.

- Only the currently equipped Spirit gains Bond progress.
- Unequipping a Spirit freezes its progress immediately.
- The exact Bond value is preserved permanently while inactive.
- Re-equipping it later resumes from exactly where it stopped.
- Inactive Spirits do not decay or reset.
- Inactive Spirits do not progress in the background.
- Only the currently equipped Spirit provides its passive boon.
- Only the currently equipped Spirit can use Spirit Manifestation.
- Inactive Spirits provide no combat or utility benefit until equipped again.

### 4.1 Attunement switching cooldown

Switching to another bonded Spirit starts a **12-hour real-time attunement cooldown**.

- The newly selected Spirit becomes active immediately.
- Its boon, affinity and Bond progression apply immediately after the switch.
- The 12-hour cooldown prevents another Spirit switch until it expires.
- The cooldown does not pause or weaken the newly equipped Spirit.
- Spirit selection is locked once a PvP encounter begins.

This prevents scouting-and-counter-swapping without trapping a player in one choice for an excessive period.

## 5. Bond Development

### 5.1 Hybrid progression

Bond development uses a **hybrid real-time + activity model**.

The currently equipped Spirit gains:

1. a slow baseline amount of Bond progress continuously over real equipped time; and
2. additional Bond progress from qualifying affinity-aligned actions.

Illustrative aligned activity themes:

- **Fire:** combat, dangerous encounters, decisive/offensive actions.
- **Wind:** travel, evasion, exploration, mobility-oriented actions.
- **Water:** spellcasting, support, adaptive/restorative actions where appropriate.
- **Earth:** crafting, defense, endurance, protection-oriented actions.
- **Light:** healing, cleansing, warding, protection, rescue-oriented actions.
- **Dark:** curses, debuffs, concealment, pressure and thematically dark actions.

The exact action catalogue is deferred until the connected systems are designed.

### 5.2 Server authority and anti-farming

All Spirit encounter checks and activity-based Bond gains are **server-authoritative**.

The server evaluates completed, meaningful actions rather than client clicks.

Examples that should not generate legitimate Bond progress simply by repetition include:

- repeated trivial fights;
- zero-value crafting loops;
- refresh spam;
- cancelled journeys;
- fake healing where no meaningful damage existed;
- duplicated/replayed requests;
- client-side timer manipulation.

Activity-based acceleration may use eligibility rules, diminishing returns, daily contribution ceilings or contextual weighting as needed later, but no exploit may push total maturation below the hard minimum.

### 5.3 Bond timeline

The mature 5% Spirit Bond is deliberately long-term progression.

- Passive equipped time alone: approximately **9 months of cumulative active-equipped time** to reach 5%.
- Affinity-appropriate activity accelerates development.
- Activity can shave at most roughly one-third off the passive baseline.
- Absolute fastest intended maturation: approximately **6 months**.
- Regular active player: commonly around **7-8 months**.
- Unequipping pauses passive and activity progress for that Spirit.
- Previously earned progress is never lost by simply switching Spirits.

### 5.4 Continuous boon growth

The Spirit's permanent boon grows **continuously** with Bond progress rather than jumping only at milestone dates.

The passive-equivalent curve preserves the useful shape of the old system:

- Bond start to roughly first **3 months** of passive-equivalent progress: **0% → 3%** smoothly;
- following roughly **6 months**: **3% → 5%** smoothly;
- aligned activity advances the same underlying progress faster;
- the 6-month absolute minimum remains in force;
- the UI may show precise values such as **+1.47%**, **+3.62%**, or **+4.91%**.

For Light and Dark, the total boon follows the same curve and stays evenly split at all times. At a 3% total Apex boon, each component is 1.5%; at maturity the split is 2.5% + 2.5%.

### 5.5 Bond permanence and ownership

Once favour is earned and the Bond is established, the Bond is **permanent character progression**.

It:

- cannot be traded;
- cannot be sold;
- cannot be stolen;
- cannot be reset by switching;
- cannot be permanently destroyed by ordinary gameplay;
- cannot be erased through routine character death;
- cannot be deleted because the Spirit is permanently killed as a punishment mechanic.

Story content may temporarily separate a Spirit from the player or prevent attunement, but it cannot erase months of Bond progress.

## 6. Ordinary Elemental Spirits

The four ordinary elemental identities currently being preserved are:

- **Fire:** offensive / attack effectiveness.
- **Water:** magical / spell / skill effectiveness.
- **Wind:** evasion / avoidance / dodge.
- **Earth:** defense and crafting effectiveness.

A mature ordinary Spirit has a permanent **5% total boon budget** before PvP affinity adjustment.

The old permanent 10% endpoint does not return as a permanently stacked passive. The dramatic 10% state belongs to Spirit Manifestation.

## 7. Spirit Manifestation

Spirit Manifestation is a **manual tactical activation**.

It is not an automatic emergency trigger and not a separate build-up meter.

Rules:

- available only after the Spirit reaches the required mature Bond/training stage;
- deliberately activated by the player;
- only the currently equipped Spirit can Manifest;
- lasts **15 minutes**;
- has a **24-hour real-time cooldown**;
- cooldown begins the moment Manifestation is activated;
- consumes **no mana**;
- consumes **no separate Spirit resource**;
- the cooldown itself is the full activation cost;
- cannot be transferred between Spirits by switching;
- the separate 12-hour attunement-switch cooldown still applies.

### 7.1 Where Manifestation works

Manifestation works **anywhere the underlying Spirit boon legitimately works**.

Potentially relevant contexts include:

- PvP;
- PvE;
- adventures;
- exploration;
- healing;
- crafting;
- spellcasting;
- shadow activities;
- other systems affected by that Spirit's boon.

There is no arbitrary global "combat only" restriction.

A future competitive or economic mode may explicitly disable, normalize or cap Spirit effects as part of that mode's own rules, but such a restriction belongs to the mode rather than being a weakness built into Manifestation itself.

## 8. Elemental Affinity in PvP

Spirits create a **soft counter system** in PvP rather than hard rock-paper-scissors that overrides the player's entire build.

Ordinary-element wheel:

| Active Spirit | Advantage over | Disadvantage against | Neutral against |
|---|---|---|---|
| Fire | Earth | Water | Fire / Wind |
| Water | Fire | Wind | Water / Earth |
| Wind | Water | Earth | Wind / Fire |
| Earth | Wind | Fire | Earth / Water |

Affinity modifies the **active Spirit boon**, not all character stats.

Locked mature values:

- **disadvantage: 4% effective boon**;
- **neutral: 5% effective boon**;
- **advantage: 6% effective boon**.

During Manifestation:

- **disadvantage: 8%**;
- **neutral: 10%**;
- **advantage: 10%**.

**10% is the absolute Spirit boon ceiling.** The advantaged manifested case caps at 10% instead of scaling to 12%.

Spirit selection is locked after PvP begins, and the 12-hour general attunement cooldown prevents repeated pre-fight counter-swapping.

## 9. Light and Dark Apex Spirits

Light and Dark sit outside the normal four-element wheel.

Affinity rules:

- Light has an advantage against Fire, Water, Wind and Earth.
- Dark has an advantage against Fire, Water, Wind and Earth.
- Ordinary elements do **not** gain an advantage against Light or Dark.
- Light and Dark are both strong against each other.
- Light vs Light is neutral.
- Dark vs Dark is neutral.
- Their rarity and favour difficulty make them prestigious, but rarity alone is not their balance mechanism.

### 9.1 Light specialisation

Mature boon direction:

- **+2.5% protection / mitigation effectiveness**;
- **+2.5% restoration / cleansing effectiveness**.

Broader identity:

- protection and mitigation;
- restoration/healing support;
- cleansing and resistance to harmful effects;
- warding/magical resistance;
- possibly perception or accuracy as a secondary advanced theme.

During Manifestation, the split can rise toward **5% + 5%**, subject to the same absolute 10% total Spirit ceiling.

### 9.2 Dark specialisation

Mature boon direction:

- **+2.5% offensive pressure**;
- **+2.5% curse / debuff effectiveness**.

Broader identity:

- offensive pressure;
- critical/finishing pressure;
- curses and debuffs;
- concealment/suppression;
- life manipulation as a possible advanced theme;
- mana manipulation as a possible advanced theme.

During Manifestation, the split can rise toward **5% + 5%**, subject to the same absolute 10% total Spirit ceiling.

The exact combat/status formulas behind these labels are intentionally deferred until the v2 combat and status-effect systems are designed.

## 10. Spirit Records, Codex and Chronicle

Spirit discovery and relationship history should be represented in several layers rather than collapsed into one generic achievement entry.

### Encountered

When a Spirit is first encountered:

- unlock a Codex entry;
- record affinity;
- record encounter location;
- record encounter date;
- expose basic known lore.

### Favour earned

When the Spirit grants favour and the Bond is established:

- unlock the full Spirit profile;
- reveal its individual name;
- reveal its personality and known history;
- record that the player has formed the permanent Bond for that affinity.

### Bond developing

The Spirit profile should display:

- current Bond progress;
- current boon percentage;
- dormant/active state;
- equipped/inactive attunement state;
- progress toward maturity;
- Manifestation availability/cooldown once unlocked.

### Mature Bond

Reaching the mature 5% Bond becomes a **Chronicle milestone**.

### First Manifestation

A Spirit's first successful Manifestation becomes a **Chronicle milestone**.

### Light and Dark discovery

Discovering a Light or Dark Spirit is suitable for both:

- a rare Chronicle milestone; and
- a Feat-of-Strength-style prestige entry.

The record itself grants no extra mechanical power.

The separation is intentional:

- **Codex:** what the character knows about Spirits and the world;
- **Spirit profile:** the specific ongoing relationship;
- **Chronicle:** important events in that character's personal history;
- **Feat of Strength:** exceptional prestige/history, not a power source.

## 11. Balance Principles

- The active Spirit should matter, but must not outweigh the player's total build.
- Fire/Water/Wind/Earth must remain worthwhile after Light/Dark exist.
- Light/Dark should feel prestigious through affinity relationships and specialised identity, not larger permanent raw percentages.
- Spirit effects must coexist safely with Education, equipment, Practical Mastery, Magic School Mastery, Legacy perks, consumables, enhancements and future systems.
- Spirit Manifestation is where dramatic temporary power belongs, instead of escalating permanent passive stacking.
- **10% is the absolute Spirit boon ceiling.**
- Individual Spirit personality must not become a hidden mechanical rarity roll.
- Permanent Bond progress must not be invalidated by trading, theft, routine death states or narrative punishment.
- Duplicate affinities must not become a deterministic path toward missing Apex Spirits.
- Rare systems must be server-authoritative and resistant to repetitive trivial-action farming.

## 12. Remaining Spirit Questions

The core Spirit loop is now largely defined. Remaining design work is mostly about the **Silverbough Spirit Magic curriculum and presentation**, rather than changing the Bond economy itself.

Open questions include:

- Should Silverbough teach one common Spirit Magic curriculum followed by affinity specialisations, or six mostly separate affinity curricula?
- What exact courses/prerequisites unlock foundational Spirit Attunement and later Manifestation?
- Do individual Spirits gain additional purely narrative relationship scenes as Bond grows?
- How should Spirit-focused clues, quests and discoveries surface in the world and Codex without turning Spirit hunting into a guaranteed farm?
