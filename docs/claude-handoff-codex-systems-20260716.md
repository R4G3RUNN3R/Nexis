# Claude Handoff: Codex Systems Added After DMOS / One-Shot Discussion

Date: 2026-07-16
Live source of truth: `/srv/nexis/source/NexisGame`
Current live commit at time of this handoff: `db9e0edfc86c8b575c5b29a5660ce6fd85121bc4` plus pending safety/handoff changes in this run until committed.

## Server-Only Process Reminder

All implementation for these systems must continue directly on the live server repo only:

- Live repo: `/srv/nexis/source/NexisGame`
- Live frontend: `/srv/nexis/frontend/current`
- Service: `nexis-waitlist.service`
- Git remote: `git@github.com:R4G3RUNN3R/Nexis.git`

Do not use a local mirror, temp clone, C: workspace, or GitHub as source of truth.

## Relevant Commits

- `2adb24d` - Added Nexis one-shot systems and wiki scaffolds.
- `32bb5ce` - Exposed organization one-shots and expanded item catalog.
- `db9e0ed` - Added map excursions and discovery rewards.

## Personal Nexis One-Shots

Primary route/UI:

- Page: `/one-shots`
- API: `/api/one-shots`
- Frontend: `src/pages/OneShots.tsx`, `src/lib/nexisOneShotApi.ts`, `src/styles/one-shots.css`
- Backend: `server/data/nexisOneShotData.js`, `server/services/nexisOneShotService.js`, `server/controllers/nexisOneShotController.js`, `server/routes/nexisOneShotRoutes.js`

Current state:

- 305 personal campaign definitions exist.
- Uses the DMOS boundary as a Nexis-native fixed-choice engine; standalone DMOS is not modified.
- Embeds player state snapshot.
- Rewards XP, gold, item lines, and permanent Chronicle records.
- Completed campaign IDs are tracked server-side.
- Repeat completion is blocked by `ONE_SHOT_ALREADY_COMPLETED` in `startOneShotForUser`.
- Recent Chronicle cards display completed one-shots.
- Sorting/filtering exists on the One-Shots page.

Important follow-up checks for Claude:

- Authenticated browser test should verify completed campaigns render as completed/locked and cannot be started again.
- Review reward scaling and patron/staff-test access behavior before Stripe donation wiring.

## Organization One-Shots

Primary UI:

- Guilds page includes `OrganizationOneShotsPanel`.
- Consortiums page includes `OrganizationOneShotsPanel`.

Primary files:

- `server/data/organizationOneShotData.js`
- `server/services/organizationOneShotService.js`
- `server/controllers/organizationOneShotController.js`
- `server/routes/organizationOneShotRoutes.js`
- `src/components/organizations/OrganizationOneShotsPanel.tsx`
- `src/lib/organizationOneShotApi.ts`
- `src/styles/organization-one-shots.css`

Rules currently embedded:

- Minimum signups: 5 players.
- Token cost: 1 Nexis one-shot token from each signer.
- Refund chance: 0.0001 = 0.01% per committed token.
- Donators can choose whether to spend tokens on personal, Guild, or Consortium one-shots.
- Guild one-shots are dungeon / monster fighting themed.
- Consortium one-shots are trade / espionage / sabotage themed.
- Rewards go to Guild/Consortium treasury, progression, reputation, and legacy/history ledgers rather than individual player Chronicle.
- Organization legacy records are displayed in the organization one-shot panel.
- Completed organization one-shots cannot be completed again according to Wiki rules; Claude should verify this in service/browser flow.

Campaigns currently defined:

Guild:

- The Bonecrypt Depths
- The Embermaw Hunt
- The Warded Grove Incursion
- The Corsair Cavern
- The Catacomb Champion

Consortium:

- The Sapphire Ledger Exchange
- The Velvet Audit
- The Rival Route Sabotage
- The Relic Futures Play
- The Black Quay Exposure

## PvP Foundation

Primary files:

- `server/data/pvpData.js`
- `server/services/pvpService.js`
- `server/controllers/pvpController.js`
- `server/routes/pvpRoutes.js`
- `src/lib/pvpApi.ts`
- Wiki entry in `src/data/wikiData.ts`

Current exposure:

- API routes are mounted and require session:
  - `GET /api/pvp`
  - `POST /api/pvp/safety`
  - `POST /api/pvp/bounties`
- No active player-facing PvP page is currently wired beyond Arena/duel systems.
- `src/lib/pvpApi.ts` exists but is not currently imported by UI pages.
- PvP hub can initialize/read the authenticated player's own PvP profile.
- Safety preferences can be updated by the authenticated player.

Safety fix applied in this handoff run:

- Bounty writ mutation is now locked unless live ops explicitly sets `NEXIS_ENABLE_PVP_BOUNTIES=true`.
- By default, `issueBountyWritForUser` throws:
  - status: `423`
  - code: `PVP_BOUNTIES_NOT_LIVE`
  - message: `Bounty writs are not live yet. Arena duels remain the active player combat route.`
- PvP season status is now `inactive`, not `scaffolded`.
- Player-facing Wiki copy now says PvP foundation, not PvP scaffold.
- Grep verification found no remaining `pvp-scaffold`, `The PvP scaffold`, `status: "scaffolded"`, or `PVP_SCAFFOLD_VERSION` in the targeted player/server data paths.

Recommended Claude review:

- Keep bounty writs disabled until there is full UI, anti-farming, privacy, cooldown, and result resolution.
- Verify PvP API never exposes another player's Life/Health/private state.
- If building PvP UI, treat Arena duels as the current live combat path and keep high-stakes PvP opt-in by default.

## World Progression Foundation

Primary files:

- `server/data/worldProgressionData.js`
- `server/services/worldProgressionService.js`
- `server/controllers/worldProgressionController.js`
- `server/routes/worldProgressionRoutes.js`
- `src/lib/worldProgressionApi.ts`

Current exposure:

- API route is mounted and auth-gated:
  - `GET /api/world-progression`
- No major player-facing World Progression page is currently wired.
- Response includes city diaries, qualities, world events, and player progress.
- Service normalizes player runtime state for `cityDiaries`, `qualities`, and `worldEventProfile`.

Content currently present:

- City diaries for major launch cities.
- Quality definitions, including story/combat/PvP/chronicle markers.
- World-event templates for city-flavored live-world progression.

Recommended Claude review:

- Decide whether GET normalization side effects are acceptable or should be moved into login/session normalization.
- Wire real progression updates only from actual gameplay events, not fake prefilled progress.
- Ensure diary rewards remain earned and not seeded.

## Wiki Page

Primary route/UI:

- Page: `/wiki`
- Files: `src/pages/Wiki.tsx`, `src/data/wikiData.ts`, `src/styles/wiki.css`
- TopBar/AppShell links include Wiki.

Current state:

- Compact manual page with section index, search, entry cards, routes, and related rules.
- Covers ownership rules, combat/PvP, economy/items, organizations, world progression, one-shots, records, and related systems.
- Wiki is separate from Codex: Wiki explains mechanics; Codex remains lore/archive/reference.

Fix applied:

- PvP wording changed from scaffold language to foundation/inactive-live-ops language.

Recommended Claude review:

- Check Wiki content against current gameplay so it does not overpromise unfinished systems.
- Keep long-form lore in Codex, not Wiki/action pages.

## TopBar / Shell Changes

Primary files:

- `src/components/layout/TopBar.tsx`
- `src/components/layout/AppShell.tsx`
- `src/styles/topbar-dropdown.css`

Current state:

- TopBar includes quick shortcuts such as LG, OS, RC, CD.
- One-Shots and Wiki are reachable from shell navigation.
- Search/quick links remain compact.

Recommended Claude review:

- Make sure shortcut labels are understandable enough for new players, possibly via tooltips/titles.
- Do not clutter the top bar further without consolidating controls.

## Excursion Grid / Tanoth-like Search System

Primary route/UI:

- Adventure page owns actual excursion start/search.
- Travel and World Map show grid/markers and link toward Adventure.

Primary files:

- `server/data/excursionData.js`
- `server/services/excursionService.js`
- `server/controllers/excursionController.js`
- `server/routes/excursionRoutes.js`
- `server/scripts/canaries/excursion-grid-canary.mjs`
- `src/data/excursionMapData.ts`
- `src/lib/authApi.ts`
- `src/pages/Jobs.tsx`
- `src/pages/Travel.tsx`
- `src/pages/WorldMap.tsx`
- `src/styles/jobs.css`
- `src/styles/world-map-ui.css`

Current mechanics:

- World map grid: 16 columns x 10 rows.
- Box travel: 25 minutes per grid distance.
- Local minimum outbound: 15 minutes.
- On-site search time: 1 hour.
- Return time equals outbound time.
- Active excursion blocks starting another excursion.
- Travel-in-progress blocks excursion start.
- Required courses are respected per location.

Current locations:

- Old Watchtower Steps
- Bannerfall Remnant
- Tide-Locked Cache
- Blackwake Wreck Reef
- Moonroot Shrine Ring
- Argent Survey Spire
- Furnace Road Wreck
- Ash Engine Causeway
- Sunken Petition Archive
- Oathbound Outpost
- Black Marsh Causeway
- Red Sand Obelisk
- Blue Isle Signal Cairn
- Glacier Gate Cairns
- Crow Lantern Strand
- Unfiled Archive Door

Reward chances:

- Material: 72%
- Knowledge: 28%
- Skill fragment: 9%
- Magic fragment: 7%
- Absolute fragment: 3%
- Item piece: 2%
- Rare item: 0.1%
- Training book: 1.2%
- Epic recipe fragment/direct: 18% / 3%
- Legendary recipe fragment/direct: 8% / 0.8%
- Mythic recipe fragment/direct: 3.5% / 0.2%

Known shallow area:

- Map marker links open Adventure but do not yet auto-focus/select the exact excursion card.
- No zoom/pan map mode yet.

## Excursion Items / Fragments / Books

Added excursion-discovery items include materials, rare pieces, Absolute fragments, skill/spell fragments, compiled manuals, spellbooks, and training books.

Important item IDs include:

- `registry_brass`
- `watchglass_shard`
- `watchglass_aegis_piece`
- `watchglass_aegis_plate`
- `concordant_shard`
- `concordant_pattern_plate`
- `concordant_aegis_fragment`
- `saltsteel_flake`
- `saltsteel_binding`
- `corsair_relic_piece`
- `blackwake_edge_piece`
- `blackwake_keelmark`
- `wardglass_splinter`
- `moonward_core`
- `argent_focus_piece`
- `argent_spire_focus`
- `furnace_thread`
- `furnace_threaded_brace`
- `bulwark_rivet_piece`
- `anvilheart_frame_piece`
- `anvilheart_frame`
- `oathglass_splinter`
- `oathglass_seal`
- `bastion_writ_piece`
- `bastion_writwork`
- `absolute_ink`
- `absolute_story_fragment`
- `absolute_script_leaf`
- `absolute_relic_shard`
- `sunmetal_grit`
- `redsand_edge_piece`
- `redsand_tempering_salts`
- `blueglass_splinter`
- `blueglass_lens_piece`
- `blueglass_navigation_lens`
- `cold_iron_scale`
- `frostward_scale_piece`
- `frostward_laminate`
- `crowlantern_smoke_charge`
- `registry_glass_index`
- `skill_manual_fragment`
- `spell_text_fragment`
- `compiled_skill_manual`
- `bound_spellbook`
- `watch_drill_book`
- `dockside_training_book`
- `grove_field_book`
- `forge_training_book`
- `court_training_book`
- `waste_survival_book`
- `route_training_book`

## Discovery Recipes

Discovery-only recipes added:

- `epic-watchglass-plate` - 3 fragments
- `epic-saltsteel-binding` - 3 fragments
- `epic-moonward-core` - 3 fragments
- `epic-furnace-thread` - 3 fragments
- `epic-oathglass-seal` - 3 fragments
- `legendary-concordant-pattern` - 5 fragments
- `legendary-blackwake-keelmark` - 5 fragments
- `legendary-argent-spire-focus` - 5 fragments
- `legendary-anvilheart-frame` - 5 fragments
- `legendary-bastion-writwork` - 5 fragments
- `mythic-absolute-script-binding` - 8 fragments
- `legendary-redsand-tempering` - 5 fragments
- `epic-blueglass-navigation` - 3 fragments
- `legendary-frostward-laminate` - 5 fragments
- `epic-crowlantern-smoke` - 3 fragments
- `epic-registry-glass-index` - 3 fragments

Crafting now shows discovery status/hints for discovery-only recipes.

## Excursion Legacy Achievements

Added achievements:

- `exc-001` First Excursion - complete 1 grid-map excursion.
- `exc-002` Excursion Regular - complete 10 grid-map excursions.
- `exc-003` Field Finds - find 20 item lines through excursions.
- `exc-004` Rare Trail Mark - find 1 rare item or rare item piece through an excursion.
- `exc-005` Recipe Unearthed - discover 1 crafting recipe through excursions.

Metrics wired in `server/services/achievementService.js`:

- `excursions_completed`
- `excursion_items_found`
- `excursion_rare_finds`
- `recipes_discovered`

## Verification Already Run By Codex

Previously verified:

- `node --check server/data/legacyAchievementsData.js`
- `node --check server/services/achievementService.js`
- `node --check server/services/excursionService.js`
- `node server/scripts/canaries/excursion-grid-canary.mjs`
- `npm run build`
- Frontend deployed to `/srv/nexis/frontend/current`
- Service active
- `/travel`, `/world-map`, `/adventure`, `/crafting` returned 200
- `/api/excursions` returned 401 unauthenticated

This handoff run additionally verified:

- `node --check server/data/pvpData.js`
- `node --check server/services/pvpService.js`
- `node --check server/scripts/verifyPvpWorldScaffold.mjs`
- `node server/scripts/verifyPvpWorldScaffold.mjs`
- Direct service test confirmed bounty writs throw `423 PVP_BOUNTIES_NOT_LIVE` before DB/gold mutation.
- Targeted grep found no remaining PvP scaffold wording in player/server data paths.

## Claude Priority Suggestions

1. Browser-test personal one-shot repeat locking with a real account.
2. Browser-test organization one-shot signup and completed-lock behavior with controlled canary users/orgs.
3. Keep bounty writs inactive until full PvP implementation exists.
4. Decide whether World Progression should stay as an API-only foundation or receive a compact UI surface.
5. Review Wiki for overpromises now that it documents systems ahead of UI depth.
6. Continue donation/Stripe wiring separately: tokens should feed personal, Guild, and Consortium one-shot access.
