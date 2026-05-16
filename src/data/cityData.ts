// ─────────────────────────────────────────────────────────────────────────────
// cityData.ts
// Nexis Browser RPG — Cities and travel routes
// ─────────────────────────────────────────────────────────────────────────────

export type TravelMethod = "land" | "sea";

export type City = {
  id: string;
  name: string;
  subtitle: string;
  academy: string | null;
  academyId: string | null;
  description: string;
  mapPosition: { x: number; y: number }; // SVG coords in 800×600 viewBox
  isMainCity: boolean;
};

export type TravelRoute = {
  id: string;
  from: string; // city id
  to: string;   // city id
  method: TravelMethod;
  durationMs: number; // travel time in milliseconds
  cost: number; // gold cost (ship fare where applicable, 0 for land)
  description: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Cities
// Positions use an 800×600 SVG viewBox.
//   Nexis  = centre (400, 300)
//   North  = (400,  80)
//   East   = (680, 300)
//   South  = (400, 520)
//   West   = (120, 300)
// ─────────────────────────────────────────────────────────────────────────────

export const cities: City[] = [
  {
    id: "nexis",
    name: "Nexis",
    subtitle: "The Capital",
    academy: "Guildhall of Civil Professions",
    academyId: "nexis_professions",
    description:
      "The beating heart of the realm — a sprawling mercantile capital where every profession and trade guild maintains a presence. The Guildhall of Civil Professions stands at its centre, always open to aspiring craftspeople and scholars.",
    mapPosition: { x: 400, y: 300 },
    isMainCity: true,
  },
  {
    id: "aethermoor",
    name: "Aethermoor",
    subtitle: "The Elven Enclave",
    academy: "Silverbough Arcane Conservatory",
    academyId: "northern",
    description:
      "A city grown from ancient elven silver-trees, where magic saturates the air itself. The Silverbough Arcane Conservatory trains mage-smiths and enchanters in the art of rune-craft and artifact binding.",
    mapPosition: { x: 400, y: 80 },
    isMainCity: false,
  },
  {
    id: "torvhal",
    name: "Torvhal",
    subtitle: "The Blade Fortress",
    academy: "Akai Tetsu War Dojo",
    academyId: "eastern",
    description:
      "A fortress-city carved from black iron stone, where the clash of steel rings day and night. The Akai Tetsu War Dojo shapes warriors, duelists, and battlefield tacticians in the Eastern combat tradition.",
    mapPosition: { x: 680, y: 300 },
    isMainCity: false,
  },
  {
    id: "embervale",
    name: "Embervale",
    subtitle: "The Sacred Grove",
    academy: "Verdant Ancestral Circle",
    academyId: "southern",
    description:
      "A sun-drenched wildland sanctuary reachable only by sea, where shaman-druids tend sacred groves and commune with the spirits of earth and life. The Verdant Ancestral Circle initiates healers and revivalists.",
    mapPosition: { x: 400, y: 520 },
    isMainCity: false,
  },
  {
    id: "westmarch",
    name: "Westmarch",
    subtitle: "The Divided Capital",
    academy: "The Iron Writ & Veiled Ledger",
    academyId: "western",
    description:
      "A city split between its gleaming courthouse district and a labyrinthine shadow quarter. The Iron Writ & Veiled Ledger trains both lawful enforcers and shadow brokers — the path chosen defines everything.",
    mapPosition: { x: 120, y: 300 },
    isMainCity: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Travel routes (bidirectional — both directions explicitly defined)
// Duration constants (ms)
// ─────────────────────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 60 * MIN;

export const routes: TravelRoute[] = [
  // ── nexis ↔ aethermoor (North, land, 45 min, free) ──────────────────────
  {
    id: "nexis_to_aethermoor",
    from: "nexis",
    to: "aethermoor",
    method: "land",
    durationMs: 45 * MIN,
    cost: 0,
    description:
      "A well-maintained northern road winds through silver birch forests toward the elven enclave of Aethermoor. 45 minutes on foot or horseback, no toll.",
  },
  {
    id: "aethermoor_to_nexis",
    from: "aethermoor",
    to: "nexis",
    method: "land",
    durationMs: 45 * MIN,
    cost: 0,
    description:
      "The southern road descends from the elven woodlands back to the capital Nexis. 45 minutes, no toll.",
  },

  // ── nexis ↔ torvhal (East, land, 60 min, free) ──────────────────────────
  {
    id: "nexis_to_torvhal",
    from: "nexis",
    to: "torvhal",
    method: "land",
    durationMs: 60 * MIN,
    cost: 0,
    description:
      "The eastern trade road cuts across open plains toward the iron fortress of Torvhal. Roughly 1 hour on foot, no toll.",
  },
  {
    id: "torvhal_to_nexis",
    from: "torvhal",
    to: "nexis",
    method: "land",
    durationMs: 60 * MIN,
    cost: 0,
    description:
      "The western road from Torvhal leads back to Nexis across the eastern plains. 1 hour, no toll.",
  },

  // ── nexis ↔ embervale (South, sea, 2 hours, 500 gold) ───────────────────
  {
    id: "nexis_to_embervale",
    from: "nexis",
    to: "embervale",
    method: "sea",
    durationMs: 2 * HOUR,
    cost: 500,
    description:
      "A merchant vessel departs from Nexis harbour heading south to the sacred groves of Embervale. 2-hour voyage; 500 gold ship fare. Posted route risks appear here when active.",
  },
  {
    id: "embervale_to_nexis",
    from: "embervale",
    to: "nexis",
    method: "sea",
    durationMs: 2 * HOUR,
    cost: 500,
    description:
      "Return sea voyage from Embervale's dock back north to Nexis harbour. 2 hours; 500 gold ship fare.",
  },

  // ── nexis ↔ westmarch (West, sea, 3 hours, 750 gold) ────────────────────
  {
    id: "nexis_to_westmarch",
    from: "nexis",
    to: "westmarch",
    method: "sea",
    durationMs: 3 * HOUR,
    cost: 750,
    description:
      "A longer, more perilous sea route westward around the cape to the divided capital of Westmarch. 3-hour voyage; 750 gold ship fare. Posted route risks appear here when active.",
  },
  {
    id: "westmarch_to_nexis",
    from: "westmarch",
    to: "nexis",
    method: "sea",
    durationMs: 3 * HOUR,
    cost: 750,
    description:
      "Return sea voyage from Westmarch's harbour east back to Nexis. 3 hours; 750 gold ship fare.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up a direct travel route between two cities.
 * Returns null if no direct route exists (player must route through Nexis).
 */
export function getRoute(fromId: string, toId: string): TravelRoute | null {
  return (
    routes.find((r) => r.from === fromId && r.to === toId) ?? null
  );
}

/**
 * Look up a city by its id.
 */
export function getCity(id: string): City | undefined {
  return cities.find((c) => c.id === id);
}

/**
 * Return all routes departing from a given city id.
 */
export function getRoutesFrom(fromId: string): TravelRoute[] {
  return routes.filter((r) => r.from === fromId);
}

/**
 * Determine whether two cities have a direct connection, or whether the player
 * must transit through Nexis.
 *
 * Returns:
 *   - "direct"  — a single route covers the journey
 *   - "via_nexis" — no direct route; player must stop at Nexis
 *   - "same"   — origin and destination are identical
 */
export function getTravelStrategy(
  fromId: string,
  toId: string
): "direct" | "via_nexis" | "same" {
  if (fromId === toId) return "same";
  if (getRoute(fromId, toId)) return "direct";
  return "via_nexis";
}
