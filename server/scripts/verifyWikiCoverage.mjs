import assert from "node:assert/strict";
import fs from "node:fs";

const wikiSource = fs.readFileSync("src/data/wikiData.ts", "utf8");
const routerSource = fs.readFileSync("src/router/index.tsx", "utf8");

const sectionIds = [...wikiSource.matchAll(/id:\s*"([^"]+)",\s*label:/g)].map((match) => match[1]);
const entryIds = [...wikiSource.matchAll(/id:\s*"([^"]+)",\s*category:/g)].map((match) => match[1]);
const duplicateEntries = entryIds.filter((id, index) => entryIds.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateEntries)], [], "Wiki entry IDs must be unique");
assert.equal(sectionIds.length >= 12, true, "Wiki should cover at least twelve major sections");
assert.equal(entryIds.length >= 65, true, "Wiki should contain a broad complete manual, not a thin stub");

const requiredEntryIds = [
  "page-ownership", "home-command-center", "profile-avatar", "resources", "level-life",
  "education", "academy", "skills", "achievements-legacy", "hard-gates",
  "city", "civic-jobs", "city-board", "codex", "wiki", "travel", "world-map",
  "excursions", "excursion-rewards", "hidden-sites", "inventory", "equipment",
  "armor-sets", "crafting-discovery", "salvage", "market", "player-market",
  "black-market", "housing", "property-office", "combat-basics", "combat-energy",
  "combat-logs", "arena", "duels", "adventures", "pvp-foundation", "guilds",
  "consortiums", "assistance-loops", "organization-one-shots", "nexis-one-shots",
  "patron-tokens", "campaign-records", "admin-dossier", "privacy", "server-authority",
  "inactive-systems", "not-found", "live-ops"
];
for (const id of requiredEntryIds) {
  assert.equal(entryIds.includes(id), true, `Missing required Wiki entry: ${id}`);
}

const forbiddenPatterns = [/TBD/i, /TODO/i, /not wired/i, /placeholder/i, /The PvP scaffold/i, /pvp-scaffold/i, /status:\s*"scaffolded"/i];
for (const pattern of forbiddenPatterns) {
  assert.equal(pattern.test(wikiSource), false, `Forbidden Wiki wording found: ${pattern}`);
}

const routePaths = new Set([...routerSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]));
const wikiRoutes = [...wikiSource.matchAll(/to:\s*"([^"]+)"/g)].map((match) => match[1]);
const brokenRoutes = [];
for (const rawRoute of wikiRoutes) {
  const route = rawRoute.split("#")[0].split("?")[0];
  if (!route.startsWith("/")) brokenRoutes.push(rawRoute);
  else if (routePaths.has(route)) continue;
  else if ([...routePaths].some((path) => path.includes(":") && route.startsWith(path.split("/:")[0]))) continue;
  else brokenRoutes.push(rawRoute);
}
assert.deepEqual(brokenRoutes, [], "Wiki route chips must point at registered routes");

console.log(JSON.stringify({ ok: true, sections: sectionIds.length, entries: entryIds.length, routes: wikiRoutes.length }, null, 2));
