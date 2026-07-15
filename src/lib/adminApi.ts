import { type ServerPlayerState } from "./authApi";

type ApiFailure = {
  ok: false;
  error: string;
  status: number | null;
};

export type AdminPlayerSummary = {
  internalId: string;
  publicId: number;
  email: string;
  displayName: string;
  entityType: "player" | "npc" | "system" | "event";
  privilegeRole: "player" | "staff" | "admin";
};

export type AdminPlayerTarget = {
  user: {
    internalId: string;
    publicId: number;
    username: string | null;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    entityType: "player" | "npc" | "system" | "event";
    privilegeRole: "player" | "staff" | "admin";
  };
  dossier?: Record<string, unknown>;
  player: {
    level: number;
    experience: number;
    gold: number;
    currencies: { copper: number; silver: number; gold: number; platinum: number };
    stats: Record<string, number>;
    workingStats: Record<string, number>;
    battleStats: Record<string, number>;
    inventory: Record<string, number>;
    itemEnhancements: Record<string, string[]>;
    currentJob: string | null;
    condition: { type: string; until: number | null; reason: string | null };
  };
};

export type AdminActionAudit = {
  actionType: string;
  reason: string;
  beforeSummary: Record<string, unknown>;
  afterSummary: Record<string, unknown>;
};

export type AdminActionSuccess = {
  target: AdminPlayerTarget;
  playerState: ServerPlayerState;
  audit: AdminActionAudit;
};

export type AdminAuditLogEntry = {
  id: number;
  actorInternalId: string;
  actorPublicId: number;
  actorDisplayName: string | null;
  targetInternalId: string;
  targetPublicId: number;
  targetDisplayName: string | null;
  actionType: string;
  reason: string;
  beforeSummary: Record<string, unknown>;
  afterSummary: Record<string, unknown>;
  createdAt: number;
};

export type AdminOrganizationLeadershipResult = {
  ok: true;
  organizationPublicId: number;
  organizationType: "guild" | "consortium";
  previousLeaderPublicId: number | null;
  nextLeaderPublicId: number;
  leaderRoleKey: string;
  fallbackRoleKey: string;
  reason: string;
};

async function requestJson<T>(path: string, token: string, init: RequestInit = {}): Promise<T | ApiFailure> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return { ok: false, error: payload?.error ?? `Request failed (${response.status}).`, status: response.status };
    }
    return payload;
  } catch {
    return { ok: false, error: "Administrator API unavailable.", status: null };
  }
}

export function searchAdminPlayers(token: string, query: string) {
  return requestJson<{ results: AdminPlayerSummary[] }>(`/api/admin/players?q=${encodeURIComponent(query)}`, token);
}

export function getAdminPlayerDetails(token: string, internalId: string) {
  return requestJson<{ target: AdminPlayerTarget }>(`/api/admin/players/${internalId}`, token);
}

export function postAdminPlayerAction(token: string, internalId: string, payload: Record<string, unknown>) {
  return requestJson<AdminActionSuccess>(`/api/admin/players/${internalId}/actions`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Admin Logs tab: recent moderation/action history. Omit targetInternalId
 * for the most recent admin actions across every target; pass it to scope
 * to a single player. Read-only — hits GET /api/admin/audit-logs, which is
 * gated server-side by assertStaffOrAdmin (see adminService.getAdminAuditLog).
 */
export function getAdminAuditLog(token: string, options: { targetInternalId?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.targetInternalId) params.set("targetInternalId", options.targetInternalId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return requestJson<{ entries: AdminAuditLogEntry[] }>(`/api/admin/audit-logs${query ? `?${query}` : ""}`, token);
}

/**
 * Organizations tab "administer" control: reassigns guild/consortium
 * leadership to another member. Hits the pre-existing
 * POST /api/admin/organizations/:organizationPublicId/leadership endpoint
 * (server/services/adminOrganizationService.js), which independently
 * enforces assertAdministrator(), a required reason, and writes an
 * admin_action_logs row via insertAdminAuditLog() — the same guarantees as
 * every action routed through performAdminAction/postAdminPlayerAction.
 */
export function reassignOrganizationLeadership(
  token: string,
  organizationPublicId: string,
  payload: { nextLeaderPublicId: string; reason: string },
) {
  return requestJson<AdminOrganizationLeadershipResult>(
    `/api/admin/organizations/${encodeURIComponent(organizationPublicId)}/leadership`,
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
}
