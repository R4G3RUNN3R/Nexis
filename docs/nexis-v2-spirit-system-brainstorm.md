# Nexis v2 Spirit System Brainstorm

> **Status:** Living product brainstorm, not an implementation specification.
>
> This file captures the Spirit-system decisions made during the wider Nexis v2 redesign. It is intentionally separate from the final implementation spec so the system can continue evolving without pretending every number is settled.

_Last updated: 2026-08-21_

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

These examples describe direction, not a final list of Bond-awarding actions. The exact baseline speed and the maximum acceleration from active play remain open balance decisions.

This prevents players from simultaneously maxing every spirit simply because they have found them all.

## 5. Ordinary Elemental Spirits

The four ordinary elemental identities currently being preserved are:

- **Fire:** offensive / attack effectiveness.
- **Water:** magical / spell / skill effectiveness.
- **Wind:** evasion / avoidance / dodge.
- **Earth:** defense and crafting effectiveness.

The mature permanent Spirit boon should be treated as a major reward around a **5% total power budget**.

The old permanent 10% endpoint should not simply return as a permanently stacked passive. Instead, the top-end relationship/training stage can unlock **Spirit Manifestation**, a limited state that temporarily pushes the spirit toward the old 10% power level.

Exact Manifestation duration, mana/resource cost, cooldown and activation rules remain open.

## 6. Elemental Affinity in PvP

Spirits should create a **soft counter system** in PvP rather than hard rock-paper-scissors that overrides the rest of a player's build.

Working ordinary-element wheel:

| Active Spirit | Advantage over | Disadvantage against | Neutral against |
|---|---|---|---|
| Fire | Earth | Water | Fire / Wind |
| Water | Fire | Wind | Water / Earth |
| Wind | Water | Earth | Wind / Fire |
| Earth | Wind | Fire | Earth / Water |

Affinity modifies the **active Spirit boon**, not the player's entire character.

Working mature-spirit example:

- disadvantage: about 4% effective boon
- neutral: 5%
- advantage: about 6%

Exact values remain subject to later combat balancing.

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

## 10. Open Spirit Questions

- How quickly does the passive baseline Bond progress while a Spirit is equipped?
- How much can affinity-appropriate activity accelerate Bond development, and should there be a daily/weekly acceleration cap?
- What exact Spirit Manifestation effects, duration and cooldown does each affinity receive?
- How rare are Light and Dark relative to Fire/Water/Wind/Earth?
- Can particular spirit individuals have unique personalities or variants within the same affinity?
- How are Spirit discoveries represented in Chronicle/Codex/Bestiary-style knowledge systems?
