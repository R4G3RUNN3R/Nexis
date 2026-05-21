function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cleanId(value) { return String(value ?? "entry").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72) || "entry"; }

export const RECORD_CATEGORIES = [
  "progression",
  "education",
  "academy",
  "skills",
  "manuals",
  "contracts",
  "discovery",
  "travel",
  "combat",
  "crafting",
  "marketplace",
  "guild",
  "consortium",
  "admin",
  "prestige",
];

export function ensurePlayerRecords(runtimeState) {
  runtimeState.player = asRecord(runtimeState.player);
  const current = asRecord(runtimeState.player.records);
  runtimeState.player.records = {
    entries: asArray(current.entries).filter((entry) => entry && typeof entry === "object").slice(0, 300),
    lastUpdatedAt: typeof current.lastUpdatedAt === "number" ? current.lastUpdatedAt : null,
  };
  return runtimeState.player.records;
}

export function addPlayerRecord(runtimeState, input = {}) {
  const records = ensurePlayerRecords(runtimeState);
  const now = typeof input.timestamp === "number" ? input.timestamp : Date.now();
  const category = RECORD_CATEGORIES.includes(input.category) ? input.category : "progression";
  const source = typeof input.source === "string" && input.source ? input.source : category;
  const summary = typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : "Account record updated.";
  const id = typeof input.id === "string" && input.id ? input.id : `record_${category}_${cleanId(source)}_${now}`;
  if (records.entries.some((entry) => asRecord(entry).id === id)) return records.entries.find((entry) => asRecord(entry).id === id);
  const entry = {
    id,
    timestamp: now,
    category,
    summary,
    detail: asRecord(input.detail),
    source,
    route: typeof input.route === "string" && input.route ? input.route : null,
  };
  records.entries = [entry, ...records.entries].slice(0, 300);
  records.lastUpdatedAt = now;
  return entry;
}

export function getPlayerRecords(runtimeState, { category = null, limit = 80 } = {}) {
  const records = ensurePlayerRecords(runtimeState);
  const filtered = category ? records.entries.filter((entry) => asRecord(entry).category === category) : records.entries;
  return filtered.slice(0, Math.max(1, Math.min(300, Number(limit) || 80)));
}

export function ensureProgressionEvents(runtimeState) {
  runtimeState.player = asRecord(runtimeState.player);
  const current = asRecord(runtimeState.player.progressionEvents);
  runtimeState.player.progressionEvents = {
    pending: asArray(current.pending).filter((entry) => entry && typeof entry === "object").slice(0, 24),
    history: asArray(current.history).filter((entry) => entry && typeof entry === "object").slice(0, 100),
    lastUpdatedAt: typeof current.lastUpdatedAt === "number" ? current.lastUpdatedAt : null,
  };
  return runtimeState.player.progressionEvents;
}

export function queueProgressionEvent(runtimeState, input = {}) {
  const events = ensureProgressionEvents(runtimeState);
  const now = typeof input.createdAt === "number" ? input.createdAt : Date.now();
  const id = typeof input.id === "string" && input.id ? input.id : `progression_${cleanId(input.type ?? "event")}_${now}`;
  if (events.pending.some((entry) => asRecord(entry).id === id) || events.history.some((entry) => asRecord(entry).id === id)) return null;
  const event = {
    id,
    type: typeof input.type === "string" && input.type ? input.type : "progression",
    title: typeof input.title === "string" && input.title ? input.title : "Progression updated",
    summary: typeof input.summary === "string" && input.summary ? input.summary : null,
    route: typeof input.route === "string" && input.route ? input.route : "/home",
    createdAt: now,
    acknowledgedAt: null,
    detail: asRecord(input.detail),
  };
  events.pending = [event, ...events.pending].slice(0, 24);
  events.lastUpdatedAt = now;
  return event;
}

export function acknowledgeProgressionEvent(runtimeState, eventId, now = Date.now()) {
  const events = ensureProgressionEvents(runtimeState);
  const targetId = String(eventId ?? "").trim();
  let acknowledged = [];
  if (targetId === "all") {
    acknowledged = events.pending.map((event) => ({ ...event, acknowledgedAt: now }));
    events.pending = [];
  } else {
    const found = events.pending.find((event) => asRecord(event).id === targetId);
    if (!found) return null;
    acknowledged = [{ ...found, acknowledgedAt: now }];
    events.pending = events.pending.filter((event) => asRecord(event).id !== targetId);
  }
  events.history = [...acknowledged, ...events.history].slice(0, 100);
  events.lastUpdatedAt = now;
  return acknowledged;
}

export function serializeRecordSummary(runtimeState) {
  const records = ensurePlayerRecords(runtimeState);
  const events = ensureProgressionEvents(runtimeState);
  return {
    recent: records.entries.slice(0, 12),
    total: records.entries.length,
    pendingProgressionEvents: events.pending.slice(0, 8),
  };
}
