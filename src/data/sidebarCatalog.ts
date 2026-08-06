// Canonical catalog for the three player-customizable sidebar sections
// (AppShell.tsx's Character/Realm/Orders groups). Single source of truth for
// both AppShell.tsx (renders the sidebar) and Settings.tsx (Navigation
// settings customization UI) - do not duplicate these arrays elsewhere.
//
// A link's "key" is its route with the leading slash stripped (e.g.
// "/one-shots" -> "one-shots") - the same convention AppShell.tsx's
// iconForRoute() already uses to look up NAV_ICONS, and the exact set of
// strings server/services/stateService.js's SIDEBAR_LINK_KEYS validates
// against (server and frontend can't share a module across the Node/Vite
// boundary, so that allowlist is intentionally duplicated there - keep both
// in sync if this catalog changes).

export type SidebarLinkEntry = { label: string; route: string };
export type SidebarSectionId = "character" | "realm" | "orders";

export function sidebarLinkKey(route: string): string {
  return route.replace(/^\//, "");
}

export const CHARACTER_LINKS: SidebarLinkEntry[] = [
  { label: "Life Paths", route: "/life-paths" },
  { label: "Inventory", route: "/inventory" },
  { label: "Crafting", route: "/crafting" },
  { label: "Education", route: "/education" },
  { label: "Skills", route: "/skills" },
  { label: "One-Shots", route: "/one-shots" },
  { label: "Housing", route: "/housing" },
];

export const REALM_LINKS: SidebarLinkEntry[] = [
  { label: "Arena", route: "/arena" },
  { label: "Salvage Yard", route: "/salvage-yard" },
  { label: "Hospital", route: "/hospital" },
];

export const ORDERS_LINKS: SidebarLinkEntry[] = [
  { label: "Civic Jobs", route: "/civic-jobs" },
  { label: "Adventure", route: "/adventure" },
  { label: "City Board", route: "/city-board" },
];

export const SIDEBAR_SECTIONS: Record<SidebarSectionId, SidebarLinkEntry[]> = {
  character: CHARACTER_LINKS,
  realm: REALM_LINKS,
  orders: ORDERS_LINKS,
};

export type SidebarLinksPreference = Partial<Record<SidebarSectionId, string[]>>;

// Applies a player's saved key order/visibility to a section's canonical
// catalog, returning the [label, route] tuples AppShell.tsx's SidebarSection
// already expects. Unknown/stale keys (e.g. a link removed from the catalog
// in a future release) are silently skipped rather than crashing. No saved
// order for this section falls back to the full canonical order.
export function applySidebarLinkOrder(section: SidebarSectionId, savedKeys: string[] | undefined): Array<[string, string]> {
  const catalog = SIDEBAR_SECTIONS[section];
  if (!savedKeys || !savedKeys.length) return catalog.map((entry) => [entry.label, entry.route]);
  const byKey = new Map(catalog.map((entry) => [sidebarLinkKey(entry.route), entry]));
  const ordered: Array<[string, string]> = [];
  for (const key of savedKeys) {
    const entry = byKey.get(key);
    if (entry) ordered.push([entry.label, entry.route]);
  }
  return ordered;
}
