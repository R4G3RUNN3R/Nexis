// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Life Paths data (client mirror of server/data/lifePathsData.js)
// Soft, early-game identity lanes: not classes, not permanent prisons. They
// flavor early text and point new citizens at a starting job and education
// branch. Nothing here gates mechanical progression.
// ─────────────────────────────────────────────────────────────────────────────

export type LifePathId = "explorer" | "rogue" | "magus" | "merchant" | "healer" | "artisan";

export type LifePathDefinition = {
  id: LifePathId;
  name: string;
  subtitle: string;
  flavor: string;
  suggestedJob: {
    label: string;
    system: "adventure" | "civic";
    systemId: string;
    route: string;
  };
  suggestedEducation: {
    label: string;
    categoryId: string;
    categoryLabel: string;
    courseId: string;
    route: string;
  };
  chronicleSummary: string;
};

export const lifePaths: LifePathDefinition[] = [
  {
    id: "explorer",
    name: "Explorer",
    subtitle: "Explorer / Adventurer",
    flavor:
      "You're happiest with a fresh horizon and a half-finished map. Ruins, roads, and rumors of what's past the next ridge pull at you more than gold ever could.",
    suggestedJob: { label: "Beginner Adventurer", system: "adventure", systemId: "beginner_adventurer", route: "/adventure" },
    suggestedEducation: { label: "World Geography", categoryId: "general", categoryLabel: "General Studies", courseId: "world-geography", route: "/education" },
    chronicleSummary: "Began the journey as an Explorer, drawn to open roads and the unmapped edges of Nexis.",
  },
  {
    id: "rogue",
    name: "Rogue",
    subtitle: "Rogue / Thief",
    flavor:
      "Locks are suggestions, shadows are furniture, and the city's back alleys know your footsteps better than the watch rosters do.",
    suggestedJob: { label: "Thievery", system: "adventure", systemId: "thievery", route: "/adventure" },
    suggestedEducation: { label: "Back Alley Awareness", categoryId: "street", categoryLabel: "Street Survival", courseId: "back-alley-awareness", route: "/education" },
    chronicleSummary: "Began the journey as a Rogue, learning to move through Nexis unseen and unbothered by its rules.",
  },
  {
    id: "magus",
    name: "Magus",
    subtitle: "Magus / Scholar",
    flavor:
      "Sigils, old ledgers, and the quiet certainty that knowing more than the room is its own kind of weapon.",
    suggestedJob: { label: "University", system: "civic", systemId: "university", route: "/civic-jobs" },
    suggestedEducation: { label: "Sigil Literacy", categoryId: "arcane", categoryLabel: "Arcane Studies", courseId: "sigil-literacy", route: "/education" },
    chronicleSummary: "Began the journey as a Magus, choosing study and sigilwork over steel.",
  },
  {
    id: "merchant",
    name: "Merchant",
    subtitle: "Merchant / Entrepreneur",
    flavor:
      "Every road is a supply line and every conversation is a negotiation. You see margins where other citizens just see scenery.",
    suggestedJob: { label: "Courier", system: "adventure", systemId: "courier", route: "/adventure" },
    suggestedEducation: { label: "Ledger Basics", categoryId: "trade", categoryLabel: "Commerce & Trade / Economics", courseId: "ledger-basics", route: "/education" },
    chronicleSummary: "Began the journey as a Merchant, already counting the margins on every deal in Nexis.",
  },
  {
    id: "healer",
    name: "Healer",
    subtitle: "Healer / Medic",
    flavor:
      "Bleeding stops, fevers break, and you're the reason half the tavern is still walking. Someone has to keep the reckless alive.",
    suggestedJob: { label: "Apothecary Hall", system: "civic", systemId: "apothecary_hall", route: "/civic-jobs" },
    suggestedEducation: { label: "Field Triage", categoryId: "medicine", categoryLabel: "Medical & Biology", courseId: "field-triage", route: "/education" },
    chronicleSummary: "Began the journey as a Healer, committed to keeping Nexis's reckless citizens breathing.",
  },
  {
    id: "artisan",
    name: "Artisan",
    subtitle: "Artisan / Builder",
    flavor:
      "Give you good materials and a little time and you'll build something that outlasts the people who doubted it.",
    suggestedJob: { label: "Builder's Guild", system: "civic", systemId: "builders_guild", route: "/civic-jobs" },
    suggestedEducation: { label: "Tool Use Foundations", categoryId: "craftsmanship", categoryLabel: "Craftsmanship & Artifice", courseId: "tool-use-foundations", route: "/education" },
    chronicleSummary: "Began the journey as an Artisan, more interested in what you could build than what you could take.",
  },
];

export const lifePathMap: Record<string, LifePathDefinition> = Object.fromEntries(
  lifePaths.map((path) => [path.id, path]),
);

export function getLifePath(id: string | null | undefined): LifePathDefinition | null {
  if (!id) return null;
  return lifePathMap[id] ?? null;
}
