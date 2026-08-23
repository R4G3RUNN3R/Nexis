# Nexis v2 Spirit System Brainstorm

> **Status:** Living product brainstorm, not an implementation specification.
>
> This file captures the Spirit-system decisions made during the wider Nexis v2 redesign. It is intentionally separate from the final implementation spec so the system can continue evolving without pretending every number is settled.

_Last updated: 2026-08-23_

## 1. Core Direction

The old Spirit Binding system is being rebuilt as a combination of **real spirit entities** and **formal Elemental Spirit Magic** taught through Silverbough.

A spirit is not simply a passive stat item. It is a rare being that must be found, approached, and persuaded to favour the player before any bond can exist.

The core progression loop is:

1. Adventure/explore.
2. Encounter a spirit at very low probability.
3. Complete that spirit's favour test.
4. Establish a Bond.
5. Equip/attune that spirit.
6. Travel to Silverbough.
7. Train the matching Elemental Spirit Magic discipline.
8. Deepen the Bond over real time while that spirit remains equipped.
9. Gain the spirit's passive boon as Bond/training matures.
10. At the highest stage, unlock a limited Spirit Manifestation capable of temporarily pushing the spirit's effect toward the old 10% power level.

## 2. Discovery and Favour

- Spirits are found through adventuring/exploration rather than purchased from a normal vendor or unlocked automatically by level.
- Encounters should be **very rare**.
- Region, environment, hidden sites, world events and elemental context can affect where different spirits may appear.
- Finding a spirit does **not** immediately grant it.
- The spirit presents a favour challenge, such as several questions, a dilemma, a requested action, or some other test of the player's behaviour.
- Different spirit types should care about different values rather than sharing one universal answer pattern.
- Success earns the spirit's favour and establishes the initial Bond.
- The spirit remains an individual entity/companion in the world, not merely an inventory object.

Possible elemental temperament, still illustrative rather than final:

- Fire: courage, decisiveness, passion, action.
- Wind: freedom, instinct, adaptability, refusal to be controlled.
- Water: patience, empathy, perception, adaptability.
- Earth: resolve, reliability, craftsmanship, protection.

### 2.1 Failed favour attempt

Failing a Spirit's favour challenge does **not** destroy or reroll the rare encounter.

- The discovered Spirit remains available to that player.
- The player does not need to rediscover that Spirit or repeat the rare encounter roll.
- A failed favour attempt starts a **7-day real-time retry cooldown**.
- During those seven days, the player cannot attempt to earn that Spirit's favour again.
- Once the seven days have elapsed, the player may retry the favour challenge.
- Repeated failures can repeat this same seven-day lockout rather than permanently closing the Spirit path.

This preserves the significance of an extremely rare discovery while still making the Spirit's acceptance something the player must earn rather than receive automatically.

### 2.2 Affinity rarity after a Spirit encounter

The game should separate **whether a Spirit encounter occurs** from **which affinity that Spirit has**.

Once the already-rare Spirit encounter has succeeded, affinity is rolled using this distribution:

| Affinity | Chance after Spirit encounter |
|---|---:|
| Fire | 24% |
| Water | 24% |
| Wind | 24% |
| Earth | 24% |
| **Light** | **2%** |
| **Dark** | **2%** |

This means each individual Apex affinity is approximately **1 in 50 Spirit encounters**, while encountering either Light or Dark is approximately **1 in 25 Spirit encounters**. Because the Spirit encounter itself is already rare, Light and Dark become extremely scarce without requiring absurdly tiny raw percentages.

A failed favour challenge does not reroll the affinity or destroy that rare Apex discovery; the normal seven-day retry rule applies.

## 3. Silverbough Training

A Bond is an educational prerequisite.

Players cannot simply enrol in Elemental Spirit Magic because they have enough gold or completed a generic course. The spirit must first have accepted them.

Silverbough then teaches the player how to actually channel and work with that Bond.

This intentionally separates:

- **Discovery:** finding the rare spirit.
- **Favour:** convincing the spirit to accept the player.
- **Bond:** establishing the relationship.
- **Training:** learning how to use that relationship safely and effectively.
- **Development:** deepening the active Bond over time.

## 4. One Active Spirit

Players can eventually discover and bond with multiple spirits, potentially all available spirits, but **only one spirit can be equipped/actively attuned at a time**.

Bond progression follows a Pokémon GO-style active-companion rule:

- Only the currently equipped spirit gains Bond progress.
- Unequipping a spirit freezes its progress immediately.
- The exact Bond level is preserved permanently while inactive.
- Re-equipping it later resumes from exactly where it stopped.
- Inactive spirits do not decay or reset.
- Inactive spirits do not progress in the background.
- Only the currently equipped spirit provides its passive boon.
- Only the currently equipped spirit can use Spirit Manifestation.
- Inactive spirits provide no combat or utility benefit until equipped again.

### 4.1 Attunement switching cooldown

Switching to another bonded Spirit starts a **12-hour real-time attunement cooldown**.

- The newly selected Spirit becomes active immediately.
- Its boon, affinity and Bond progression apply immediately after the switch.
- The 12-hour cooldown prevents the player from switching to yet another Spirit until it expires.
- The cooldown does not pause or weaken the newly equipped Spirit.
- Spirit selection is also locked once a PvP encounter begins, so an active fight cannot become an endless counter-swapping exercise.

This makes Spirit choice strategically meaningful without trapping a player in a poor selection for an excessive period.

### 4.2 Hybrid Bond progression

Bond development uses a **hybrid real-time + activity model**.

- The currently equipped Spirit gains a slow baseline amount of Bond progress continuously over real equipped time.
- Relevant, server-validated actions can grant additional Bond progress and therefore accelerate development.
- Only the currently equipped Spirit receives either form of progress.
- Unequipped Spirits remain completely frozen even if the player performs actions that would normally suit them.
- Activity bonuses should reward playing in ways that fit the Spirit's nature rather than encourage one universal repetitive grind.
- Repeated low-value actions must not become an exploitable infinite Bond farm; exact diminishing returns, caps or eligibility rules will be designed later with the underlying activity systems.

Illustrative affinity-aligned activity themes:

- **Fire:** combat, dangerous encounters, decisive/offensive actions.
- **Wind:** travel, evasion, exploration, mobility-oriented actions.
- **Water:** spellcasting, support, adaptive or restorative actions where appropriate.
- **Earth:** crafting, defense, endurance, protection-oriented actions.
- **Light:** healing, cleansing, warding, protection and rescue-oriented actions.
- **Dark:** curses, debuffs, concealment, pressure and other thematically dark actions.

These examples describe direction, not a final list of Bond-awarding actions.

### 4.3 Bond timeline

The mature 5% Spirit Bond is deliberately long-term progression.

- A Spirit developed through passive equipped time alone should take approximately **9 months of cumulative equipped time** to reach its mature 5% Bond.
- Affinity-appropriate activity can accelerate that progression.
- Activity can reduce the total effective development time by at most roughly one-third of the passive baseline.
- The **absolute fastest intended path to a mature 5% Bond is approximately 6 months**.
- A regularly active player should commonly land between those extremes, roughly in the **7-8 month** range.
- Unequipping the Spirit pauses both the passive clock and all activity-based progress for that Spirit; previously earned progress remains intact.
- No amount of repetitive grinding should be able to push maturation below the 6-month floor.

This keeps a permanent 5% Spirit boon genuinely significant while still rewarding players who actively behave in ways aligned with their chosen Spirit.

### 4.4 Continuous boon growth

The Spirit's permanent boon grows **continuously** with Bond progress rather than jumping only at milestone dates.

The intended passive curve preserves the useful shape of the old system:

- from Bond start to roughly the first **3 months** of passive-equivalent progress, the boon rises smoothly from **0% to 3%**;
- over the following roughly **6 months** of passive-equivalent progress, the boon rises smoothly from **3% to the mature 5%**;
- affinity-appropriate activity advances the same underlying Bond progress faster, while the absolute 6-month maturation floor still applies;
- the UI may therefore show precise intermediate values such as **+1.47%**, **+3.62%**, or **+4.91%** rather than only 0%, 3% and 5%;
- inactive Spirits freeze at their exact current value and resume from that exact value when re-equipped.

For Light and Dark, the combined 5% budget follows the same continuous curve and remains evenly split between the two specialisations at every point. For example, when the total Apex boon has reached 3%, each component is 1.5%; at full maturity the two components become 2.5% + 2.5%.

This prevents players from simultaneously maxing every spirit simply because they have found them all.

## 5. Ordinary Elemental Spirits

The four ordinary elemental identities currently being preserved are:

- **Fire:** offensive / attack effectiveness.
- **Water:** magical / spell / skill effectiveness.
- **Wind:** evasion / avoidance / dodge.
- **Earth:** defense and crafting effectiveness.

The mature permanent Spirit boon should be treated as a major reward around a **5% total power budget**.

The old permanent 10% endpoint should not simply return as a permanently stacked passive. Instead, the top-end relationship/training stage can unlock **Spirit Manifestation**, a limited state that temporarily pushes the spirit toward the old 10% power level.

### 5.1 Manual Spirit Manifestation

Spirit Manifestation is a **manual tactical activation**, not an automatic emergency trigger and not a build-up meter.

- Manifestation becomes available only after the Spirit has reached the required mature Bond/training stage.
- The player deliberately chooses when to activate it through a dedicated Manifest action.
- While active, the equipped Spirit temporarily rises from its normal mature 5% total boon toward the old 10% power level.
- For Light and Dark, the same even split is preserved during Manifestation: the normal 2.5% + 2.5% mature boon can rise toward 5% + 5% while manifested.
- Only the currently equipped Spirit can Manifest.
- Manifestation lasts **15 minutes** once manually activated.
- After activation, Spirit Manifestation enters a **24-hour real-time cooldown** before it can be used again.
- The cooldown starts at the moment Manifestation is activated, not when the 15-minute active window ends.
- **Manifestation consumes no mana and no separate Spirit resource.** The 24-hour cooldown is the complete activation cost.
- This keeps Manifestation equally available to martial, ranged, shadow and magical builds rather than making a long-developed Spirit capstone depend on a caster resource.
- Manifestation cannot be transferred to another Spirit by switching; Spirit switching remains governed by the separate 12-hour attunement cooldown.
- Whether Manifestation requires restrictions in any specific PvP or economic contexts remains a later balance decision.

The purpose is to give the player agency over when to spend the Spirit's dramatic temporary power rather than letting the game trigger it automatically at an arbitrary health threshold. The 15-minute window is long enough to support a serious combat, adventure or specialist activity burst, while the 24-hour cooldown prevents the 10% state from becoming the player's normal operating condition.

## 6. Elemental Affinity in PvP

Spirits create a **soft counter system** in PvP rather than hard rock-paper-scissors that overrides the rest of a player's build.

Ordinary-element wheel:

| Active Spirit | Advantage over | Disadvantage against | Neutral against |
|---|---|---|---|
| Fire | Earth | Water | Fire / Wind |
| Water | Fire | Wind | Water / Earth |
| Wind | Water | Earth | Wind / Fire |
| Earth | Wind | Fire | Earth / Water |

Affinity modifies the **active Spirit boon**, not the player's entire character.

The ordinary mature PvP values are now locked as:

- **disadvantage: 4% effective boon**
- **neutral: 5% effective boon**
- **advantage: 6% effective boon**

During Spirit Manifestation, the same matchup logic is preserved but the Spirit system has an absolute **10% boon ceiling**:

- **disadvantage while manifested: 8%**
- **neutral while manifested: 10%**
- **advantage while manifested: 10%**

The advantage case therefore caps at 10% instead of scaling to 12%. This preserves matchup value during normal play while ensuring Manifestation never exceeds the intended maximum Spirit power budget.

Spirit selection is locked once a PvP encounter begins, and the general **12-hour attunement cooldown** prevents players from repeatedly scouting and counter-swapping outside combat as well.

## 7. Light and Dark Apex Spirits

Add **Light** and **Dark** as rare Apex Spirit affinities outside the normal four-element wheel.

Agreed affinity rules:

- Light has an advantage against Fire, Water, Wind and Earth.
- Dark has an advantage against Fire, Water, Wind and Earth.
- Ordinary elements do **not** gain an advantage against Light or Dark.
- Light and Dark are both strong against each other.
- Light vs Light is neutral.
- Dark vs Dark is neutral.
- Light and Dark should be much rarer and harder to earn favour from than ordinary spirits.
- Rarity alone must not be relied on as their primary balance mechanism.

This makes Light and Dark prestigious Apex affinities without giving the four ordinary elements a mirrored weakness bonus against them.

## 8. Light and Dark Opposed Specialisations

The chosen direction is **split specialisation within the same total mature power budget**.

Light and Dark do **not** each receive a simple universal +5% general combat buff. Instead, their mature boon is split **evenly at 2.5% + 2.5%**, keeping the combined power budget equivalent to one ordinary mature 5% Spirit.

### Light Spirit

Mature boon direction:

- **+2.5% protection / mitigation effectiveness**
- **+2.5% restoration / cleansing effectiveness**

Broader identity for abilities and later Spirit Magic:

- protection and mitigation
- restoration/healing support
- cleansing and resistance to harmful effects
- warding/magical resistance
- possibly perception or accuracy as a secondary advanced theme

### Dark Spirit

Mature boon direction:

- **+2.5% offensive pressure**
- **+2.5% curse / debuff effectiveness**

Broader identity for abilities and later Spirit Magic:

- offensive pressure
- critical/finishing pressure
- curses and debuffs
- concealment/suppression
- life manipulation as a possible advanced theme
- mana manipulation as a possible advanced theme

The exact mechanical definitions of "protection/mitigation effectiveness", "restoration/cleansing effectiveness", "offensive pressure", and "curse/debuff effectiveness" should be defined when the v2 combat and status-effect math is designed. The important locked decision here is that Light and Dark each receive **two equally weighted 2.5% mature boon components**, not one dominant effect and one minor effect.

## 9. Balance Principles

- The active Spirit should matter, but it must not outweigh the player's total build.
- Fire/Water/Wind/Earth must remain worthwhile even after Light/Dark exist.
- Light/Dark should feel prestigious because of their affinity relationships and specialised identity, not because they simply have more raw permanent percentage than everything else.
- Spirit effects must coexist safely with Education, equipment, Practical Mastery, Magic School Mastery, Legacy perks, consumables, enhancements and future systems.
- Spirit Manifestation is the preferred place for dramatic temporary power, rather than escalating permanent passive stacking.
- **10% is the absolute Spirit boon ceiling**, including advantage matchups during Manifestation.

## 10. Open Spirit Questions

- Can particular spirit individuals have unique personalities or variants within the same affinity?
- Should a player be able to bond with more than one Spirit of the same affinity, or only one per affinity?
- Can an established Spirit Bond ever be traded, permanently lost, dismissed or killed?
- How are Spirit discoveries represented in Chronicle/Codex/Bestiary-style knowledge systems?
