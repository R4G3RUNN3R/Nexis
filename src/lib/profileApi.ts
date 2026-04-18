export type ProfileOrganizationSummary = {
  name: string;
  tag: string;
  publicId: number;
  type: "guild" | "consortium";
};

export type ProfileResponse = {
  viewer: {
    mode: "public" | "self" | "staff";
    canModerate: boolean;
    isSelf: boolean;
  };
  publicProfile: {
    internalId: string;
    name: string;
    publicId: number;
    title: string;
    entityType: "player" | "npc" | "system" | "event";
    level: number;
    rank: string | null;
    ageLabel: string;
    createdAt: number;
    life: { current: number; max: number };
    lastAction: { isOnline: boolean; lastActionAt: number | null; label: string };
    status: { label: string; condition: { type: string; until: number | null; reason: string | null } };
    guild: ProfileOrganizationSummary | null;
    consortium: ProfileOrganizationSummary | null;
    job: string | null;
    property: { propertyId: string };
    travel: { summary: string };
    bio: { bio: string | null; signature: string | null; reservedNote: string | null };
    counters: null;
  };
  selfProfile: {
    currencies: { copper: number; silver: number; gold: number; platinum: number };
    workingStats: Record<string, number>;
    battleStats: Record<string, number>;
    inventoryCount: number;
    inventoryTypes: number;
  } | null;
  moderation: {
    email: string;
    internalId: string;
    entityType: "player" | "npc" | "system" | "event";
    privilegeRole: "player" | "staff" | "admin";
    reservedIdentityName: string | null;
  } | null;
};

export type ProfileApiResult =
  | { ok: true; profile: ProfileResponse }
  | { ok: false; error: string; status: number | null; code?: string | null };

export async function getProfileView(publicId: string, sessionToken?: string | null): Promise<ProfileApiResult> {
  try {
    const response = await fetch(`/api/profiles/${encodeURIComponent(publicId)}`, {
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
    });
    const payload = (await response.json()) as { profile?: ProfileResponse; error?: string; code?: string | null };
    if (!response.ok || !payload.profile) {
      return {
        ok: false,
        error: payload.error ?? `Request failed (${response.status}).`,
        status: response.status,
        code: payload.code ?? null,
      };
    }
    return { ok: true, profile: payload.profile };
  } catch {
    return { ok: false, error: "Profile service unavailable.", status: null, code: "NETWORK_UNAVAILABLE" };
  }
}
