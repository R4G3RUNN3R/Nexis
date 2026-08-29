# Nexis Systemic Item Interaction Design

**Status:** APPROVED DESIGN
**Date:** 2026-08-29
**Product:** Nexis

## 1. Purpose

Nexis should let players attempt to use owned items in the way they choose. The engine should resolve what actually happens from the item's properties, the player's capabilities and knowledge, the chosen intent, and the current context. Restrictions exist only where they protect world integrity, economy integrity, or represent an actual in-world condition such as a curse.

This design deliberately rejects arbitrary equipment requirements that say a player simply may not equip an item because a stat, level, skill, or knowledge threshold is too low.

The core player-facing principle is:

> **You can try. The world determines what happens.**

## 2. Binding gameplay principles

1. **One account, one player identity, one character.** Nexis is one persistent world and one persistent economy. This design does not introduce character slots, alternate characters, campaign characters, or transfer-oriented multi-character infrastructure.
2. **Players may equip items regardless of stat, skill, or knowledge qualification.** Low capability changes effectiveness, control, cost, and risk. It does not normally prevent the attempt.
3. **Items retain their own authoritative properties.** Character capability changes effective use, not the item's underlying definition.
4. **Stats and knowledge may change behaviour, not merely magnitude.** At meaningful extremes, the set of practical outcomes can change.
5. **Negative consequences are legitimate.** Severe underqualification or dangerous misuse may cause inefficiency, exhaustion, mishaps, self-harm, loss of control, unintended activation, or other systemic consequences.
6. **Extreme overqualification may enable extraordinary outcomes.** Very high capability may allow restraint, overpowering an item's intended function, unusual handling, novel control, or other emergent uses.
7. **Unconventional use is systemic.** No item-specific branch should exist merely because one example inspired a feature. The resolver operates on item properties and semantic actions.
8. **Achievements consume semantic outcomes.** Achievements should observe what actually happened, not hard-code one named item wherever a generic category or interaction can express the same feat.
9. **Curses are real world-state restrictions, not arbitrary UI rules.** A cursed item may become bound when equipped and block ordinary removal until its curse is removed, satisfied through an approved quest/mission path, or purified according to that item's content definition.
10. **Player freedom is bounded by integrity.** An item currently committed to another authoritative use cannot simultaneously be sold, traded, consumed, destroyed, crafted with, auctioned, or otherwise ownership-transferred unless that action explicitly resolves the prior commitment atomically.

## 3. Ownership and equipment model

### 3.1 Inventory remains the authority for item availability

Use the **M-reserve** model.

Inventory remains the authoritative owner of an item instance's availability. Equipment holds the validated reference that describes how the character is currently wearing, holding, or otherwise equipping that item.

Conceptually, an item instance can be in an availability/disposition state such as:

- available;
- equipped/reserved;
- escrowed;
- trade-locked;
- crafting-locked;
- quest-locked;
- cursed-bound;
- destroyed/retired.

These names are conceptual. Implementation may use typed state rather than one universal enum if that better preserves domain ownership.

The invariant is more important than the representation:

> **There is one authoritative answer to whether an item instance is available for another ownership-changing or consuming action.**

### 3.2 Equip and unequip are atomic multi-owner commands

Normal equip:

1. Inventory verifies the item is available and reserves it for equipment.
2. Equipment records the slot/reference.
3. Both effects commit atomically or neither does.

Normal unequip:

1. Equipment clears the slot/reference.
2. Inventory releases the reservation and makes the item available again.
3. Both effects commit atomically or neither does.

**Unequip Item is the approved C3 real multi-owner gameplay proof** because it exercises two real owners without requiring balance values or invented content.

### 3.3 Equipped items cannot be double-spent

A normal equipped item is freely removable, but it is not simultaneously available for sale, trade, auction, crafting consumption, destruction, or another ownership-changing action.

The player is not being arbitrarily restricted. They may unequip first, or a future explicit compound command may atomically resolve both actions if the design later authorizes one.

## 4. Systemic item interaction resolver

Nexis should resolve item use from composition rather than named-item special cases.

Conceptually:

`PlayerIntent + ItemProperties + CharacterCapability + Knowledge + Context -> ResolvedOutcome`

### 4.1 Player intent

The action layer should infer unconventional intent from the normal action system whenever the player's target and chosen action make that intent clear.

Examples include:

- strike with;
- throw;
- block with;
- activate;
- use as a tool;
- apply to a target;
- combine with an allowed contextual action.

A generic **Improvise** action exists only as a fallback when the intended interaction cannot be expressed naturally through existing contextual actions.

The UI should not become a giant catalogue of every strange use developers anticipated. The engine should model capabilities and let the resolver determine outcomes.

### 4.2 Item properties

The resolver consumes authoritative properties appropriate to the interaction, potentially including:

- mass;
- shape/form factor;
- material;
- durability/condition;
- handling profile;
- intended function;
- magical or technological effects;
- activation method;
- damage/healing/resource effects;
- curse state;
- other typed properties introduced by approved systems.

The design does not require every future item to expose every property. Contracts should remain typed and domain-specific rather than devolving into an unbounded generic property bag.

### 4.3 Character capability

Relevant capability may include:

- physical stats such as Strength or Dexterity;
- skill/mastery/familiarity;
- resource availability;
- temporary statuses;
- other approved character capabilities.

Capability determines effective use. It does not rewrite the item's canonical properties.

### 4.4 Knowledge

Knowledge determines what the character understands about an item and therefore what they can intentionally control or recognize.

Knowledge may affect:

- identification of properties;
- recognition of hidden or dangerous functions;
- activation efficiency;
- safe operating technique;
- the ability to deliberately reproduce a previously discovered unusual interaction;
- what Player Log/Codex/CIEL may legitimately reveal.

Canonical truth, world belief, discovered evidence, character knowledge, and presentation remain separate concepts.

### 4.5 Context

The resolver may consider:

- target and target state;
- distance/range;
- environment;
- item condition;
- current character condition;
- relevant active effects;
- other authoritative situational state.

## 5. Qualification continuum

The engine should treat capability as a continuum rather than a binary requirement gate.

### 5.1 Severely underqualified

The player can still attempt the action, but systemic consequences may include:

- poor handling;
- reduced accuracy/control;
- inefficient output;
- higher stamina/resource burden;
- slow recovery;
- incomplete activation;
- misfire/backlash;
- dropping or losing control of the item;
- self-injury or collateral consequences when the mismatch is extreme and the item/use is inherently dangerous.

Ordinary mismatch should produce predictable inefficiency. Mishap risk should be reserved for sufficiently extreme mismatch, dangerous items, dangerous actions, or other clearly modelled circumstances.

### 5.2 Appropriately qualified

The item behaves broadly as its intended function suggests, subject to ordinary variation and context.

### 5.3 Highly qualified

The character gains better control, efficiency, precision, output conversion, resource use, and intentionality.

### 5.4 Absurdly overqualified

At extreme capability, the resolver may unlock qualitatively different outcomes rather than only larger numbers.

Examples of the *class* of behaviour include:

- controlled restraint that weaker users cannot perform reliably;
- overpowering an item's normal physical behaviour;
- unusual handling of normally unwieldy objects;
- one-handed or precision use that emerges from capability;
- extreme throws or force application;
- turning a normally negligible physical component into a meaningful one;
- new deliberate interaction modes justified by the underlying properties.

These outcomes should emerge from systemic thresholds/rules and semantic properties, not named-item checks.

## 6. Multi-effect outcomes

One attempted interaction may produce multiple simultaneous effects.

For example, an object with a restorative magical function used as a physical striking implement can produce both:

- physical impact; and
- restorative discharge.

The final outcome is the composition of those effects under the current character, target, and context.

This is the approved pattern for the earlier Healing Wand example. **Healing Wand is not a special case and must not receive item-name-specific engine logic.**

## 7. Player control at high capability

High capability should usually increase agency rather than force maximal output.

Where the system can model it meaningfully, a sufficiently capable character may choose between controlled and forceful use. For example, extraordinary Strength may permit deliberate restraint rather than making every physical interaction destructive.

The exact player-facing action vocabulary should be contextual and minimal. Do not predeclare a universal `Controlled Strike` / `Full Force` menu for every item. The resolver and action layer should expose such choices only where the underlying interaction supports them.

## 8. Cursed items

### 8.1 Binding rule

When content defines an item as cursed and its curse activates on equip, the curse may create authoritative character-bound effect state sourced from that exact item instance.

Normal `UnequipItem` must fail while the active curse declares the item non-removable.

### 8.2 Removal paths

A cursed item becomes normally removable only when an approved world action changes the curse state, for example:

- completing the relevant questline or mission condition;
- curse removal;
- purification;
- another future content-defined mechanism that is explicitly authorized by the curse system.

### 8.3 Effects and purification

Positive and negative effects originating from the curse remain bound to the character while the curse remains active.

Purification/removal must change the authoritative source state so dependent effects disappear or transform consistently. It must not rely on a loose sequence of manually adding/removing unrelated buffs that can partially fail and leave impossible residual state.

The item definition may specify whether purification:

- removes only the binding;
- removes or transforms the curse;
- changes the item's effects;
- destroys/transforms the item;
- or performs another explicitly authored outcome.

No universal balance outcome is invented by this architecture.

## 9. Semantic interaction events and achievements

The resolver should emit typed semantic outcome evidence suitable for History, Player Log, achievements, analytics, and future systems without leaking hidden truth.

Conceptually an outcome can describe:

- item instance/category/archetype references appropriate to the consumer;
- chosen interaction intent;
- target classification where disclosure is legitimate;
- effect components produced;
- net resolved result;
- whether the use was improvised/unconventional;
- relevant public-safe capability band or derived classification if needed by an achievement rule.

Achievements should subscribe to semantic patterns such as:

- cumulative physical damage caused using items primarily intended for healing;
- extraordinary improvised-weapon outcomes;
- successful extreme-capability interactions;
- surviving catastrophic misuse;
- discovering or reproducing unusual interactions.

Exact achievement names, thresholds, rewards, and balance values are content decisions and are deliberately outside this architecture spec.

Hidden achievements are permitted. Players should be able to discover systemic possibilities through experimentation rather than being told every possibility in advance.

## 10. Abuse and integrity rules

Freedom does not mean duplicate authority or client trust.

The implementation must preserve:

- server-authoritative resolution;
- immutable authoritative item instance identity;
- atomic owner transitions;
- no double-spend of an equipped/reserved/escrowed/consumed item;
- deterministic or authoritatively seeded resolution where replayability requires it;
- auditable semantic outcomes;
- no client-supplied final damage/healing/effect result;
- no hidden-truth leakage through outcome events, achievements, Player Log, or CIEL;
- no generic state bag that allows arbitrary item rules to bypass typed ownership.

## 11. Architecture boundaries

This feature should be split by responsibility rather than placed into one universal item service.

- **Inventory** owns possession and item availability/reservation.
- **Equipment** owns equipped slot/reference state.
- **Core** owns deterministic legal/effective interaction evaluation from supplied typed snapshots.
- **Knowledge** owns what the character has legitimately learned.
- **Curse/effect authority** must be assigned to the appropriate approved owner when that subsystem is implemented; Equipment must not quietly become a generic persistent-effects database.
- **Achievements/Recognition** consume semantic outcome evidence; they do not decide the underlying interaction.
- **History/Player Log/CIEL** consume disclosure-safe projections; they do not receive omniscient raw truth merely because the server knows it.

Any future subsystem that needs to mutate another owner's state must do so through the existing authoritative command/transition boundary rather than private-table writes.

## 12. C3 decision

The approved first real multi-owner gameplay proof is **Unequip Item under M-reserve**.

Required proof:

1. Equipment clears the equipped reference.
2. Inventory releases the corresponding reservation.
3. Both owner transitions occur in one authoritative atomic command.
4. Retry/idempotency semantics prove exactly-once behaviour.
5. Opposing concurrent operations cannot double-spend the item.
6. A cursed-bound item is denied before either owner transition is committed.
7. The proof uses no invented balance values.

This closes the product-design side of the C3 human gate. Engineering verification remains required before the Foundation stop condition is considered met.

## 13. Non-goals

This design does not define:

- exact stat formulas;
- exact qualification thresholds;
- exact mishap probabilities;
- individual item balance values;
- curse questlines;
- purification costs;
- achievement thresholds/rewards;
- a complete physics simulator;
- arbitrary natural-language action parsing;
- client-authoritative improvisation;
- multiple playable characters.

Those require separate approved content/system designs.

## 14. Acceptance criteria for the implementation plan

A later implementation plan must include tests proving at minimum:

1. a player can equip an item while below its ordinary effective-use capability;
2. underqualification changes resolved effectiveness rather than becoming an equip denial;
3. extreme mismatch can produce a typed negative consequence when the interaction model justifies one;
4. high capability can improve control/efficiency without rewriting item properties;
5. an extreme-capability systemic case can change the interaction outcome without checking a specific item name;
6. one interaction can compose multiple typed effects;
7. an unconventional action is inferred from a normal contextual action when expressible;
8. `Improvise` is available only as a fallback for otherwise unexpressed intent;
9. M-reserve prevents sale/trade/consumption of an equipped item without an authorized atomic release;
10. normal unequip atomically updates Equipment and Inventory;
11. cursed-bound unequip commits neither transition;
12. curse removal/purification changes the authoritative source state and dependent effects consistently;
13. semantic outcome events can drive a generic achievement rule without named-item logic;
14. hidden/unknown properties are not leaked to Player Log, public projections, achievements, or CIEL;
15. replay/concurrency/idempotency tests cover the multi-owner command path.

## 15. Approved decisions captured here

The human product owner explicitly approved the following direction in conversation on 2026-08-29:

- players should feel free to play as they choose while abuse is prevented;
- players may equip items regardless of stats/knowledge qualification;
- stats and knowledge determine how well, safely, and intentionally items are used;
- underqualification may have negative consequences;
- extreme overqualification may create extraordinary outcomes and additional control;
- unconventional item use must be systemic rather than hard-coded per item;
- contextual normal actions should express unconventional intent wherever possible;
- a generic `Improvise` action is only the fallback;
- cursed items may bind on equip and remain non-removable until resolved through authored in-world means such as quest/mission completion, removal, or purification;
- systemic outcomes may feed achievements, including hidden/discovery-oriented achievements;
- M-reserve is the recommended and approved ownership model for preserving player freedom while preventing double-spend;
- Unequip Item is the approved C3 multi-owner proof.
