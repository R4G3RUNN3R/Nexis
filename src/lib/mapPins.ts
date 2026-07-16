import type { CSSProperties } from "react";
import type { WorldCity, WorldCityId } from "../data/worldMapData";

/**
 * Shared pin-placement helpers for every surface that renders the world map
 * image (Travel route selection, World Map atlas). Coordinates come from
 * worldMapData xPercent/yPercent; label offsets keep the tightly packed
 * heartland pins (Nexis / Highcourt) from overlapping each other.
 */

export const PIN_LABEL_OFFSETS: Partial<Record<WorldCityId, { x: string; y: string }>> = {
  nexis: { x: "-112%", y: "8%" },
  south: { x: "12%", y: "-132%" },
};

export type MapPoint = {
  id: string;
  xPercent: number;
  yPercent: number;
};

export function getPinStyle(point: MapPoint): CSSProperties {
  const offset = PIN_LABEL_OFFSETS[point.id as WorldCityId];
  return {
    left: `${point.xPercent}%`,
    top: `${point.yPercent}%`,
    "--pin-label-x": offset?.x ?? "-50%",
    "--pin-label-y": offset?.y ?? "0%",
  } as CSSProperties;
}

export function getPinClass(region: WorldCity["region"]) {
  switch (region) {
    case "north":
      return "travel-pin travel-pin--north";
    case "east":
      return "travel-pin travel-pin--east";
    case "west":
      return "travel-pin travel-pin--west";
    case "south":
      return "travel-pin travel-pin--south";
    default:
      return "travel-pin travel-pin--center";
  }
}
