export const EXCURSION_GRID = { columns: 16, rows: 10 } as const;

export type ExcursionMapLocation = {
  id: string;
  name: string;
  type: string;
  region: string;
  risk: "Low" | "Moderate" | "High" | "Extreme";
  box: { x: number; y: number };
  rewardFocus: string[];
};

// box coordinates here must stay in sync with server/data/excursionData.js's
// EXCURSION_LOCATIONS - this is the pre-load fallback WorldMap.tsx renders before the
// live board (which carries its own hand-tuned xPercent/yPercent) arrives, and a
// mismatch here shows a marker jump from the wrong spot to the right one once real
// data loads.
export const excursionMapLocations: ExcursionMapLocation[] = [
  { id: "central_ruined_watchtower_grid", name: "Old Watchtower Steps", type: "Ruined Watchtower", region: "Central Crown", risk: "Low", box: { x: 6, y: 4 }, rewardFocus: ["materials", "epic recipe", "training book"] },
  { id: "central_battlefield_grid", name: "Bannerfall Remnant", type: "Battlefield", region: "Central Crown", risk: "Moderate", box: { x: 8, y: 6 }, rewardFocus: ["weapon pieces", "skill fragments", "training book"] },
  { id: "west_tide_cache_grid", name: "Tide-Locked Cache", type: "Smuggler Cache", region: "Western Coast", risk: "Moderate", box: { x: 2, y: 3 }, rewardFocus: ["materials", "legendary recipe", "rare pieces"] },
  { id: "west_wreck_reef_grid", name: "Blackwake Wreck Reef", type: "Wreck", region: "Western Coast", risk: "High", box: { x: 3, y: 5 }, rewardFocus: ["rare item", "corsair pieces", "covert fragments"] },
  { id: "north_shrine_grove_grid", name: "Moonroot Shrine Ring", type: "Shrine Grove", region: "Northern Bough", risk: "Moderate", box: { x: 7, y: 2 }, rewardFocus: ["magic fragments", "epic recipe", "healing materials"] },
  { id: "north_survey_spire_grid", name: "Argent Survey Spire", type: "Arcane Survey", region: "Northern Bough", risk: "High", box: { x: 8, y: 1 }, rewardFocus: ["legendary recipe", "spell text", "rare focus pieces"] },
  { id: "east_forge_wreck_grid", name: "Furnace Road Wreck", type: "Forge Wreck", region: "Eastern Forges", risk: "Moderate", box: { x: 11, y: 4 }, rewardFocus: ["materials", "epic recipe", "heavy armor pieces"] },
  { id: "east_ash_causeway_grid", name: "Ash Engine Causeway", type: "Machine Route", region: "Eastern Forges", risk: "High", box: { x: 12, y: 5 }, rewardFocus: ["legendary recipe", "rare frame pieces", "training book"] },
  { id: "south_archive_sink_grid", name: "Sunken Petition Archive", type: "Collapsed Archive", region: "Southern Court", risk: "Moderate", box: { x: 9, y: 6 }, rewardFocus: ["knowledge", "epic recipe", "Absolute fragment"] },
  { id: "south_sealed_outpost_grid", name: "Oathbound Outpost", type: "Sealed Court Outpost", region: "Southern Court", risk: "High", box: { x: 10, y: 4 }, rewardFocus: ["legendary recipe", "court pieces", "rare item"] },
  { id: "southern_black_marsh_grid", name: "Black Marsh Causeway", type: "Hidden Path", region: "South Marsh", risk: "Extreme", box: { x: 8, y: 8 }, rewardFocus: ["mythic recipe", "Absolute story", "rare item"] },
  { id: "red_sand_obelisk_grid", name: "Red Sand Obelisk", type: "Old Battlefield", region: "Red Wastes", risk: "High", box: { x: 5, y: 6 }, rewardFocus: ["legendary recipe", "training book", "materials"] },
  { id: "eastern_blue_isles_grid", name: "Blue Isle Signal Cairn", type: "Signal Cairn", region: "Blue Isles", risk: "Moderate", box: { x: 14, y: 7 }, rewardFocus: ["epic recipe", "navigation lens", "knowledge"] },
  { id: "north_glacier_gate_grid", name: "Glacier Gate Cairns", type: "Hidden Pass", region: "Northern Gate", risk: "High", box: { x: 10, y: 1 }, rewardFocus: ["legendary recipe", "cold iron", "rare pieces"] },
  { id: "western_crow_lanterns_grid", name: "Crow Lantern Strand", type: "Abandoned Camp", region: "Western Coast", risk: "Low", box: { x: 1, y: 4 }, rewardFocus: ["epic recipe", "smoke charges", "covert fragments"] },
  { id: "central_archive_door_grid", name: "Unfiled Archive Door", type: "Archive Door", region: "Central Crown", risk: "Moderate", box: { x: 7, y: 4 }, rewardFocus: ["epic recipe", "knowledge", "Absolute fragment"] },
];

export function getExcursionMarkerStyle(location: ExcursionMapLocation) {
  return {
    left: `${((location.box.x + 0.5) / EXCURSION_GRID.columns) * 100}%`,
    top: `${((location.box.y + 0.5) / EXCURSION_GRID.rows) * 100}%`,
  };
}