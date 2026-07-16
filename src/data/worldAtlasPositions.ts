import { worldCities } from "./worldMapData";

/**
 * Approximate map placements for atlas overlays on the world map image.
 *
 * Hidden sites have no exact canonical coordinates - they are "near a city /
 * along a route" fiction - so these are hand-placed approximate positions in
 * the same xPercent/yPercent space the city pins use. Sites the player has
 * not discovered or heard rumors about are never rendered at all, so these
 * positions only ever surface once the server-side atlas exposes the site.
 */
export const HIDDEN_SITE_POSITIONS: Record<string, { xPercent: number; yPercent: number }> = {
  central_ruined_watchtower: { xPercent: 41.2, yPercent: 44.6 },
  central_battlefield_remnant: { xPercent: 53.6, yPercent: 42.2 },
  north_shrine_grove: { xPercent: 47.6, yPercent: 12.6 },
  north_arcane_survey_point: { xPercent: 39.6, yPercent: 13.8 },
  west_smuggler_cache: { xPercent: 10.6, yPercent: 30.4 },
  west_abandoned_caravan_depot: { xPercent: 34.2, yPercent: 43.6 },
  east_forge_wreck: { xPercent: 56.8, yPercent: 40.0 },
  south_collapsed_archive: { xPercent: 54.8, yPercent: 51.2 },
  south_sealed_court_outpost: { xPercent: 47.6, yPercent: 54.4 },
};

/**
 * Fallback for hidden sites the server may add later without a hand-placed
 * position: drop the marker slightly south-east of the site's first city.
 */
export function getHiddenSitePosition(siteId: string, cityIds: string[]): { xPercent: number; yPercent: number } | null {
  const placed = HIDDEN_SITE_POSITIONS[siteId];
  if (placed) return placed;
  const anchorCity = worldCities.find((city) => cityIds.includes(city.id));
  if (!anchorCity) return null;
  return { xPercent: anchorCity.xPercent + 3.2, yPercent: anchorCity.yPercent + 4.6 };
}

/**
 * Label anchors for the atlas regions the world-map API reports
 * (server/services/worldMapService.js REGIONS). Placed to sit inside each
 * region's map area without covering the city pins themselves.
 */
export const ATLAS_REGION_ANCHORS: Record<string, { xPercent: number; yPercent: number }> = {
  central_crown: { xPercent: 41.4, yPercent: 57.4 },
  western_coast: { xPercent: 13.0, yPercent: 16.6 },
  northern_bough: { xPercent: 35.6, yPercent: 6.2 },
  eastern_forges: { xPercent: 66.4, yPercent: 29.6 },
  southern_court: { xPercent: 56.6, yPercent: 56.4 },
  hellenic_sphere: { xPercent: 67.2, yPercent: 68.8 },
};

/**
 * Frontier zones from worldMapData.worldRegions that already appear by name
 * in the public atlas (charted rumor lanes, locked entries) and can therefore
 * be marked on the map without spoiling anything undiscovered. The
 * hellenic_sphere is excluded here because its state comes from the live
 * atlas API instead of static data.
 */
export const FRONTIER_REGION_IDS = [
  "red_sand_wastes",
  "barbarian_frontier_northeast",
  "myrine_archipelago",
  "ruined_lands_south",
  "pirate_isles_southwest",
  "dune_kingdom_belt",
  "oasis_city_chain",
] as const;
