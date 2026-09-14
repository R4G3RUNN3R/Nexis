# Changelog

## 2026-09-14

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
