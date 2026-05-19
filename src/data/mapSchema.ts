import { getCityDistricts } from "./cityDistricts";
import {
  worldCities,
  worldRegions,
  worldRoutes,
  worldRumorLinks,
  type WorldCityId,
  type WorldRegionStatus,
} from "./worldMapData";

export type MapNodeVisibility = "visible" | "hidden" | "locked";
export type MapNodeKind =
  | "city"
  | "district"
  | "service"
  | "academy"
  | "guild_site"
  | "consortium_site"
  | "strategic_site"
  | "hidden_site";

export type MapNode = {
  id: string;
  kind: MapNodeKind;
  label: string;
  summary: string;
  route?: string;
  icon?: string;
  visibility: MapNodeVisibility;
  parentId?: string;
  metadata?: Record<string, unknown>;
};

export type MapViewDefinition = {
  id: string;
  label: string;
  kind: "world" | "city";
  anchorCityId?: WorldCityId;
  summary: string;
  nodes: MapNode[];
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    requirements?: Array<{ kind: string; key: string; label: string }>;
    discovery?: { state: string; unlockHint: string };
  }>;
};

function mapVisibilityFromRegionStatus(status: WorldRegionStatus): MapNodeVisibility {
  if (status === "rumored") return "hidden";
  if (status === "charted_locked") return "locked";
  return "visible";
}

function publicRegionStatusLabel(status: WorldRegionStatus) {
  if (status === "rumored") return "rumored";
  if (status === "charted_locked") return "charted, locked";
  if (status === "fully_wired") return "open";
  if (status === "preserved_core") return "core route";
  return "known";
}

function buildCityMap(cityId: WorldCityId): MapViewDefinition {
  const city = worldCities.find((entry) => entry.id === cityId) ?? worldCities[0];
  const districts = getCityDistricts(city);
  const districtNodes: MapNode[] = districts.map((district) => ({
    id: `${city.id}:${district.id}`,
    kind: "district",
    label: district.name,
    summary: district.summary,
    visibility: "visible",
    parentId: city.id,
    metadata: {
      image: district.image ?? null,
    },
  }));

  const serviceNodes: MapNode[] = districts.flatMap((district) =>
    district.destinations.map((destination) => ({
      id: `${city.id}:${district.id}:${destination.id}`,
      kind:
        destination.id.includes("guild")
          ? "guild_site"
          : destination.id.includes("consortium")
            ? "consortium_site"
            : destination.id.includes("academy")
              ? "academy"
              : "service",
      label: destination.name,
      summary: destination.description,
      route: destination.route,
      icon: destination.icon,
      visibility: destination.locked ? "locked" : "visible",
      parentId: `${city.id}:${district.id}`,
      metadata: {
        lockReason: destination.lockReason ?? null,
      },
    })),
  );

  const hiddenNodes: MapNode[] = [
    {
      id: `${city.id}:hidden:watch`,
      kind: "hidden_site",
      label: "Unmarked Site",
      summary: "Unmarked ruins, sealed archives, or witness sites not yet charted.",
      visibility: "hidden",
      parentId: city.id,
      metadata: {
        ownerGuildId: null,
        influence: 0,
        siteType: "rumored_hidden_node",
      },
    },
  ];

  return {
    id: city.id === "nexis" ? "nexis-city" : `${city.id}-academy-city`,
    label: city.name,
    kind: "city",
    anchorCityId: city.id,
    summary: city.summary,
    nodes: [
      {
        id: city.id,
        kind: "city",
        label: city.name,
        summary: city.summary,
        visibility: "visible",
        metadata: {
          academy: city.academy ?? null,
          region: city.region,
          continuity: city.continuity,
          anchorRole: city.anchorRole,
        },
      },
      ...districtNodes,
      ...serviceNodes,
      ...hiddenNodes,
    ],
    edges: [
      ...districtNodes.map((node) => ({ from: city.id, to: node.id })),
      ...serviceNodes.map((node) => ({ from: String(node.parentId), to: node.id })),
    ],
  };
}

export const mapViews: MapViewDefinition[] = [
  {
    id: "world",
    label: "World Map",
    kind: "world",
    summary:
      "Expanded macro geography with preserved Nexis core anchors, active city travel routes, and rumored regional lanes for later discovery.",
    nodes: [
      ...worldCities.map((city) => ({
        id: city.id,
        kind: "city" as const,
        label: city.name,
        summary: city.summary,
        visibility: "visible" as const,
        metadata: {
          subtitle: city.subtitle,
          academy: city.academy ?? null,
          region: city.region,
          xPercent: city.xPercent,
          yPercent: city.yPercent,
          continuity: city.continuity,
          anchorRole: city.anchorRole,
        },
      })),
      ...worldRegions.map((region) => ({
        id: region.id,
        kind: "strategic_site" as const,
        label: region.name,
        summary: region.summary,
        visibility: mapVisibilityFromRegionStatus(region.status),
        metadata: {
          regionKind: region.kind,
          regionStatus: region.status,
          xPercent: region.xPercent,
          yPercent: region.yPercent,
          travelModes: region.travelModes,
          factionIdentity: region.factionIdentity,
        },
      })),
      {
        id: "world:hidden:keep-network",
        kind: "hidden_site",
        label: "Unrevealed Stronghold Network",
        summary: "Reserved for keeps, strongholds, and concealed claim sites.",
        visibility: "hidden",
        metadata: {
          ownerGuildId: null,
          influence: 0,
          siteType: "rumored_stronghold",
        },
      },
    ],
    edges: [
      ...worldRoutes.map((route) => ({
        from: route.from,
        to: route.to,
        label: route.travelLabel,
      })),
      ...worldRumorLinks.map((link) => ({
        from: link.fromNodeId,
        to: link.toNodeId,
        label: `${link.label} (${publicRegionStatusLabel(link.status)})`,
        requirements: link.requirements,
        discovery: link.discovery,
      })),
    ],
  },
  buildCityMap("nexis"),
  buildCityMap("north"),
  buildCityMap("west"),
  buildCityMap("east"),
  buildCityMap("south"),
];

export function getMapView(mapId: string) {
  return mapViews.find((view) => view.id === mapId) ?? null;
}

export function getCityMap(cityId: WorldCityId) {
  return mapViews.find((view) => view.anchorCityId === cityId) ?? null;
}
