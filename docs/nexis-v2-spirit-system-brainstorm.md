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
12. Complete the affinity-specific Spirit Magic curriculum to unlock advanced capabilities.
13. Gain the Spirit's passive boon continuously as Bond matures.
14. At mature Bond plus completed Manifestation training, unlock Spirit Manifestation for a limited temporary power state.

The system intentionally separates **discovery, favour, Bond ownership, formal training, Bond development, Spirit Magic capability and manifestation**.

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

### 2.9 Knowledge-guided Spirit hunting

Players may learn where Spirits are **more plausibly encountered**, but knowledge never becomes exact spawn coordinates or a guaranteed farming route.

Useful clues can come from:

- Codex entries;
- History-related education;
- ruins and relic discoveries;
- NPC rumours;
- Spirit relationship scenes;
- old journals or expedition records;
- world events;
- unusual environmental signs.

Clues should describe environments and conditions rather than exact map tiles. Examples of the intended style include reports that Fire Spirits favour old battlefields or volcanic fissures, or rumours of strange lights in Silverbough woods during storms.

Knowledge therefore works as:

```text
Knowledge / clues
      ↓
better places and conditions to search
      ↓
more qualifying or boosted discovery opportunities
      ↓
still requires the rare Spirit encounter roll
```

The aim is to reward investigation and world knowledge without allowing a community guide to reduce Spirit hunting to standing on one coordinate and repeating the same action forever.

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

### 3.2 Common Spirit Studies foundation

Silverbough uses a **shared foundational curriculum followed by affinity-specific Spirit Magic schools**, rather than six wholly separate tracks starting from nothing.

The foundation is linear:

```text
Spirit Lore
   ↓
Spirit Communication
   ↓
Bond Theory
   ↓
[Real Spirit Bond required]
   ↓
Spirit Attunement
   ↓
Bond activates
   ↓
Affinity-specific Spirit Magic school
```

The early theoretical courses can be studied **before the player has found a Spirit**. This allows deliberate preparation without granting Spirit power from study alone.

**Spirit Attunement itself requires a real permanent Bond.** A player cannot complete the activation course merely because they have finished the theory.

### 3.3 Shared foundation durations

The shared Silverbough foundation uses substantial real-time education durations:

| Course | Duration |
|---|---:|
| **Spirit Lore** | **10 days** |
| **Spirit Communication** | **14 days** |
| **Bond Theory** | **18 days** |
| **Spirit Attunement** | **21 days** |

The first three theoretical courses therefore require **42 days** in total. Once the player has a real Spirit Bond, Spirit Attunement adds a further **21 days** before the Bond becomes mechanically active.

### 3.4 Spirit Attunement effect

Completing Spirit Attunement is the point at which the dormant Bond becomes mechanically active:

- numerical Bond progression begins;
- the boon begins at 0% and starts growing continuously;
- equipped-time progression begins counting;
- affinity-aligned activity can begin accelerating Bond development;
- the matching affinity-specific Spirit Magic curriculum becomes available.

The 21-day course is intentionally substantial because it converts a rare narrative relationship into a usable long-term progression system.

### 3.5 Affinity-specific Spirit Magic schools

After Spirit Attunement, the player enters the school matching the bonded Spirit's affinity.

Each of the six affinities uses the same **six-course structural length**:

```text
Course I     Initial channeling
Course II    Defensive / utility technique
Course III   Active affinity technique
Course IV    Advanced affinity technique
Course V     Greater Communion
Course VI    Manifestation training
```

#### Ordinary affinity course durations

Fire, Water, Wind and Earth use:

| Course | Duration |
|---|---:|
| I | 10 days |
| II | 12 days |
| III | 14 days |
| IV | 16 days |
| V | 18 days |
| VI | 22 days |

Total: **92 days** per ordinary affinity school.

#### Apex affinity course durations

Light and Dark use:

| Course | Duration |
|---|---:|
| I | 12 days |
| II | 14 days |
| III | 16 days |
| IV | 18 days |
| V | 21 days |
| VI | 24 days |

Total: **105 days** per Apex affinity school.

Apex schools are therefore somewhat longer without adding filler courses merely to inflate the calendar.

### 3.6 Fire Spirit Magic

1. **Ember Channeling** — manipulate minor flame, ignite mundane materials, and sense abnormal heat or fire sources.
2. **Flame Ward** — temporary protection against fire, burning and severe heat.
3. **Combustive Projection** — an active Spirit-powered offensive fire technique.
4. **Infernal Resonance** — temporarily infuse an attack or weapon with Spirit flame for stronger offensive pressure.
5. **Greater Fire Communion** — a powerful temporary communion focused on aggression, flame control and resistance to hostile fire.
6. **Fire Manifestation** — completes the educational half of Fire Manifestation.

### 3.7 Water Spirit Magic

1. **Flow Channeling** — manipulate small quantities of water and sense nearby water or impurities.
2. **Tidal Veil** — a defensive technique that cushions or redirects incoming force.
3. **Binding Current** — a control technique that impedes, slows or restrains a target.
4. **Restorative Current** — Spirit-assisted recovery capable of healing or removing lesser harmful conditions.
5. **Greater Water Communion** — a major restorative/control state allowing stronger healing, cleansing and battlefield control.
6. **Water Manifestation** — completes the educational half of Water Manifestation.

### 3.8 Wind Spirit Magic

1. **Breeze Channeling** — manipulate airflow and sense changes in weather or air movement.
2. **Slipstream** — a movement/evasion technique allowing rapid repositioning or escape.
3. **Gale Step** — a stronger burst-movement technique with combat and exploration applications.
4. **Cutting Gale** — offensive pressure through concentrated Spirit wind.
5. **Greater Wind Communion** — a major mobility state improving movement, escape, evasion and wind control.
6. **Wind Manifestation** — completes the educational half of Wind Manifestation.

### 3.9 Earth Spirit Magic

1. **Stone Communion** — sense stone, minerals, instability and structural weaknesses.
2. **Earthen Ward** — a defensive barrier or reinforcement technique.
3. **Stonebind** — restrain, obstruct or impede movement through earth and stone.
4. **Artisan's Resonance** — Spirit-assisted crafting affecting smithing, materials and structural work.
5. **Greater Earth Communion** — a major defensive/crafting communion improving fortification and material control.
6. **Earth Manifestation** — completes the educational half of Earth Manifestation.

### 3.10 Light Spirit Magic

1. **Luminous Channeling** — produce and manipulate Spirit light and reveal some unnatural darkness or corruption.
2. **Radiant Ward** — a strong protection-oriented Spirit technique.
3. **Purifying Touch** — remove or weaken poisons, curses, debuffs or other harmful effects.
4. **Sanctuary** — create a temporary protected area focused on mitigation and recovery.
5. **Greater Light Communion** — a major protection/restoration state capable of powerful cleansing and defensive support.
6. **Light Manifestation** — completes the educational half of Light Manifestation.

### 3.11 Dark Spirit Magic

1. **Umbral Channeling** — manipulate shadow, suppress presence and sense some hostile magical influence.
2. **Veil of Gloom** — a concealment/suppression technique useful in combat and Shadow activities.
3. **Spirit Hex** — apply a meaningful curse or debuff to a target.
4. **Life Siphon** — an offensive Spirit technique that drains vitality or weakens an opponent while benefiting the user in a limited fashion.
5. **Greater Dark Communion** — a major offensive/debuff state increasing the Spirit's ability to suppress, curse and pressure targets.
6. **Dark Manifestation** — completes the educational half of Dark Manifestation.

### 3.12 Courses unlock capabilities, not Bond percentage

Affinity-specific Spirit Magic education unlocks **real capabilities** rather than simply adding more passive percentage at every course.

The permanent 0-5% Spirit boon still comes from **Bond progression**, not these course completions.

### 3.13 Spirit techniques use cooldowns, not mana

Active Spirit Magic techniques are governed by **cooldowns**, not by the character's mana pool.

This is intentional because Spirits are a cross-build system. A fighter, archer, rogue, crafter or other non-caster may form and develop a Spirit Bond long before they ever acquire meaningful mana. Requiring mana for Spirit techniques would unnecessarily turn Spirit progression into a caster-dependent subsystem.

Rules:

- Spirit techniques do **not** require mana by default;
- Spirit techniques do **not** use a separate Spirit Energy resource;
- stronger techniques receive longer cooldowns than lighter utility techniques;
- cooldown duration is the main limiter on active Spirit abilities;
- the passive Bond boon remains resource-free;
- Spirit Manifestation remains resource-free and continues to use its separate 24-hour cooldown;
- future exceptional techniques may have contextual requirements, but the baseline Spirit system must remain usable by non-casters.

The working cooldown bands are:

| Technique class | Cooldown band |
|---|---:|
| Minor utility | **5-10 minutes** |
| Standard active technique | **1-3 minutes** |
| Advanced technique | **10-20 minutes** |
| Greater Communion | **6 hours** |
| Spirit Manifestation | **24 hours** |

Exact technique cooldowns can be selected within those bands when combat/action pacing is designed.

### 3.14 Normal Magic vs Spirit Magic vs Manifestation

The three systems are deliberately distinct:

```text
NORMAL MAGIC
Learned and powered by the character.

SPIRIT MAGIC
Learned by the character, but channelled through the bonded Spirit.
No normal mana requirement by default.

MANIFESTATION
Temporary maximum expression of the Bond.
```

A non-caster can therefore use Spirit techniques such as Stonebind, Gale Step or Flame Ward because the supernatural capability is being provided through the Bonded Spirit rather than the character's conventional spellcasting pathway.

A conventional mage may later combine normal magic and Spirit Magic in interesting ways, but Spirit Magic itself does not require the normal spellcasting progression.

### 3.15 Education and Bond measure different things

Spirit education and Bond progression are deliberately separate systems:

```text
EDUCATION
What can I do with this Spirit?

BOND
How deeply connected am I to this Spirit?
```

Education unlocks capabilities, techniques and eventually Manifestation training.

Bond determines the depth and numerical strength of the relationship, including the continuously growing passive boon.

The two systems must not duplicate the same progression under different names.

### 3.16 Manifestation requires both mastery and maturity

The final affinity-specific Manifestation course does **not** grant immediate Manifestation by itself.

Spirit Manifestation unlocks only when both conditions are true:

1. the player has completed the affinity's required Manifestation training; and
2. that Spirit has reached its mature **5% Bond**.

```text
Manifestation education complete
        +
5% mature Bond
        ↓
Spirit Manifestation unlocked
```

This prevents a player from completing the academic curriculum and instantly bypassing the long relationship progression. Likewise, reaching 5% Bond without the formal capstone training does not unlock Manifestation.

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

### 5.5 Narrative relationship milestones

Each bonded Spirit can gain additional **purely narrative relationship scenes** as the Bond deepens.

Recommended milestones:

- **1% Bond:** first deeper interaction;
- **3% Bond:** established-relationship scene;
- **5% Bond:** mature-Bond scene;
- **first Manifestation:** unique post-Manifestation interaction.

These scenes can reveal:

- personality;
- backstory;
- memories;
- opinions about the player;
- Spirit lore;
- clues about places, history or other Spirits.

They do **not** grant hidden stat bonuses, stronger individual Spirit rolls or other mechanical advantages. Individuality remains narrative rather than becoming another optimisation layer.

### 5.6 Bond permanence and ownership

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
- Spirit education and Bond progression must remain distinct: one unlocks capabilities, the other measures relationship depth and boon strength.
- Spirit clues may improve search direction and encounter context, but must never become exact deterministic spawn coordinates.
- Spirit Magic must remain accessible to non-caster builds; active Spirit techniques therefore use cooldowns rather than requiring mana or a dedicated Spirit resource.
- Spirit Magic and conventional character spellcasting are separate progression/resource concepts even when a character eventually learns both.

## 12. Remaining Spirit Questions

The core Spirit loop, rarity model, Bond economy, curriculum architecture, relationship milestones, discovery philosophy, active-ability resource model, six school identities, course durations and cooldown bands are now largely defined.

Remaining design work is concentrated around **interaction rules and exact combat/action tuning**, which should be resolved alongside the systems they affect rather than guessed in isolation.

Open questions include:

- Are Spirit techniques usable only while their matching Spirit is currently equipped/attuned?
- Do active Spirit techniques have fixed effectiveness once learned, or scale numerically with Bond progress?
- Do Spirit-technique cooldowns persist while a Spirit is unequipped and after switching to another Spirit?
- Can Greater Communion and Spirit Manifestation overlap, or should they be mutually exclusive Spirit states?
- What exact values, durations and status formulas should individual techniques use once the v2 combat, healing, crafting and status systems are defined?
