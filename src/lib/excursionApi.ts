export type ServerExcursionGrid = {
  columns: number;
  rows: number;
  boxTravelMs?: number;
  localMinimumTravelMs?: number;
  exploreMs?: number;
};

export type ServerExcursionLocation = {
  id: string;
  name: string;
  type: string;
  regionId?: string;
  box?: { x: number; y: number };
  xPercent?: number;
  yPercent?: number;
  riskBand?: string;
  summary?: string;
  rewardFocus?: string[];
  recipeGrade?: string;
  recipeId?: string | null;
  requiredCourses?: string[];
  tags?: string[];
  goldRange?: [number, number];
  timing?: { outboundLabel?: string; exploreLabel?: string; returnLabel?: string; totalLabel?: string };
  chanceSummary?: { recipeFragment?: number; directRecipe?: number; itemPiece?: number; rareItem?: number };
  available?: boolean;
  lockReason?: string | null;
};

export type ServerExcursionBoard = {
  grid: ServerExcursionGrid;
  currentCityId?: string;
  currentCityName?: string;
  originBox?: { x: number; y: number };
  active?: Record<string, unknown> | null;
  locations: ServerExcursionLocation[];
  history?: Array<Record<string, unknown>>;
  counters?: Record<string, number>;
  message?: string | null;
  generatedAt?: number;
};

export type ExcursionBoardResult =
  | { ok: true; board: ServerExcursionBoard }
  | { ok: false; error: string; status: number | null };

export async function getServerExcursionBoard(token: string): Promise<ExcursionBoardResult> {
  try {
    const response = await fetch("/api/excursions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => null) as { board?: ServerExcursionBoard; error?: string } | null;
    if (!response.ok || !payload?.board || !Array.isArray(payload.board.locations)) {
      return { ok: false, error: payload?.error ?? "Excursion board unavailable.", status: response.status };
    }
    return { ok: true, board: payload.board };
  } catch {
    return { ok: false, error: "Excursion board unavailable.", status: null };
  }
}
