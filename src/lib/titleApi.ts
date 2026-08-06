export type TitleKind = "cosmetic" | "stat";

export type TitleCatalogEntry = {
  id: string;
  name: string;
  kind: TitleKind;
  description: string;
  flavor: string;
  effects: string[];
  earned: boolean;
  equipped: boolean;
};

export type EquippedTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  effects: string[];
} | null;

type TitlesResult =
  | { ok: true; titles: TitleCatalogEntry[]; equippedTitle: EquippedTitle }
  | { ok: false; error: string };

type TitleActionResult =
  | { ok: true; titles: TitleCatalogEntry[]; equippedTitle: EquippedTitle; message?: string }
  | { ok: false; error: string };

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getOwnTitles(sessionToken: string | null): Promise<TitlesResult> {
  if (!sessionToken) return { ok: false, error: "Authentication required." };
  try {
    const response = await fetch("/api/me/titles", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const payload = await parseJson<{ titles?: TitleCatalogEntry[]; equippedTitle?: EquippedTitle; error?: string }>(response);
    if (!response.ok || !payload?.titles) {
      return { ok: false, error: payload?.error ?? "Titles unavailable." };
    }
    return { ok: true, titles: payload.titles, equippedTitle: payload.equippedTitle ?? null };
  } catch {
    return { ok: false, error: "Titles unavailable." };
  }
}

export async function equipOwnTitle(titleId: string, sessionToken: string | null): Promise<TitleActionResult> {
  if (!sessionToken) return { ok: false, error: "Authentication required." };
  try {
    const response = await fetch("/api/me/titles/equip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ titleId }),
    });
    const payload = await parseJson<{ titles?: TitleCatalogEntry[]; equippedTitle?: EquippedTitle; message?: string; error?: string }>(response);
    if (!response.ok || !payload?.titles) {
      return { ok: false, error: payload?.error ?? "Title equip failed." };
    }
    return { ok: true, titles: payload.titles, equippedTitle: payload.equippedTitle ?? null, message: payload.message };
  } catch {
    return { ok: false, error: "Title equip failed." };
  }
}

export async function unequipOwnTitle(sessionToken: string | null): Promise<TitleActionResult> {
  if (!sessionToken) return { ok: false, error: "Authentication required." };
  try {
    const response = await fetch("/api/me/titles/unequip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    const payload = await parseJson<{ titles?: TitleCatalogEntry[]; equippedTitle?: EquippedTitle; message?: string; error?: string }>(response);
    if (!response.ok || !payload?.titles) {
      return { ok: false, error: payload?.error ?? "Title unequip failed." };
    }
    return { ok: true, titles: payload.titles, equippedTitle: payload.equippedTitle ?? null, message: payload.message };
  } catch {
    return { ok: false, error: "Title unequip failed." };
  }
}
