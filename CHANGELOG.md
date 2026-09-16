# Changelog

## 2026-09-16

### Voidsmith portfolio attribution
- added a visible crawlable `Powered by Voidsmith Industries` link to the shared public-page footer
- the attribution now covers the Nexis landing page and public News, Rules, Staff, Contact and Credits pages through the shared shell
- added a branding regression guard so the Voidsmith attribution cannot silently disappear or become `nofollow`
- no gameplay, authentication, API, database or player-state behaviour changed

## 2026-09-14

### Search discovery follow-up
- added the Voidsmith Industries publisher logo to the homepage structured data so the live VideoGame schema validates cleanly
- redirected the duplicate `/index.html` URL to the canonical `/` homepage
- connected the existing `nexis.nexus` Search Console property to the portfolio SEO tooling and verified the homepage is submitted and indexed
- corrected the live-operations runbook so future frontend deploys preserve the separate public indexable shell and private noindex application shell
- no gameplay, state, authentication, API or database behaviour changed

### Search discovery baseline
- added descriptive homepage title and meta description for Nexis
- added canonical, robots, Open Graph, Twitter and VideoGame structured metadata
- added real `robots.txt` and `sitemap.xml` files so crawler requests no longer need to fall through to the SPA shell
- limited the sitemap to the public root while authenticated/game routes remain outside the deliberate SEO surface
- no gameplay, state, authentication or routing behaviour changed

### Search discovery hardening
- added a substantial semantic public fallback to the homepage so meaningful Nexis content is available before JavaScript executes
- added a separate `app.html` shell with explicit `noindex, nofollow, noarchive` policy for application and deep-route delivery
- configured Vite to build both HTML shells from the same React entrypoint and verified they share the same compiled application bundle
- added a local static favicon and expanded the VideoGame structured data without widening the indexable surface
- made `vite.config.ts` the sole Vite configuration authority and prevented TypeScript from regenerating stale `vite.config.js` / `vite.config.d.ts` artifacts
- added `scripts/seo-regression.mjs` to lock the public/app-shell, crawler-policy and build-configuration contract
- no gameplay, state, authentication, API or database behaviour changed

### Nexis master-brand rollout (V1)
- added the approved Nexis master mark to the live-era V1 shell without changing gameplay or navigation structure
- kept the in-game sidebar and public header mark to 32px, with a 44px mobile authentication mark and a restrained 72px desktop authentication mark
- replaced the generic letter favicon with a lightweight derivative of the approved Nexis master mark
- added branding regression coverage so the assets and UI placements cannot silently grow into oversized artwork
- deliberately did not backport V2 subsystem sigils into the V1 interface
- no gameplay, state, authentication, API or database behaviour changed

## 2026-04-19

### Ashen Crown page-enrichment and shell pass
- standardized major player-facing pages around page flavor text plus a dedicated CIEL guidance panel
- upgraded Home, City, Travel, Academies, Education, Adventure, Inventory, Market, Guilds, Consortiums, Estate Office, Black Market, Hospital, Bank, Contacts, Skills, Achievements, and Profile to use the same voice and structure
- introduced shared CIEL page copy, city copy, empty-state microcopy, and rotating quote data for broader reuse
- polished the shell by wiring public top-bar navigation, aligning sidebar branding with Ashen Crown as the world brand and Nexis as the shard/capital context, and adding a sidebar CIEL quote strip
- added a route-transition CIEL quote overlay so navigation now has a brief in-game loading feel instead of snapping coldly between pages
- removed an orphaned `src/pages/Contacts.tsx` stub after routing consolidated on the public `Contact.tsx` page
- player impact: the game now reads more like a coherent browser RPG instead of a collection of disconnected placeholder panels
- risk level: low to moderate, because the pass is mostly UI and copy integration but touches shared shell components
- follow-up: run a clean GitHub-backed build verification, resolve any remaining stale metadata such as package-lock naming, and deploy only from the AshenCrown repository