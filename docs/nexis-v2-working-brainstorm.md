# Nexis v2 Working Brainstorm

> **Status:** Living conversation capture, not an implementation specification.
>
> This document records product and architecture decisions while Nexis v2 is being reconsidered system by system. Agreed areas should later graduate into focused design specifications under `docs/superpowers/specs/`, followed by implementation plans. No gameplay or architecture should be implemented directly from this draft without the relevant design being reviewed and approved.

_Last updated: 2026-08-21_

## 1. Rebuild Principles

- Preserve valuable player data, content, lore, assets, game rules, working behavior, incident learnings, tests, canaries, and operational knowledge.
- Do **not** preserve old architecture merely for compatibility.
- Reuse knowledge and data, not technical debt.
- Nexis v2 may redesign the PostgreSQL schema, API boundaries, frontend structure, routing, UI components, deployment structure, and data models when that creates a cleaner long-term system.
- Database migration must preserve and correctly transform every legitimate existing record and value. Migration should be auditable and reconciled rather than rewriting the live database in place.
- Build Nexis v2 in parallel with the current live version. The old live game remains the reference and source of existing player data until an eventual controlled cutover.
- Foundation and player experience are equally important: clean auth/session/database/API/deployment architecture underneath a polished, coherent playable vertical slice.
- Visual direction is **B, aggressively**: preserve the identity of Nexis, CIEL, its world and worthwhile visual DNA, while treating existing screens, navigation, layouts and components as replaceable.

## 2. Product Identity

The first version of Nexis borrowed too much of its overall skeleton from Torn. Torn remains an important design influence, especially where its long-term browser-RPG systems work well, but Nexis must now become its own game.

Core direction:

- **Education is the progression spine of Nexis.**
- Education answers: **What does this character know, understand, and have access to?**
- Practical mastery answers: **What has this character actually become good at through use?**
- Levels, statistics, gear, wealth, reputation and organizations can remain important, but knowledge and practice should meaningfully determine capability.
- Basic play should remain accessible without extensive schooling. Advanced capabilities, professions and specializations should require learning, practice, discovery, or some combination of them.
- Character identity should emerge from the player's actual history rather than a class-like choice made at registration.

## 3. Education

### 3.1 What to preserve from Torn-like education

- Real-time study.
- Prerequisites.
- Progress continuing while offline.
- Meaningful long-term planning.
- Permanent knowledge/unlocks and selected passive benefits.
- Education-speed modifiers can exist, but should be carefully bounded.

### 3.2 Nexis's own education model

Courses should not exist merely to award percentage bonuses. Completing education should often mean that the character now understands enough to begin using, practising, researching, crafting, investigating, or accessing something.

Potential broad fields include:

- General/foundational studies.
- History, archaeology, languages and investigation.
- Commerce, logistics, law and administration.
- Medicine, alchemy and natural sciences.
- Craftsmanship, smithing, engineering and material studies.
- Warfare and fieldcraft.
- Shadow/underworld knowledge.
- Arcane studies and magical research.

The existing universal academy template of eight ranks, five days each and forty days total is no longer assumed to be appropriate. Institutions and disciplines may have very different depths and study times.

## 4. Silverbough and Arcane Education

The Silverbough Arcane Conservatory should become a substantial institution rather than a shallow eight-rank track.

Foundation studies can establish magical literacy and eventually unlock mana. From there, formal schools of magic can contain real courses, spell studies, research disciplines, enhancement theory, rune theory, artifact work and advanced specialization.

Important separation:

1. **Access:** Does the character know that this school exists and have access to studying it?
2. **Knowledge:** Which spells, theories, rituals, recipes or techniques have they actually learned?
3. **Mastery:** How experienced are they at applying that school in practice?

The exact list of formal schools is still open.

## 5. Lost and Forbidden Knowledge

Some magical disciplines should **not** appear in Silverbough's public catalogue.

History, archaeology, exploration, adventure, ruins, bosses, hidden libraries, sealed vaults and world events can lead to extremely rare physical Grimoires/Tomes. Necromancy is the primary example discussed so far.

### 5.1 Tome flow

1. A rare tome is discovered or acquired as a physical Inventory item.
2. Initially it may be unidentified or only partially understood.
3. Identification reveals the tome and its deciphering requirements.
4. The player deliberately starts deciphering it.
5. Deciphering takes real time. A major forbidden Grimoire might take 30 days; different tomes can take shorter or substantially longer periods.
6. When deciphering completes, the associated hidden school/branch becomes available to that character.
7. This does **not** grant every spell. Individual spells and advanced theory must still be learned or researched.

The game should not reveal every hidden discipline in an empty checklist before discovery. A player's knowledge interface can expand as their character discovers that previously unknown fields exist.

Grimoires should remain genuine world items, allowing interesting choices around keeping, trading, hiding, researching or supplying them. Exact post-decipher ownership/trade rules remain open.

## 6. Magic School Mastery

Mastery belongs to the **school**, not to each individual spell.

Examples:

- Evocation Tier 4
- Restoration Tier 7
- Necromancy Tier 2

Using any qualifying spell from that school contributes to the school's practical mastery.

### 6.1 Ten-tier progression

Working rule agreed in conversation:

| Tier | New qualifying casts required | Lifetime total |
|---:|---:|---:|
| 1 | 100 | 100 |
| 2 | 200 | 300 |
| 3 | 400 | 700 |
| 4 | 800 | 1,500 |
| 5 | 1,600 | 3,100 |
| 6 | 3,200 | 6,300 |
| 7 | 6,400 | 12,700 |
| 8 | 12,800 | 25,500 |
| 9 | 25,600 | 51,100 |
| 10 | 51,200 | 102,300 |

A qualifying cast must actually resolve server-side and consume its intended resources.

Tier advancement should improve the character's command of the school rather than simply stacking crude damage bonuses. Potential benefits include mana efficiency, reliability, control, research capability, access to advanced studies, spell variants and school-specific capstones.

### 6.2 Mastery rewards

- Tier 10 in a school awards a school-appropriate mastery title.
- Tier 10 also awards one **Legacy Point**.
- Additional titles can recognize mastery of multiple schools.
- Mastery of all qualifying magic schools awards **Grand Archmage**.
- Whether Grand Archmage requires hidden/forbidden schools as well as formal schools remains unresolved.

## 7. Mana Economy

Spells cost mana, naturally preventing unlimited casting.

Working model:

- Mana has a maximum pool.
- Mana regenerates over real time.
- Spells consume mana based on their power/type.
- Mana-restoration consumables exist.
- Restoration items share a meaningful cooldown category, similar in principle to Torn's consumable cooldowns, so players cannot drink an unlimited chain of refills.
- Education, equipment, mastery, alchemy and rare effects may improve mana capacity, regeneration, efficiency or restoration, but reductions should be capped so meaningful spell costs never collapse to zero.

Exact regeneration rates, starting pool, potion values and cooldown lengths remain open.

## 8. Spirits and Elemental Spirit Magic

The old Spirit Binding concept should be rebuilt as a combination of **real spirit entities** and a **formal Elemental Spirit Magic discipline**.

A spirit is not an equippable percentage buff. It is a rare being that must choose or accept the player before the player can benefit from spirit magic.

### 8.1 Discovery and favour

- Players must go adventuring/exploring to encounter spirits in the world.
- Spirit encounters should be **very rare** and can be strongly influenced by region, environment, active world events, hidden sites and the spirit's element.
- Finding a spirit does **not** immediately bind or grant it.
- An encounter becomes a favour/bond challenge.
- The spirit can ask several questions, present a dilemma, require a specific action, demand proof of character, or otherwise test the player.
- Different spirits should care about different values rather than sharing one obvious answer sheet.
- Success establishes the initial **Bond** with that individual spirit.
- The spirit remains a character/entity with its own identity, not merely an inventory item.

Examples of possible elemental temperament, not yet final rules:

- Fire may care about courage, decisiveness, passion or willingness to act.
- Wind may care about freedom, instinct, adaptability or refusal to be controlled.
- Water may care about patience, empathy, perception or adaptability.
- Earth may care about resolve, reliability, craftsmanship or protection.

The exact consequence of failing a spirit's favour challenge remains unresolved.

### 8.2 Bond as an educational prerequisite

A player cannot simply enrol in Elemental Spirit Magic because they have enough gold or completed a generic prerequisite.

The intended flow is:

1. Discover an actual spirit in the world.
2. Earn that spirit's favour.
3. Establish the Bond.
4. Travel to **Silverbough**.
5. Use the Bond as a prerequisite for the corresponding Elemental Spirit Magic training.
6. Study/train the discipline over real time.
7. Earn the substantial elemental bonus only after meaningful study and bond development.

The rare world encounter therefore creates access; Silverbough provides the knowledge and technique needed to actually channel that bond effectively.

### 8.3 Elemental bonuses and manifestation

The current v1 spirit data contains four elemental identities worth preserving conceptually:

- **Fire:** offensive/attack effectiveness.
- **Wind:** evasion/avoidance/dodge.
- **Water:** magic/spell/skill effectiveness.
- **Earth:** defense and crafting effectiveness.

The v2 direction is to treat **5% as the major permanent mature-bond ceiling**, while preserving the old 10% power level as a limited top-end state rather than a permanently stacked passive.

At the highest bond/training stage, a spirit can unlock a **Spirit Manifestation** or equivalent capstone. During that limited state, the spirit's effect can temporarily rise from the normal 5% ceiling toward the old 10% level. Exact duration, cost, cooldown and activation rules will be balanced later against mana, combat pacing and the wider modifier economy.

This preserves the useful shape of the old progression without allowing permanent 10% spirit bonuses to pile on top of education, equipment, mastery, Legacy perks, enhancements, consumables and future systems. Deeper spirit content can later add unique techniques, interactions, research, spell variants, crafting hooks, dialogue and adventure chains without those being required for the first coherent v2 Spirit system.

### 8.4 One active spirit and frozen inactive bonds

Players may discover and earn the favour of multiple spirits, potentially all available spirits over a long enough character history, but **only one spirit can be equipped/actively attuned at a time**.

Bond progression follows a Pokémon GO-style active-companion rule:

- Only the currently equipped spirit gains Bond progression.
- Unequipping a spirit immediately pauses its Bond progression.
- Its accumulated Bond level/progress is permanently preserved while inactive.
- Re-equipping that spirit later resumes progression from exactly where it stopped.
- Inactive spirits do not decay, reset, or progress in the background.
- A player therefore cannot develop Fire, Wind, Water and Earth bonds simultaneously simply because they have found all four.
- Switching which spirit is active is a strategic progression choice: time spent deepening one bond is time not spent deepening another.
- **Only the currently equipped spirit provides its passive boon.** Inactive spirits provide no passive bonus.
- **Only the currently equipped spirit can use Spirit Manifestation.**
- Inactive spirits retain their bond and training permanently, but contribute no active combat or utility effect until re-equipped.

### 8.5 Elemental affinity in PvP

Spirits should create a **soft elemental counter system** in PvP rather than a hard rock-paper-scissors system that overrides the rest of a player's build.

Working elemental wheel:

| Active Spirit | Advantage over | Disadvantage against | Neutral against |
|---|---|---|---|
| Fire | Earth | Water | Wind / Fire |
| Water | Fire | Wind | Earth / Water |
| Wind | Water | Earth | Fire / Wind |
| Earth | Wind | Fire | Water / Earth |

The intended philosophy is that affinity modifies the **active Spirit boon**, not the player's entire character. A working example for a mature 5% spirit is:

- Disadvantaged matchup: effective boon around **4%**.
- Neutral matchup: effective boon **5%**.
- Advantaged matchup: effective boon around **6%**.

Exact numbers remain subject to combat balancing, but the counter should be meaningful without invalidating equipment, education, mastery, Legacy perks, consumables, battle stats or other progression.

Spirit selection should be locked once a PvP encounter begins. The previous v1 12-hour switching cooldown is a useful candidate for preventing instant counter-swapping, though the exact v2 attunement cooldown remains open.

### 8.6 Light and Dark Apex Spirits

Add **Light** and **Dark** as rare Apex Spirit affinities outside the normal four-element wheel.

Rules agreed so far:

- Light has an affinity advantage against Fire, Water, Wind and Earth.
- Dark has an affinity advantage against Fire, Water, Wind and Earth.
- The four normal elements are **neutral when attacking/interacting against Light or Dark**; Light and Dark do not inherit a weakness to the ordinary elemental wheel.
- Light and Dark are both strong against each other. Their opposition is mutual rather than one cleanly countering the other.
- Light vs Light and Dark vs Dark are neutral same-affinity matchups.
- Light and Dark should be significantly rarer and harder to earn favour from than ordinary elemental spirits, but rarity alone must not be relied upon as the balancing mechanism.

This produces an asymmetric Apex relationship: Light/Dark receive an affinity edge against ordinary spirits without causing ordinary spirits to suffer an additional mirrored penalty, while Light and Dark become mutually dangerous when they meet.

### 8.7 Light and Dark specialisations

Light and Dark should use **opposed specialisations**, not identical general-purpose combat bonuses.

**Light Spirit direction:**

- protection and mitigation
- restoration/healing support
- cleansing and resistance to harmful effects
- magical resistance/warding
- possibly perception or accuracy as a secondary theme

**Dark Spirit direction:**

- offensive pressure
- critical/finishing pressure
- curses and debuffs
- concealment or suppression
- life/mana manipulation as a possible advanced theme

The exact 5% mature boon for each has not yet been chosen. The purpose of the opposed specialisations is to keep Light and Dark prestigious and broadly strong in affinity matchups without turning Fire, Water, Wind and Earth into obsolete choices.

## 9. Practical Mastery: Martial, Ranged and Shadow

The existing Skills system contains useful foundations and should be redesigned/generalized rather than discarded.

Nexis should use a common Tier 1-10 mastery vocabulary across major practical disciplines, while allowing each discipline to progress through appropriate real use.

### 9.1 Martial

Possible mastery domains include swordsmanship, axes, blunt weapons, polearms, shields, unarmed fighting, two-handed styles and other meaningful weapon disciplines. The exact taxonomy is open.

Specific techniques can be learned through education, trainers, books, academies, discoveries or other requirements. Using those techniques with the appropriate weapon contributes to the broader discipline's mastery.

### 9.2 Ranged

Ranged mastery should become a first-class progression family. Potential disciplines include archery, crossbows, thrown weapons and any additional ranged technology that belongs in the setting.

### 9.3 Shadow

Shadow should be broader than simply "rogue combat". Potential practical disciplines include stealth, pickpocketing, lockpicking, infiltration, disguise, tracking, counter-tracking, sabotage, poisons, assassination and escape/evasion.

Non-combat shadow actions should be able to progress mastery through valid field use rather than forcing every skill into combat.

## 10. Bounty and Capture System

Bounties should become a substantial gameplay loop that rewards different character builds.

Working loop:

1. Bounty becomes available.
2. Investigate the target.
3. Track and locate the target.
4. Engage through a build-appropriate approach.
5. Kill or attempt capture.
6. Capturing alive should be harder and generally more rewarding.
7. A live capture can require incapacitation/non-lethal techniques, restraints, escape prevention, transportation and delivery to the appropriate authority.
8. Rewards can include gold, reputation, records, titles, progression and specialist access.

Different builds should solve bounties differently: fighters through direct control, ranged characters through tracking/disablement, shadow characters through infiltration/poison/evasion, and spellcasters through divination, restraint, illusion or other relevant schools.

First implementation scope should focus on **NPC bounties**. Player bounties/capture can come later once griefing, offline protection, imprisonment, abuse prevention and PvP consent/risk rules have their own design.

## 11. Life Paths Retired

The active Life Paths system should be removed from future character progression.

Player identity should instead emerge from actual decisions, education, mastery, professions, discoveries, organizations, reputation, titles and history.

### 11.1 Existing Life Paths become Feats of Strength

Existing players who chose an old Life Path should not lose that piece of history.

During migration, old Life Path choices become permanent **Feats of Strength**:

- historical/unobtainable achievements
- no gameplay gating
- no power advantage simply for being old
- normally no Legacy Point reward unless explicitly designed otherwise
- new players cannot obtain the retired Life Path feats

This category can later preserve other retired or one-time Nexis history: pre-v2 participation, retired academy content, one-time world events, server-first discoveries, discontinued items/content and similar milestones.

## 12. Chronicle, Achievements, Titles and Legacy

The emerging direction is that the Chronicle should tell the actual biography of a character: major learning, discoveries, mastery milestones, organizations, world events, rare knowledge, captures, notable accomplishments and Feats of Strength.

The current game has overlapping achievement, title, prestige-title, Legacy Point/perk and Chronicle concepts. These should be audited and probably consolidated rather than blindly preserved as separate layers.

Open questions include:

- Should all ordinary achievements award Legacy Points, or should Legacy Points become much rarer milestone rewards?
- Which titles are cosmetic, and should any title grant stats at all?
- Should the Chronicle be a universal player-history system rather than anything donor-gated?
- How should Feats of Strength appear relative to normal achievements?

## 13. Existing Systems Requiring Dedicated Review

The following existing systems are considered valuable candidates for **preserve, redesign, merge, split or retire** decisions. None should be carried forward automatically merely because code exists:

- CIEL and CIEL's role in the world/UI.
- Spirits and Spirit Binding.
- Education and academies.
- Skills and practical mastery.
- Magic, mana, Grimoires, spells and research.
- Combat, Arena, duels and PvP.
- Bounties, notoriety and capture.
- Adventures.
- Excursions/grid exploration.
- DMOS one-shots.
- Guild/Consortium group operations.
- Cities, regional identities and standing.
- World Map, hidden sites, macro-regions and the Hellenic Sphere.
- Travel, mounts, vehicles, cargo, escorts and dangerous routes.
- City vendors, legal markets, player market and Black Market.
- Bank and broader economy.
- Items, equipment, armor sets and cosmetic clothing.
- Crafting, salvage, alchemy, smithing, runes and enhancement.
- Housing, property upgrades and player infrastructure.
- Civic Jobs/professions and Job Points.
- Guilds and Consortiums, including their exact division of purpose.
- Organization bases, construction and logistics.
- Achievements, Feats of Strength, Titles, Legacy Points/perks and Chronicle.
- City Diaries, qualities/reputation flags and world events.
- Codex, Wiki, Archives, bestiary and discovered knowledge.
- Contacts, Rivals, Targets and social systems.
- Admin/live-operations tools.
- Authentication, accounts, sessions and profile uploads.
- Database migration and persistent storage.
- Routing, page taxonomy and the complete visual/navigation redesign.

## 14. Repository Audit Notes So Far

A complete repository **path inventory** has been taken. The semantic audit is being performed subsystem by subsystem rather than pretending that listing every file is the same as understanding every line.

Initial structural findings:

- The project contains substantially more finished/semi-finished systems and content than a superficial page count suggests.
- Several large frontend pages and backend services have accumulated too many responsibilities and will benefit from cleaner domain boundaries in v2.
- There are duplicate/legacy frontend concepts and compatibility routes that should not define the v2 architecture.
- Player state is partly relational and partly concentrated in broad JSONB runtime-state fields. The v2 schema can normalize stable domain concepts while retaining JSON only where flexible/document-like state is genuinely appropriate.
- Existing operational incident documentation, canaries and data-safety lessons are valuable and must survive the rebuild.
- Existing exploration, rare manual, recipe-fragment, hidden-site and world-event systems already provide useful foundations for the newly emphasized discovery/research direction.

## 15. Open Product Questions

These are intentionally unresolved and should be answered one at a time during the continuing brainstorm:

- What exact permanent boon should Light provide at mature Bond?
- What exact permanent boon should Dark provide at mature Bond?
- What happens when a player fails a spirit's favour/bond challenge?
- What exact attunement/switch cooldown should Spirits use?
- What is CIEL's true in-world/product role?
- Which formal schools of magic exist?
- Does Grand Archmage require forbidden/hidden schools?
- How does natural mana regeneration work?
- What exact martial/ranged/shadow mastery disciplines exist?
- How are spells learned after a school is unlocked?
- Can a decoded Grimoire be sold/shared, or does deciphering alter/consume/bind it?
- What happens when a forbidden school is illegal in a given city?
- What should Civic Jobs become in a more education-driven game?
- Do Guilds and Consortiums remain separate, and what should each uniquely do?
- Should Adventures, Excursions and DMOS One-Shots remain separate systems or become different content types built on one underlying adventure engine?
- How expansive should the world be at v2 launch, and which existing regions are canonical launch content?
- How deep should housing/player infrastructure go?
- What belongs in crafting versus formal research versus magical enhancement?
- How should PvP risk, notoriety, player bounties and eventual player capture work?
- How should achievements, titles, Legacy Points and Chronicle be consolidated?
- How should the new game shell/navigation expose deep systems without recreating the old wall-of-pages problem?
- Which current visual identity elements remain canonical, and which should be recreated from scratch?

## 16. Current Rebuild Priority

The earlier idea of making Adventures the first central vertical slice has been superseded by the education-first product direction.

Provisional order, pending further design:

1. Clean account/auth/data foundation.
2. Education engine and knowledge model.
3. Practical mastery framework.
4. Silverbough arcane vertical slice: mana, school access, spell learning/research and school mastery.
5. Combat/adventure integration using those foundations.
6. Bounties/capture and other connected gameplay loops.
7. Continue migrating/redesigning the remaining systems in focused subprojects.

This order is deliberately provisional. The point of the current repository-wide system review is to discover dependencies before pretending a final implementation order already exists.
