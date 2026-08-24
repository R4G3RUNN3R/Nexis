# Nexis v2 Source System Map

> **Status:** Current-system inventory and v2 destination map.  
> **Branch:** `voidsmith-source-of-truth`  
> **Live baseline:** old Nexis commit `88b5f8c5ea8fa3f967d1eb1ab8b22eec7f0cc6c6` plus the live PostgreSQL snapshot preserved on 2026-08-24.

This document maps meaningful current Nexis systems to their source files, current storage, player-facing surfaces, and intended v2 treatment.

---

## 1. Identity, authentication and account lifecycle

**Current source**
- `server/services/authService.js`
- `server/services/accountService.js`
- `server/services/googleAuthService.js`
- `server/services/publicIdService.js`
- `server/repositories/usersRepository.js`
- `server/repositories/sessionsRepository.js`
- `server/repositories/authIdentitiesRepository.js`
- `server/repositories/googlePendingRegistrationsRepository.js`
- `server/repositories/passwordResetRepository.js`
- `server/repositories/emailChangeRepository.js`
- `server/repositories/publicIdAllocatorRepository.js`
- `src/pages/Register.tsx`
- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Settings.tsx`
- `src/pages/ConfirmEmailChange.tsx`

**Current storage**
- `users`
- `auth_sessions`
- `user_auth_identities`
- `google_pending_registrations`
- `password_reset_tokens`
- `email_change_tokens`
- `public_id_allocators`

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- preserve internal/public IDs and account continuity;
- explicit server-side authorization domain;
- Hennet public/true profile projection service;
- admin identity remains technical and account-bound;
- session/token rules revalidated for new deployment.

---

## 2. Generic player state/runtime state

**Current source**
- `server/repositories/playerStateRepository.js`
- `server/services/stateService.js`
- `server/services/playerMutationService.js`
- `server/lib/runtimePlayerState.js`
- React player context/state layers

**Current storage**
- `player_state` scalar fields plus multiple JSONB branches.

**Disposition:** **TRANSFORM heavily**

**V2 destination**
- retain flexible low-contention character preferences/snapshots in JSON only where justified;
- normalize transactional, shared, historical, economy, progression-ledger, transfer and query-heavy state;
- event ledger becomes the authoritative history feed rather than each system inventing isolated arrays.

---

## 3. Administrator tooling and audit

**Current source**
- `server/services/adminService.js`
- `server/repositories/adminAuditRepository.js`
- admin routes/controllers/policies
- `src/pages/Admin.tsx`

**Current storage**
- `admin_action_logs`
- `admin_one_shot_token_grants`

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- dedicated operational surface separate from Hennet's public game UI;
- all privileged mutations server-authoritative and audited;
- private Hennet projection available only to primary-owner session;
- no admin data sent to unauthorized clients.

---

## 4. Education and academies

**Current source**
- `server/data/educationData.js`
- `server/services/educationService.js`
- academy/city reward gating inside city services
- `src/data/educationData.ts`
- `src/data/academyData.ts`
- `src/pages/Education.tsx`
- `src/pages/Academies.tsx`

**Current storage**
- `player_state.education_state`
- legacy education keys in player snapshot

**Current useful behavior**
- real-time study;
- offline progression;
- prerequisites;
- completed-course history;
- permanent unlocks;
- academy/city access gates;
- some system unlocks such as mana.

**Disposition:** **TRANSFORM into core v2 progression spine**

**V2 destination**
- institution/course/prerequisite/capability model;
- selected examinations/certifications;
- course planning;
- Silverbough magic foundations;
- Spirit Studies/Attunement;
- migration map for valid completed education.

---

## 5. Skills and practical mastery

**Current source**
- `server/data/skillData.js`
- `server/services/skillService.js`
- `src/pages/Skills.tsx`

**Current useful behavior**
- active/passive skill slots;
- use XP;
- mastery thresholds;
- requirements;
- evolution at milestones;
- server-side context checking.

**Disposition:** **TRANSFORM**

**V2 destination**
- practical mastery separated from formal education;
- martial weapon disciplines;
- ranged disciplines;
- Shadow disciplines;
- magic-school mastery handled at school level rather than per spell;
- retain proven server validation/use-count patterns.

---

## 6. Combat, equipment and stats

**Current source**
- `server/data/combatData.js`
- `server/services/combatService.js`
- `server/services/itemService.js`
- `server/services/itemAdvancedService.js`
- `server/data/itemData.js`
- `src/pages/Inventory.tsx`
- equipment/stat UI components

**Current storage**
- `player_state.stats`
- `working_stats`
- `battle_stats`
- inventory/equipment/item state in `player_snapshot`

**Disposition:** **KEEP content / TRANSFORM engine**

**V2 destination**
- preserve legitimate stats, items, equipment sets and ownership;
- redesign combat/status math after core domain architecture;
- normalize significant item instances where provenance matters;
- ordinary stackable commodities remain quantity-based.

---

## 7. Mana and conventional magic

**Current source**
- mana keys in `runtimePlayerState.js` / schema comments
- magic skills in `skillData.js`
- combat/item services
- academy reward gates

**Current useful behavior**
- mana locked at 0/0 until relevant education reward;
- mana-consuming skills exist.

**Disposition:** **TRANSFORM**

**V2 destination**
- conventional magic is character-powered and mana-limited;
- formal magic access/knowledge/mastery separated;
- magic schools and spell learning redesigned under Silverbough spec;
- exact mana recovery remains a dedicated balance/design subject.

---

## 8. Spirits

**Current source**
- `src/data/spiritData.ts`
- visual Spirit assets in production/public directories

**Old mechanics**
- Fire/Wind/Water/Earth only;
- low/medium/high;
- 3/5/10% style bonuses;
- 12-hour switching concept;
- long per-element progression.

**Disposition:** **TRANSFORM under approved Spirit v2 spec**

**V2 destination**
- real individual Spirits;
- Fire/Water/Wind/Earth plus Apex Light/Dark;
- rare encounters/favour/Bond/Silverbough curriculum;
- one active Spirit;
- long 0→5% Bond development;
- cooldown-only Spirit techniques usable by non-casters;
- Greater Communion and Manifestation;
- Codex/profile/Chronicle separation.

Approved design source: `docs/superpowers/specs/2026-08-23-spirit-system-design.md`.

---

## 9. Cities, districts and civic surfaces

**Current source**
- `server/data/cityData.js`
- `server/data/cityLoopData.js`
- `server/services/cityService.js`
- `server/services/cityBoardService.js`
- `src/data/cityData.ts`
- `src/data/cityDistricts.ts`
- `src/data/cityHubData.ts`
- `src/data/cityBoardData.ts`
- `src/pages/City.tsx`
- `src/pages/CityBoard.tsx`
- city components

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- cities become persistent economic/social/world-state hubs;
- City Board remains official civic information;
- Tavern becomes unofficial rumours/contracts/social intelligence;
- civic projects/world events alter actual local conditions.

---

## 10. Travel, transport and route logistics

**Current source**
- `server/data/travelData.js`
- `server/data/transportData.js`
- `server/services/travelService.js`
- `server/services/worldMapService.js`
- `src/data/worldMapData.ts`
- `src/data/worldAtlasPositions.ts`
- `src/pages/Travel.tsx`
- `src/pages/WorldMap.tsx`

**Current storage**
- `player_state.travel_state`

**Current useful behavior**
- city/origin/destination/mode/status;
- departure/arrival timestamps;
- route type/duration;
- encounters;
- cargo and escort fields;
- education/reputation/route requirements in world data.

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- route/world-state engine;
- route scouting/intelligence reports;
- cargo, courier and escort contracts;
- dynamic risk from world events;
- transport ownership/upgrades only when the dedicated transport design warrants it.

---

## 11. World geography and expansion content

**Current source**
- `src/data/worldMapData.ts`
- `src/data/worldAtlasPositions.ts`
- `src/data/hellenicRegionalPack.ts`
- world-map images/reference assets

**Disposition:** **KEEP / canon review**

**V2 destination**
- core cities/regions preserved;
- old internal naming debris resolved;
- Hellenic Sphere held as preserved expansion material until launch/world scope is approved;
- Knowledge Graph/Atlas owns discoverability rather than exposing every node automatically.

---

## 12. Economy and city markets

**Current source**
- `server/data/cityEconomyData.js`
- `server/services/cityEconomyService.js`
- `server/repositories/cityMarketStockRepository.js`
- `src/pages/Market.tsx`
- `src/pages/BlackMarket.tsx`

**Current storage**
- `city_market_stock`
- currencies/inventory in player state

**Current useful behavior**
- city-specific goods/identity;
- legal/black market split;
- global stock concept;
- atomic stock decrement intent.

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- local economies and supply/demand;
- NPC requisitions as world-driven item sinks;
- price/volume history;
- CIEL economic summaries;
- shared transaction ledger for reliable economy history.

---

## 13. Player marketplace

**Current source**
- `server/services/marketplaceService.js`
- `server/repositories/marketplaceRepository.js`
- `src/pages/Market.tsx`

**Current storage**
- `marketplace_listings`

**Current useful engineering**
- relational listings;
- transaction-safe purchase path;
- row-locking pattern;
- seller/buyer identity and status history.

**Disposition:** **KEEP strongly / EXTEND**

**V2 destination**
- retain ordinary sell listings;
- add buy orders;
- transaction history;
- city-aware pricing;
- integrate with Contract/Crafting Order engine rather than duplicating transfer logic.

---

## 14. Crafting, recipes and salvage

**Current source**
- `server/data/recipeData.js`
- item data
- `server/services/itemAdvancedService.js`
- `src/pages/Crafting.tsx`
- `src/pages/SalvageYard.tsx`

**Current useful behavior/content**
- recipes;
- course prerequisites;
- academy/standing requirements;
- discovery-only recipes;
- recipe fragments;
- rarity/material concepts.

**Disposition:** **KEEP strongly / TRANSFORM**

**V2 destination**
- research-aware crafting;
- crafting orders;
- artifact restoration;
- material-property research;
- enhancement separated from ordinary recipe production where useful;
- maker/provenance record for significant items.

---

## 15. Adventures

**Current source**
- `server/data/adventureData.js`
- `server/services/adventureService.js`

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- preserve Local Contract, Field Expedition, Hidden Site Run, Elite Hunt, Convoy Defense, Relic Recovery concepts as seed content;
- align with unified event/discovery/research/contract primitives;
- eliminate duplicate reward/history paths.

---

## 16. Excursions and exploration

**Current source**
- `server/data/excursionData.js`
- `server/services/excursionService.js`
- `src/data/excursionMapData.ts`

**Current useful content**
- grid exploration;
- ruins/archives/battlefields/wrecks/shrines/survey sites;
- knowledge drops;
- training books;
- magic/skill fragments;
- recipes/fragments;
- rare item opportunities.

**Disposition:** **KEEP strongly / TRANSFORM into discovery backbone**

**V2 destination**
- archaeology/Antiquities sites;
- Spirit-search eligible contexts;
- historical leads;
- Bestiary observations/specimens;
- research evidence;
- hidden-site discovery.

---

## 17. Rare manuals, Grimoires and hidden knowledge

**Current source**
- `server/services/rareManualService.js`
- manual/discovery material in Codex/content data

**Disposition:** **TRANSFORM**

**V2 destination**
- physical rare Grimoires/Tomes;
- identification and deciphering;
- branch unlock after real-time deciphering;
- education/knowledge determines comprehension rather than simple level gates;
- lost/forbidden disciplines remain hidden until discovered.

---

## 18. Guilds and Consortiums

**Current source**
- `server/data/consortiumTypes.js`
- `server/data/consortiumLogistics.js`
- `server/services/organizationService.js`
- `server/services/adminOrganizationService.js`
- `server/services/consortiumLogisticsService.js`
- `server/services/consortiumPerkService.js`
- organization repositories/controllers/routes
- `src/pages/Guilds.tsx`
- `src/pages/Consortiums.tsx`

**Current storage**
- `organizations`
- `organization_roles`
- `organization_members`
- `organization_logs`
- organization treasury/metadata
- limited `consortium_state` player branch

**Disposition:** **KEEP identities/history / TRANSFORM systems**

**V2 destination**
- Guilds: combat/adventure/bounty/escort/community operations;
- Consortiums: trade/logistics/industry/economic operations;
- contribution projects;
- functional bases;
- shared archives/knowledge;
- custom permissions where safe;
- relational ownership/treasury/history retained.

---

## 19. Organization bases

**Current source**
- `server/data/organizationBaseData.js`
- `server/services/organizationBase*Service.js`
- organization base repository
- Property Office components/page

**Current storage**
- `organization_bases`
- `organization_base_events`
- `organization_base_payments`
- `organization_base_storage`
- `organization_base_auctions`

**Disposition:** **KEEP ownership/history / TRANSFORM gameplay**

**V2 destination**
- functional Guild/Consortium facilities;
- projects/contribution engine;
- workshops, libraries, map rooms, warehouses, caravan yards, infirmaries, etc.;
- existing lifecycle/payment history preserved.

---

## 20. Organization and personal one-shots / DMOS integration

**Current source**
- `server/data/nexisOneShotData.js`
- `server/data/organizationOneShotData.js`
- `server/services/nexisOneShotService.js`
- `server/services/organizationOneShotService.js`
- completion/grant/entitlement repositories
- `src/pages/OneShots.tsx`

**Current storage**
- `one_shot_completions`
- `admin_one_shot_token_grants`
- `player_entitlement_consumptions`
- token counters/history in legacy player state

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- preserve deterministic server-validated rewards and completion uniqueness;
- decide later whether DMOS one-shots remain separate from Adventures or become a shared narrative adventure layer;
- retain existing ledgers as historical truth.

---

## 21. PvP, duels, Arena and notoriety

**Current source**
- `server/data/pvpData.js`
- `server/services/pvpService.js`
- `server/services/duelService.js`
- `server/services/arenaCombatService.js`
- `src/pages/Arena.tsx`
- `src/pages/ArenaRuntime.tsx`

**Current storage**
- PvP/duel state in player snapshot
- `arena_state`

**Current useful rules**
- protected-by-default posture;
- same-city assumptions;
- valid bounty target rules;
- anti-farming concepts;
- travel danger/notoriety states.

**Disposition:** **KEEP fairness lessons / TRANSFORM system**

**V2 destination**
- explicit PvP eligibility;
- affinity-aware Spirit rules;
- investigation/bounty/capture linkage;
- no full-loot PvP;
- offline/griefing constraints designed before player capture is enabled.

---

## 22. Bounty and capture

**Current source**
- bounty modes/concepts in `pvpData.js`
- City Board content
- placeholder `Targets.tsx`

**Disposition:** **TRANSFORM / EXPAND**

**V2 destination**
- NPC bounties first;
- investigate → track → locate → engage → kill/capture → restrain → transport → deliver;
- capture harder/more rewarding;
- player bounties only after abuse/offline/imprisonment design is approved;
- Target view becomes intelligence dossier, not merely a list.

---

## 23. Civic Jobs

**Current source**
- `server/data/civicJobsData.js`
- `server/services/civicJobsService.js`
- `src/data/civicJobsData.ts`
- `src/pages/CivicJobsV2.tsx`
- `src/pages/Jobs.tsx`

**Current storage**
- `current_job`
- `jobs_state`
- `civic_state`

**Current behavior**
- roughly one shift per 24 hours;
- ranks;
- salary;
- Job Points;
- promotion costs;
- capstones.

**Disposition:** **TRANSFORM**

**V2 destination**
- real profession responsibilities and world tasks;
- Watch patrol/investigation;
- University research/translation/teaching;
- Apothecary requisitions/outbreak work;
- Tribunal warrants/legal work;
- ranks unlock responsibility/access rather than mainly direct stat purchases.

---

## 24. Housing/property

**Current source**
- `src/data/propertyData.ts`
- `src/pages/Housing.tsx`
- property office/base components

**Current useful content**
- Shack/Cottage/Townhouse/Merchant House/Manor progression;
- study/storage/workshop/garden/staff/stables/training/library/infirmary concepts.

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- functional rooms:
  - Study: books/research/deciphering;
  - Workshop: advanced crafting/restoration;
  - Laboratory: alchemy/specimens;
  - Library: archive/reference;
  - Trophy Hall: artifacts/Feats;
  - Guest Room: relationship/visitor scenes;
- percentage bonuses retained only where they make sense after functional use is defined.

---

## 25. Codex, Archives, Wiki and world knowledge

**Current source**
- `src/data/codexData.ts`
- `src/pages/Codex.tsx`
- `src/pages/Archives.tsx`
- `src/data/wikiData.ts`
- `src/pages/Wiki.tsx`
- `server/services/playerGuideService.js`

**Current useful structure**
- Atlas
- Archives
- Discoveries
- Records
- Manuals
- Bestiary

**Disposition:** **KEEP structure / TRANSFORM engine**

**V2 destination**
- character-specific Knowledge/Rumour Graph;
- observation/hypothesis/accepted scholarship distinctions;
- progressive Bestiary knowledge;
- hidden/contradictory knowledge;
- CIEL contextual synthesis;
- objective canon never automatically leaked to players.

---

## 26. Bestiary

**Current source**
- Codex data + combat NPC/enemy content

**Disposition:** **TRANSFORM heavily**

**V2 destination**
- Unknown → Encountered → Studied → Researched → Mastered;
- progress through observation, combat, capture, specimens, books, NPC expertise and research;
- reveal habitat, behavior, resistances, materials and capture advice progressively.

---

## 27. Chronicle, Records, Achievements, Legacy and Titles

**Current source**
- `server/data/chronicleData.js`
- `server/data/legacyAchievementsData.js`
- `server/data/titlesData.js`
- `server/services/chronicleService.js`
- `server/services/achievementService.js`
- `server/services/titleService.js`
- `server/services/playerRecordsService.js`
- `server/services/playerRecordsApiService.js`
- `src/pages/Achievements.tsx`
- `src/pages/Records.tsx`
- `src/pages/Titles.tsx`

**Current storage**
- `legacy_state`
- title/record fields in player snapshot

**Disposition:** **TRANSFORM into distinct concepts**

**V2 destination**
- Event Ledger = objective game history;
- Chronicle = universal player biography/history;
- Records = detailed private/account history;
- Achievements = accomplishments;
- Feats of Strength = retired/rare/non-repeatable historical accomplishments, usually no power;
- Titles = earned display/prestige identity;
- Legacy = carefully bounded progression/reward layer, not a catch-all percentage shop.

---

## 28. Life Paths

**Current source**
- `server/data/lifePathsData.js`
- `src/data/lifePathsData.ts`
- `src/pages/LifePaths.tsx`
- player snapshot historical state

**Disposition:** **RETIRE active system / ARCHIVE history**

**V2 destination**
- existing historical Life Path participation can become unobtainable Feats of Strength;
- no ongoing class/path selection or mechanical power from retired choice.

---

## 29. World state, city threats and event scaffolds

**Current source**
- `server/data/liveWorldData.js`
- `server/data/cityEventData.js`
- `server/data/worldProgressionData.js`
- `server/services/liveWorldService.js`
- `server/services/cityEventService.js`
- `server/services/worldProgressionService.js`
- `server/repositories/cityEventRepository.js`

**Current storage**
- `city_events`
- world-event/profile/quality state in player snapshot

**Disposition:** **KEEP content / CONSOLIDATE**

**V2 destination**
- one World State/Event Engine;
- branching phases and consequences;
- contribution tracking;
- city demand, travel risk, News, contracts and bosses driven from the same authoritative state;
- dead/decorative duplicate event scaffolds retired after useful content extraction.

---

## 30. News

**Current source**
- `src/data/newsData.ts`
- `src/pages/News.tsx`

**Disposition:** **TRANSFORM**

**V2 destination**
- authored editorial content can remain as seed/archive;
- actual News generated from public Event Ledger/world-state events;
- major discoveries, crises, battles, supply disruptions, civic projects and public achievements become visible to the world.

---

## 31. Social: Contacts, Rivals, Targets

**Current source**
- `src/pages/Contacts.tsx` — explicit placeholder
- `src/pages/Rivals.tsx` — explicit under-construction page
- `src/pages/Targets.tsx` — explicit placeholder
- search/profile/PvP services provide partial foundations

**Disposition:** **BUILD from preserved shells, do not treat current UI as a system**

**V2 destination**
- one Relationship/Intelligence domain with different views:
  - Contacts: relationship, notes, profession/org info, Favours, tags;
  - Rivals: PvP history/bounties/captures/public encounters;
  - Targets: active contract/bounty/investigation/intelligence state.

---

## 32. Tavern

**Current source**
- `src/pages/Tavern.tsx`

The current page explicitly reserves Tavern for rumours, contract leads and local notices.

**Disposition:** **BUILD**

**V2 destination**
- unofficial local information hub;
- rumours;
- contract leads;
- NPC gossip;
- caravan guards;
- recruitment;
- shady work;
- historical/Spirit/archaeology leads;
- transient NPC encounters.

---

## 33. Bank

**Current source**
- `src/pages/Bank.tsx` placeholder

**Disposition:** **DEFER / REDESIGN**

**V2 destination**
- no blind import of a generic Torn bank;
- define banking only when economy architecture requires deposits/reserves/interest/organization finance;
- Guild/Consortium treasury remains a separate verified finance layer.

---

## 34. CIEL

**Current source**
- `src/data/cielData.ts`
- `src/data/cielPageCopy.ts`
- `src/data/cielTutorialData.ts`
- CIEL components/styles
- player guide/service content

**Disposition:** **KEEP identity/voice selectively / TRANSFORM role**

**Canonical constraint**
- CIEL is a separated sliver of Hennet's mind that developed independent personhood over immense time.

**V2 destination**
- contextual world/knowledge synthesis;
- route/economy/research/discovery interpretation;
- warnings and cross-system pattern recognition;
- never generic software/tutorial narration;
- never universal spoiler/omniscience leak;
- Hennet-private familiarity only in authorized private context.

---

## 35. Search and player discovery

**Current source**
- `server/services/searchService.js`
- `server/services/advancedSearchService.js`
- `src/pages/AdvancedSearch.tsx`

**Disposition:** **KEEP / TRANSFORM**

**V2 destination**
- player/org/content search as appropriate;
- privacy and Hennet public-projection rules enforced at server projection layer;
- no endpoint may accidentally bypass profile visibility policy.

---

## 36. Operational/deployment shape

**Current live**
- Node/Express Nexis API on port 3001;
- systemd unit `nexis-waitlist.service` despite broader modern API role;
- nginx serves production frontend and proxies API;
- PostgreSQL 16 local DB;
- backend env under `/srv/nexis/shared/config/backend.env`;
- uploads under `/srv/nexis/shared/uploads`.

**Disposition:** **ARCHIVE as reference / REBUILD deployment**

**V2 destination**
- modular-monolith application architecture on the new Voidsmith server;
- exact runtime/container/Caddy/DB layout defined in application-foundation spec;
- secrets outside source control;
- migration and rollback rehearsed before cutover.

---

## 37. Cross-cutting v2 primitives created once and reused

These are the architectural destinations for multiple existing systems:

1. **Game Event Ledger** — Chronicle, News, Records, achievements, provenance, admin/world history.
2. **Knowledge Graph** — Codex, rumours, Bestiary, archaeology, investigation, Spirits, Grimoires.
3. **Research Engine** — magic, archaeology, crafting, restoration, Bestiary, historical research.
4. **Contract/Escrow Engine** — crafting orders, procurement, courier, escort, bounty, capture, research commissions.
5. **Renown/Favour Engine** — institutions, cities, factions, social leverage.
6. **World State/Event Engine** — event chains, crises, routes, city demand, bosses, News.
7. **Contribution Engine** — Guild/Consortium/city projects.
8. **Item Provenance Engine** — artifacts, masterpieces, important unique equipment.

The v2 design should prefer these shared domain primitives over feature-specific one-off state arrays.