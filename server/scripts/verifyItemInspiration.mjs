import { getItemAcquisitionPaths, getItemDefinition, getItemDefinitions } from "../data/itemData.js";

const requiredItems = [
  "sutured_field_roll",
  "flash_powder",
  "bonded_spice_crate",
  "manual_clean_cuts",
  "monster_trackers_slate",
  "appraiser_lens",
  "moon_resin",
];

for (const itemId of requiredItems) {
  const item = getItemDefinition(itemId);
  if (!item || item.id !== itemId) {
    throw new Error(`Missing inspiration item: ${itemId}`);
  }
}

const manualPaths = getItemAcquisitionPaths(getItemDefinition("manual_clean_cuts")).map((entry) => entry.category);
if (!manualPaths.includes("Manual / Book")) {
  throw new Error("Manual acquisition path missing for rare manuals.");
}

const toolPaths = getItemAcquisitionPaths(getItemDefinition("appraiser_lens")).map((entry) => entry.category);
if (!toolPaths.includes("Tool")) {
  throw new Error("Tool acquisition path missing for utility tools.");
}

console.log(JSON.stringify({
  ok: true,
  catalogCount: getItemDefinitions().length,
  checkedItems: requiredItems.length,
  manualPaths,
  toolPaths,
}));
