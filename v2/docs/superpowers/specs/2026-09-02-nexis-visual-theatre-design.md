# Nexis Visual Theatre Design

**Status:** Proposed for user review

**Date:** 2 September 2026

**Base:** `f72e8bcc38c2a2f1eb23b41132ac90c8d28316a4`

**Working branch:** `feature/nexis-v2-visual-theatre-foundation-20260902`

## Purpose

Nexis Visual Theatre is an embeddable, presentation-only graphical subsystem for Nexis. Its first consumer is Combat Theatre. The same renderer foundation is intended to support later Excursion Theatre and Adventure Theatre without turning the presentation layer into a second game engine.

The subsystem exists so players can see their actual Nexis character act on screen, choose allowed actions and targets, watch skills/items/statuses resolve visually, and later replay or spectate authoritative encounters.

It is not a standalone game. It does not own gameplay state, progression, inventory, combat formulas, quests, economy, identity, authentication, persistence, or lore.

## Binding architecture principle

**Nexis determines reality. Visual Theatre displays it and captures intent.**

Every graphical/browser/native client is attacker-controlled. A player may inspect, modify, automate, memory-edit, speed up, replace, or completely rewrite the client. None of those actions may grant authoritative gameplay power.

The trusted side owns all authoritative facts and decisions, including actor identity, legal actions, current state, RNG, time, hit/miss/crit results, damage/healing, resource changes, cooldown truth, initiative/turn order, item ownership/quantity, status application/duration, encounter completion, victory/defeat, XP, rewards and loot.

The client may submit narrow intents only. Examples include choosing an action, skill, item or target. The server re-evaluates every intent against current authoritative state through the approved Nexis command execution lane.

## Scope

### Phase 1: Combat Theatre renderer foundation

Phase 1 replaces the current DOM/CSS battlefield rendering in the development harness with a real 2D stage while preserving all existing typed Combat Theatre contracts and mock-authority semantics.

Phase 1 includes:

- a PixiJS v8 stage;
- explicit WebGL preference for the initial production path;
- large readable 2D actor presentation;
- battlefield background/ground/actor/effect/feedback/overlay layers;
- actor positioning and facing;
- presentation-only movement/pose/effect commands;
- floating values and visual feedback sourced only from authoritative projections/events;
- target selection bridged to the existing intent path;
- replay and spectator compatibility;
- reduced-motion, reduced-shake and reduced-flash support;
- a semantic DOM accessibility mirror;
- deterministic development fixtures;
- clean mount/unmount and GPU/ticker/listener disposal;
- a DOM fallback during migration and testing.

Phase 1 does not select or adopt a skeletal animation runtime. Primitive/original development placeholders are sufficient until the free/open-source runtime security audit is complete and separately approved.

### Future phases

The renderer foundation may later support:

- skeletal/mesh actor animation through an approved free/open-source adapter;
- layered body/hair/face/armour/cloak/weapon/accessory visuals;
- Combat Theatre;
- Excursion Theatre;
- Adventure Theatre;
- PvP spectator views;
- deterministic battle replay;
- tournament/review tooling;
- future web/native host wrappers.

Future consumers reuse the renderer. They do not share or merge authoritative domain ownership.

## Technology direction

### Renderer

PixiJS v8 is the preferred 2D rendering layer for Phase 1, subject to implementation verification.

Reasons:

- free/open source;
- browser-first;
- TypeScript-compatible;
- suitable for retained 2D scene graphs, sprites, containers, effects and camera-like presentation;
- integrates with the existing React/TypeScript development harness without requiring React to become the permanent renderer contract;
- does not require adopting a full client-side game engine with its own gameplay-state model.

WebGL is the initial renderer preference. WebGPU may be evaluated later behind capability/feature gates; it is not required for Phase 1.

### React boundary

React remains useful for the current host/HUD and accessibility surfaces, but the long-term renderer core must not require React.

Target decomposition:

- `theatre-core`: renderer-agnostic TypeScript presentation contracts and orchestration;
- Pixi renderer implementation: stage/layers/actors/effects/input bridge;
- optional React host wrapper for current browser integration;
- later host wrappers may use other UI frameworks or direct mounting.

The current Lovable project is a development harness/prototype, not the production authority and not the permanent owner of the subsystem architecture.

### Character animation runtime

Paid/commercial runtime/editor dependencies are rejected for this subsystem.

The production character-animation path must be free/open-source and permit commercial use without a required paid licence. Candidate runtimes must pass licensing and security review before adoption.

No candidate is approved by this spec. The runtime is an adapter behind a stable actor-renderer interface. A custom Pixi attachment/skeletal implementation remains an acceptable fallback if third-party runtime risk is not justified.

## Presentation data boundary

Visual Theatre receives only the minimum player-visible projection necessary to render and offer legal interactions.

It must not receive hidden state merely so CSS/canvas code can hide it.

Examples of data that must remain server-side unless explicitly revealed to the player include:

- RNG seeds;
- hidden enemy attributes;
- hidden status identities;
- unrevealed weaknesses/resistances;
- internal anti-cheat/security fields;
- staff/admin data;
- raw authorization capabilities;
- internal AccountId/CharacterId when a public-safe selector/projection is sufficient;
- unpublished loot tables or encounter-resolution internals.

Knowledge-aware rendering must support an effect being visible without revealing its internal identity, e.g. `Unknown Effect`.

## Intent boundary

Visual Theatre may produce user intents such as:

- choose basic attack;
- choose supplied skill;
- choose supplied combat item;
- choose target;
- inspect when permitted;
- defend;
- flee/withdraw when offered;
- future excursion/adventure interaction choices supplied by Nexis.

The client does not decide whether an intent is legal or successful. It may disable or annotate controls based on the latest server-supplied projection for user experience, but the server must independently validate every submitted intent.

## Event and snapshot model

The renderer is driven by authoritative snapshots and semantic presentation events/projections.

Semantic events may represent presentation capabilities such as:

- actor moved;
- skill activated;
- attack hit/missed;
- critical result;
- damage/healing applied;
- resource changed;
- status applied/removed;
- item used;
- actor guarded/dodged/blocked/parried/stunned/defeated;
- round/turn changed;
- combat message;
- encounter ended.

The existence of a renderer event type does not create a gameplay mechanic. Only authoritative Nexis systems may emit/approve the corresponding occurrence.

Where possible, events should carry authoritative resulting values rather than asking the renderer to reconstruct authoritative state from arithmetic.

Example: prefer `resultingLife = 63` over requiring the client to treat `100 - 37` as truth.

## Renderer isolation

The renderer must not receive an adapter capable of persistence or arbitrary API access.

The renderer-facing model should be sanitized presentation data plus narrow callbacks.

Renderer code must not contain:

- gameplay RNG;
- combat formulas;
- authoritative resource arithmetic;
- inventory ownership logic;
- reward/loot logic;
- authentication/authorization logic;
- database access;
- Supabase or other independent persistence;
- arbitrary network clients;
- runtime CDN requirements;
- client secrets;
- eval/new Function or equivalent dynamic-code execution without an explicit future security review.

A compromised renderer should, as far as practical, be capable of corrupting local presentation only.

## Pixi stage model

The Phase 1 stage should be stage-first, inspired by the readability of classic 2D browser RPG combat without copying any third-party art, characters, layouts, names, code or assets.

Suggested logical layers:

1. far background;
2. mid/background environment;
3. ground plane;
4. actors;
5. projectiles and transient effects;
6. floating feedback;
7. selection/turn overlays.

The battlefield is the visual hero. HUD/debug tooling must not dominate the player-facing theatre.

Desktop actors should be large enough to read equipment/pose clearly. Exact pixel dimensions are presentation tuning, not contract authority.

## Actor renderer contract

The stage must depend on an actor-renderer abstraction rather than directly depending on a specific skeletal runtime.

The abstraction should support presentation concepts such as:

- stable actor visual identity key;
- faction/side and facing;
- placement;
- pose/animation intent;
- acting/selected/legal-target/defeated presentation states;
- body/equipment/weapon visual attachment descriptors when provided;
- aura/effect attachment descriptors when provided;
- lifecycle/disposal.

Phase 1 may implement primitive actor placeholders. A future approved skeletal renderer must be replaceable without changing Combat authority, adapter semantics or stage orchestration.

## Equipment and item visuals

Equipment shown by the Theatre comes from an authoritative player-visible equipment projection. Visual attachments do not grant ownership or effects.

The renderer may display supplied fantasy item visuals. It must not create new Nexis item definitions, mechanics or technologies.

Modern firearms, military equipment, vehicles, electronics, cybernetics, lasers, sci-fi technology and other unapproved technology are outside Nexis visual content and must not be invented by renderer tooling.

Unknown/missing assets use neutral placeholders rather than invented canon.

## Skill presentation

The Theatre receives a list of skills/actions the player is allowed to see/use from Nexis or deterministic development fixtures.

Favourite hotbar slots are convenience only. The Theatre must also support access to the full set of supplied currently usable/known combat skills.

Animation intent is presentation metadata. It never determines damage, effects, cooldowns or legality.

Prototype skill/item fixture names used in the development harness are reference fixtures only until V2 content authority explicitly adopts them.

## Input and target selection

Pixi actor hit areas may capture pointer/touch selection only when the host presentation state says the actor is an offered legal target.

Selecting an actor forwards the existing target intent/callback. The stage must not locally promote an illegal target to legal.

Keyboard and assistive-technology users require an equivalent DOM semantic target list. Canvas hit testing is not the only interaction path.

## Accessibility

Canvas/WebGL output is not an adequate accessibility surface by itself.

The host must maintain a semantic DOM mirror containing player-visible actor names/states/resources/statuses and accessible controls for legal target/action selection.

The visual canvas may be `aria-hidden` where the semantic mirror carries equivalent information.

Reduced motion, reduced camera shake and reduced flashes are binding user preferences for the renderer.

Combat meaning must not rely solely on colour.

## Replay and spectator modes

Live, replay and spectator presentation should share the same rendering/event-processing path.

Replay replays supplied authoritative events/projections. It does not reroll or recalculate outcomes.

Spectator/replay modes disable action submission while retaining the same presentation surface.

Replay speed affects presentation timing only, never authoritative time or cooldown truth.

## Lifecycle and performance

The renderer must support clean repeated mount/unmount.

Required lifecycle discipline includes:

- one controlled Pixi Application per mounted theatre instance;
- bounded device-pixel ratio/render resolution;
- ResizeObserver or equivalent host-container resize management;
- ticker/listener registration tracked and removed;
- pooled/reused transient VFX where appropriate;
- no per-frame texture creation;
- no unbounded particle DOM/object growth;
- GPU textures/sources/children disposed correctly on unmount;
- background-tab throttling/idle strategy where safe;
- no authoritative behavior tied to render frame rate.

## SSR/host compatibility

The renderer must not require browser globals during server-side module evaluation.

In the current React/TanStack harness, Pixi should be client-mounted/dynamically loaded as needed so server/prerender builds do not execute browser-only renderer initialization.

If Pixi initialization fails or the capability is unavailable, Phase 1 should fail gracefully to a neutral/DOM fallback rather than a blank or broken encounter.

## Security requirements

The permanent client-trust model applies in full.

Phase 1 and later phases must preserve:

- server-derived acting character identity;
- current-state validation of every action;
- CommandId/idempotency protection where state mutation occurs;
- stale/concurrent-state rejection;
- server-owned RNG and time;
- server-owned owner-module writes;
- no reward/loot/victory trust from the client;
- minimum-necessary player-visible projections;
- rate limiting/abuse telemetry on trusted paths;
- exploit attempts converted into permanent regression evidence where material;
- no security guarantee dependent on minification, obfuscation or code secrecy.

## Dependency policy

Any new client dependency used by Visual Theatre must be reviewed before production adoption for:

- licence and commercial-use rights;
- active maintenance/release history;
- maintainer/package ownership concentration;
- dependency tree and transitive supply-chain risk;
- CSP compatibility;
- use of dynamic code execution;
- runtime network/CDN assumptions;
- ability to pin exact versions;
- ability to vendor/fork where justified;
- SBOM/licence inventory integration;
- vulnerability/advisory status.

High-value narrow dependencies may be pinned and vendored/audited rather than automatically tracking upstream latest releases.

## Development harness

The Lovable project remains labelled `Nexis Combat Theatre - Development Harness` and is not a standalone game.

The harness may expose developer controls for scenario, viewer mode, viewport, animation speed, accessibility preferences, renderer comparison and event inspection.

Developer tooling must remain visually and structurally separable from the embeddable player-facing theatre.

## Non-improvisation rules

Visual Theatre implementation agents may make technical rendering decisions within this spec. They may not invent Nexis product/game design.

Without explicit authority they must not invent:

- lore;
- races/classes/factions/cities;
- enemies/monsters;
- skills/spells;
- items/equipment;
- technologies;
- currencies;
- progression;
- combat formulas;
- attributes/resources;
- loot/rewards;
- status mechanics.

Missing content uses interfaces, supplied fixtures or neutral placeholders.

## Testing strategy

Implementation follows targeted TDD for new renderer behavior.

Minimum Phase 1 test areas:

- pure presentation-command mapping;
- deterministic actor placement;
- mount/unmount and StrictMode-style double-mount cleanup;
- target-selection forwarding;
- semantic accessibility mirror;
- replay/spectator non-interactivity;
- reduced-motion/shake/flash behavior;
- SSR/import safety;
- renderer purity checks preventing obvious RNG/network/persistence additions;
- DOM fallback behavior;
- strict TypeScript typecheck;
- production build/prerender;
- targeted browser scenarios A-E.

This work does not authorize a single AI to run or certify the complete Nexis release gate. Full-suite/release evidence remains separate under existing release safeguards.

## Phase 1 acceptance criteria

Phase 1 is acceptable for integration review when all of the following are true:

- PixiJS v8 renders the existing deterministic Combat Theatre scenarios through the current adapter/event flow;
- the adapter/contracts and mock authoritative outcomes are not rewritten to satisfy the renderer;
- client-side combat/RNG/ownership/reward logic is absent;
- actors, effects, target selection and floating feedback are visibly rendered on the stage;
- legal target selection forwards the same intent path as the existing theatre;
- replay and spectator modes use the same renderer without authority changes;
- accessibility retains a semantic DOM path;
- reduced-motion/shake/flash preferences work;
- Pixi mount/unmount leaves no orphan ticker/listener/application/GPU resources in targeted lifecycle tests;
- WebGL is the initial renderer preference;
- browser/SSR build paths remain valid;
- failure to initialize the graphical renderer fails gracefully;
- no paid/commercial runtime dependency is introduced;
- no skeletal runtime is adopted until its separate security/licensing review is approved;
- relevant targeted tests/typecheck/build are green;
- no merge, deployment or release implication occurs automatically.

## Explicit non-goals for Phase 1

- selecting or installing the skeletal runtime;
- final Nexis character art;
- final environments;
- final VFX/audio library;
- WebGPU requirement;
- physics engine;
- client-side pathfinding/game simulation;
- multiplayer networking implementation;
- real authoritative Combat module implementation;
- Excursion/Adventure production implementation;
- inventory/equipment/progression backend work;
- production deployment.

## Open decisions

The following remain intentionally open until evidence is available:

1. Which free/open-source skeletal animation runtime, if any, is adopted after the security/licensing audit.
2. Whether the selected runtime is consumed as a pinned package or a reviewed/vendored Nexis fork.
3. Final visual asset format and authoring pipeline for character skins/equipment.
4. Exact boundary/package layout when the visual client repository/platform integration is formally established.

