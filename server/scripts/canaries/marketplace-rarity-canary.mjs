// Regression canary: the player marketplace must recognize every rarity
// used by the item catalogue in both server rarity sorting and UI filters.
//
//   node server/scripts/canaries/marketplace-rarity-canary.mjs
//
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getItemDefinitions } from "../../data/itemData.js";

const rarities = Array.from(new Set(getItemDefinitions().map((item) => String(item.rarity ?? "common").toLowerCase()))).sort();
const serviceSource = await readFile(new URL("../../services/marketplaceService.js", import.meta.url), "utf8");
const marketPageSource = await readFile(new URL("../../../src/pages/Market.tsx", import.meta.url), "utf8");

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

for (const rarity of rarities) {
  check(`server rarity sort recognizes ${rarity}`, new RegExp(`${rarity}\s*:`).test(serviceSource));
  check(`marketplace filter exposes ${rarity}`, marketPageSource.includes(`value="${rarity}"`));
}

check("catalogue contains epic rarity", rarities.includes("epic"));
check("catalogue contains mythic rarity", rarities.includes("mythic"));
console.log(`\nAll ${checks} marketplace rarity checks passed for: ${rarities.join(", ")}.`);
