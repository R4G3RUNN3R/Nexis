const NAME_MIN = 2;
const NAME_MAX = 20;
const PASSWORD_MIN = 6;
const NAME_PATTERN = /^[a-zA-Z\- ']+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCOUNTS_KEY = "nexis_accounts";
const SESSION_KEY = "nexis_auth_session";
const PLAYER_KEY = "nexis_player";
const PLAYER_ALLOCATOR_KEY = "nexis_public_id_allocator_player";
const INTERNAL_PLAYER_ALLOCATOR_KEY = "nexis_internal_player_allocator";

const PLAYER_PREFIX = "P";
const PUBLIC_ID_DIGITS = 7;
const RESERVED_PUBLIC_ID_COUNT = 20;
const FIRST_PLAYER_NUMERIC_ID = 1_000_000 + RESERVED_PUBLIC_ID_COUNT;
const API_TIMEOUT_MS = 3000;

function playerStorageKey(email) {
  return `${PLAYER_KEY}__${email}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function setStatus(message, type) {
  const status = document.getElementById("form-status");
  if (!status) return;
  status.hidden = false;
  status.className = `form-status form-status--${type}`;
  status.textContent = message;
}

function clearStatus() {
  const status = document.getElementById("form-status");
  if (!status) return;
  status.hidden = true;
  status.className = "form-status";
  status.textContent = "";
}

function setFieldError(name, message) {
  const error = document.querySelector(`[data-error-for="${name}"]`);
  const input = document.querySelector(`[name="${name}"]`);
  if (error) error.textContent = message || "";
  if (input) input.classList.toggle("field-input--error", Boolean(message));
}

function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((node) => {
    node.textContent = "";
  });
  form.querySelectorAll("input").forEach((node) => {
    node.classList.remove("field-input--error");
  });
}

function validateName(value, label) {
  const trimmed = String(value || "").trim();
  if (trimmed.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer.`;
  if (!NAME_PATTERN.test(trimmed)) {
    return `${label} may only contain letters, hyphens, spaces, and apostrophes.`;
  }
  return "";
}

function validateEmail(value) {
  const trimmed = normalizeEmail(value);
  if (!trimmed) return "Email is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  return "";
}

function validatePassword(value) {
  return String(value || "").length < PASSWORD_MIN
    ? `Password must be at least ${PASSWORD_MIN} characters.`
    : "";
}

function readAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAccounts(accounts) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function normalizeSession(state) {
  if (!state || typeof state !== "object") {
    return {
      activeEmail: null,
      authSource: "local",
      serverSessionToken: null,
      sessionExpiresAt: null,
    };
  }

  return {
    activeEmail: typeof state.activeEmail === "string" ? state.activeEmail : null,
    authSource: state.authSource === "server" ? "server" : "local",
    serverSessionToken:
      typeof state.serverSessionToken === "string" && state.serverSessionToken
        ? state.serverSessionToken
        : null,
    sessionExpiresAt:
      typeof state.sessionExpiresAt === "string" && state.sessionExpiresAt
        ? state.sessionExpiresAt
        : null,
  };
}

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return normalizeSession(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSession(null);
  }
}

function writeSession(state) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function readAllocator(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { nextNumericId: FIRST_PLAYER_NUMERIC_ID };
    const parsed = JSON.parse(raw);
    return {
      nextNumericId:
        typeof parsed.nextNumericId === "number" && Number.isInteger(parsed.nextNumericId)
          ? Math.max(FIRST_PLAYER_NUMERIC_ID, parsed.nextNumericId)
          : FIRST_PLAYER_NUMERIC_ID,
    };
  } catch {
    return { nextNumericId: FIRST_PLAYER_NUMERIC_ID };
  }
}

function writeAllocator(key, state) {
  window.localStorage.setItem(key, JSON.stringify(state));
}

function readInternalAllocator() {
  try {
    const raw = window.localStorage.getItem(INTERNAL_PLAYER_ALLOCATOR_KEY);
    if (!raw) return { nextInternalSequence: 1 };
    const parsed = JSON.parse(raw);
    return {
      nextInternalSequence:
        typeof parsed.nextInternalSequence === "number" && Number.isInteger(parsed.nextInternalSequence)
          ? Math.max(1, parsed.nextInternalSequence)
          : 1,
    };
  } catch {
    return { nextInternalSequence: 1 };
  }
}

function writeInternalAllocator(state) {
  window.localStorage.setItem(INTERNAL_PLAYER_ALLOCATOR_KEY, JSON.stringify(state));
}

function isUsablePublicId(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= FIRST_PLAYER_NUMERIC_ID;
}

function isUsableInternalPlayerId(value) {
  return typeof value === "string" && /^plr_\d+$/.test(value);
}

function parseInternalSequence(internalPlayerId) {
  const match = /^plr_(\d+)$/.exec(internalPlayerId);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function formatInternalPlayerId(sequence) {
  return `plr_${String(sequence).padStart(6, "0")}`;
}

function formatPlayerPublicId(numericId) {
  return `${PLAYER_PREFIX}${String(numericId).padStart(PUBLIC_ID_DIGITS, "0")}`;
}

function migrateAccounts(accounts) {
  const entries = Object.entries(accounts).sort(([, left], [, right]) => {
    const leftCreated = typeof left.createdAt === "number" ? left.createdAt : 0;
    const rightCreated = typeof right.createdAt === "number" ? right.createdAt : 0;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
    return String(left.email || "").localeCompare(String(right.email || ""));
  });

  const reserved = new Set();
  for (let offset = 0; offset < RESERVED_PUBLIC_ID_COUNT; offset += 1) {
    reserved.add(1_000_000 + offset);
  }

  const usedPublicIds = new Set(reserved);
  const usedInternalIds = new Set();
  const migrated = {};
  let changed = false;

  for (const [email, account] of entries) {
    const keepPublicId =
      isUsablePublicId(account.publicId) && !usedPublicIds.has(account.publicId)
        ? account.publicId
        : null;
    const keepInternalId =
      isUsableInternalPlayerId(account.internalPlayerId) && !usedInternalIds.has(account.internalPlayerId)
        ? account.internalPlayerId
        : null;

    if (keepPublicId !== null) usedPublicIds.add(keepPublicId);
    if (keepInternalId !== null) usedInternalIds.add(keepInternalId);
    if (keepPublicId === null || keepInternalId === null) changed = true;

    migrated[email] = {
      ...account,
      publicId: keepPublicId || 0,
      internalPlayerId: keepInternalId || "",
    };
  }

  const publicAllocator = readAllocator(PLAYER_ALLOCATOR_KEY);
  const internalAllocator = readInternalAllocator();

  let nextPublicId = Math.max(
    FIRST_PLAYER_NUMERIC_ID,
    publicAllocator.nextNumericId,
    ...Array.from(usedPublicIds.values()).map((value) => value + 1),
  );
  while (usedPublicIds.has(nextPublicId)) nextPublicId += 1;

  let nextInternalSequence = Math.max(
    1,
    internalAllocator.nextInternalSequence,
    ...Array.from(usedInternalIds.values()).map((value) => parseInternalSequence(value) + 1),
  );

  for (const [email] of entries) {
    if (!isUsablePublicId(migrated[email].publicId)) {
      while (usedPublicIds.has(nextPublicId)) nextPublicId += 1;
      migrated[email].publicId = nextPublicId;
      usedPublicIds.add(nextPublicId);
      nextPublicId += 1;
    }

    if (!isUsableInternalPlayerId(migrated[email].internalPlayerId)) {
      let candidate = formatInternalPlayerId(nextInternalSequence);
      while (usedInternalIds.has(candidate)) {
        nextInternalSequence += 1;
        candidate = formatInternalPlayerId(nextInternalSequence);
      }
      migrated[email].internalPlayerId = candidate;
      usedInternalIds.add(candidate);
      nextInternalSequence += 1;
    }
  }

  if (publicAllocator.nextNumericId !== nextPublicId) {
    changed = true;
    writeAllocator(PLAYER_ALLOCATOR_KEY, { nextNumericId: nextPublicId });
  }

  if (internalAllocator.nextInternalSequence !== nextInternalSequence) {
    changed = true;
    writeInternalAllocator({ nextInternalSequence: nextInternalSequence });
  }

  return { accounts: migrated, changed };
}

function ensureAccounts() {
  const migrated = migrateAccounts(readAccounts());
  if (migrated.changed) {
    writeAccounts(migrated.accounts);
  }
  return migrated.accounts;
}

function allocatePlayerIdentity(existingAccounts) {
  const usedPublicIds = new Set();
  for (let offset = 0; offset < RESERVED_PUBLIC_ID_COUNT; offset += 1) {
    usedPublicIds.add(1_000_000 + offset);
  }
  const usedInternalIds = new Set();

  Object.values(existingAccounts).forEach((account) => {
    if (isUsablePublicId(account.publicId)) usedPublicIds.add(account.publicId);
    if (isUsableInternalPlayerId(account.internalPlayerId)) usedInternalIds.add(account.internalPlayerId);
  });

  const publicAllocator = readAllocator(PLAYER_ALLOCATOR_KEY);
  let publicId = Math.max(FIRST_PLAYER_NUMERIC_ID, publicAllocator.nextNumericId);
  while (usedPublicIds.has(publicId)) publicId += 1;
  writeAllocator(PLAYER_ALLOCATOR_KEY, { nextNumericId: publicId + 1 });

  const internalAllocator = readInternalAllocator();
  let sequence = Math.max(
    1,
    internalAllocator.nextInternalSequence,
    ...Array.from(usedInternalIds.values()).map((value) => parseInternalSequence(value) + 1),
  );
  let internalPlayerId = formatInternalPlayerId(sequence);
  while (usedInternalIds.has(internalPlayerId)) {
    sequence += 1;
    internalPlayerId = formatInternalPlayerId(sequence);
  }
  writeInternalAllocator({ nextInternalSequence: sequence + 1 });

  return { publicId, internalPlayerId };
}

function readStoredPlayerValue(email) {
  try {
    const raw = window.localStorage.getItem(playerStorageKey(email));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredPlayerValue(email, value) {
  window.localStorage.setItem(playerStorageKey(email), JSON.stringify(value));
}

function mirrorPlayerStateFromServer(email, user, playerState) {
  const existing = readStoredPlayerValue(email);
  const current = typeof existing.current === "object" && existing.current !== null
    ? existing.current
    : {};

  const resolvedJob = typeof playerState?.currentJob === "string"
    ? playerState.currentJob
    : playerState?.currentJob && typeof playerState.currentJob === "object" && typeof playerState.currentJob.current === "string"
      ? playerState.currentJob.current
      : null;

  const next = {
    ...existing,
    internalId: user.internalPlayerId,
    publicId: user.publicId,
    name: existing.name || user.firstName,
    lastName: existing.lastName || user.lastName,
    isRegistered: true,
  };

  if (playerState) {
    next.level = playerState.level;
    next.gold = playerState.gold;
    next.stats = { ...(existing.stats || {}), ...(playerState.stats || {}) };
    next.workingStats = { ...(existing.workingStats || {}), ...(playerState.workingStats || {}) };
    next.battleStats = { ...(existing.battleStats || {}), ...(playerState.battleStats || {}) };
    next.current = {
      ...current,
      job: resolvedJob || current.job || null,
    };
  }

  writeStoredPlayerValue(email, next);
}

function upsertMirroredAccount(user, password, playerState) {
  const email = normalizeEmail(user.email);
  const existingAccounts = ensureAccounts();
  const existingAccount = existingAccounts[email];

  const updatedAccount = {
    email,
    password: password || existingAccount?.password || "",
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    publicId: user.publicId,
    internalPlayerId: user.internalPlayerId,
  };

  const updatedAccounts = {
    ...existingAccounts,
    [email]: updatedAccount,
  };

  writeAccounts(updatedAccounts);
  mirrorPlayerStateFromServer(email, user, playerState);
  return updatedAccount;
}

function createServerSessionState(email, serverSessionToken, sessionExpiresAt) {
  return {
    activeEmail: normalizeEmail(email),
    authSource: "server",
    serverSessionToken,
    sessionExpiresAt: sessionExpiresAt || null,
  };
}

function createLocalSessionState(email) {
  return {
    activeEmail: normalizeEmail(email),
    authSource: "local",
    serverSessionToken: null,
    sessionExpiresAt: null,
  };
}

async function requestJson(path, init = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof payload?.error === "string"
            ? payload.error
            : `Request failed (${response.status}).`,
        unavailable:
          response.status >= 500 ||
          response.status === 404 ||
          payload?.code === "DATABASE_UNAVAILABLE",
      };
    }

    return { ok: true, ...payload };
  } catch {
    return {
      ok: false,
      error: "Server unavailable. Falling back to local shard storage.",
      unavailable: true,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function registerWithServer(values) {
  return requestJson("/api/register", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

async function loginWithServer(values) {
  return requestJson("/api/login", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

function registerLocally(values) {
  const existing = ensureAccounts();
  if (existing[values.email]) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const identity = allocatePlayerIdentity(existing);
  const account = {
    email: values.email,
    password: values.password,
    firstName: values.firstName,
    lastName: values.lastName,
    createdAt: Date.now(),
    publicId: identity.publicId,
    internalPlayerId: identity.internalPlayerId,
  };

  const updated = { ...existing, [values.email]: account };
  writeAccounts(updated);
  writeSession(createLocalSessionState(values.email));
  return { ok: true, account };
}

function loginLocally(values) {
  const existing = ensureAccounts();
  const account = existing[values.email];

  if (!account) {
    return { ok: false, error: "No account found with that email." };
  }

  if (account.password !== values.password) {
    return { ok: false, error: "Incorrect password." };
  }

  writeSession(createLocalSessionState(values.email));
  return { ok: true, account };
}

function redirectIntoApp() {
  window.location.assign("/home");
}

async function submitRegister(values) {
  const serverResult = await registerWithServer(values);
  if (serverResult.ok) {
    const account = upsertMirroredAccount(serverResult.user, values.password, serverResult.playerState);
    writeSession(
      createServerSessionState(
        serverResult.user.email,
        serverResult.sessionToken,
        serverResult.sessionExpiresAt,
      ),
    );
    return { ok: true, account };
  }

  if (!serverResult.unavailable) {
    return serverResult;
  }

  return registerLocally(values);
}

async function submitLogin(values) {
  const existingLocalAccount = ensureAccounts()[values.email];
  const serverResult = await loginWithServer(values);

  if (serverResult.ok) {
    const account = upsertMirroredAccount(serverResult.user, values.password, serverResult.playerState);
    writeSession(
      createServerSessionState(
        serverResult.user.email,
        serverResult.sessionToken,
        serverResult.sessionExpiresAt,
      ),
    );
    return { ok: true, account };
  }

  if (serverResult.error === "No account found with that email." && existingLocalAccount && existingLocalAccount.password === values.password) {
    const migrationResult = await registerWithServer({
      firstName: existingLocalAccount.firstName,
      lastName: existingLocalAccount.lastName,
      email: existingLocalAccount.email,
      password: existingLocalAccount.password,
      existingPublicId: existingLocalAccount.publicId,
    });

    if (migrationResult.ok) {
      const account = upsertMirroredAccount(
        migrationResult.user,
        existingLocalAccount.password,
        migrationResult.playerState,
      );
      writeSession(
        createServerSessionState(
          migrationResult.user.email,
          migrationResult.sessionToken,
          migrationResult.sessionExpiresAt,
        ),
      );
      return { ok: true, account };
    }

    if (!migrationResult.unavailable) {
      return migrationResult;
    }
  }

  if (!serverResult.unavailable) {
    return serverResult;
  }

  return loginLocally(values);
}

function setButtonBusy(form, isBusy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent || "";
  }
  button.disabled = isBusy;
  button.textContent = isBusy ? label : button.dataset.originalLabel;
}

function bindRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(form);
    clearStatus();

    const data = new FormData(form);
    const values = {
      firstName: String(data.get("firstName") || "").trim(),
      lastName: String(data.get("lastName") || "").trim(),
      email: normalizeEmail(data.get("email") || ""),
      password: String(data.get("password") || ""),
      confirmPassword: String(data.get("confirmPassword") || ""),
    };

    const errors = {
      firstName: validateName(values.firstName, "First name"),
      lastName: validateName(values.lastName, "Last name"),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirmPassword: values.password === values.confirmPassword ? "" : "Passwords do not match.",
    };

    let hasErrors = false;
    Object.entries(errors).forEach(([name, message]) => {
      if (message) hasErrors = true;
      setFieldError(name, message);
    });

    if (hasErrors) {
      setStatus("Please correct the highlighted fields before continuing.", "error");
      return;
    }

    setButtonBusy(form, true, "Creating Account...");

    try {
      const result = await submitRegister(values);
      if (!result.ok) {
        setStatus(result.error || "Unable to create your account right now.", "error");
        return;
      }

      setStatus(
        `Account created. Citizen ${formatPlayerPublicId(result.account.publicId)} is entering the shard...`,
        "success",
      );
      window.setTimeout(redirectIntoApp, 250);
    } finally {
      setButtonBusy(form, false, "");
    }
  });
}

function bindLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(form);
    clearStatus();

    const data = new FormData(form);
    const values = {
      email: normalizeEmail(data.get("email") || ""),
      password: String(data.get("password") || ""),
    };

    const emailError = validateEmail(values.email);
    const passwordError = values.password ? "" : "Password is required.";
    setFieldError("email", emailError);
    setFieldError("password", passwordError);

    if (emailError || passwordError) {
      setStatus("Please correct the highlighted fields before continuing.", "error");
      return;
    }

    setButtonBusy(form, true, "Entering Nexis...");

    try {
      const result = await submitLogin(values);
      if (!result.ok) {
        setStatus(result.error || "Unable to sign in right now.", "error");
        return;
      }

      setStatus(
        `Citizen ${formatPlayerPublicId(result.account.publicId)} authenticated. Entering Nexis...`,
        "success",
      );
      window.setTimeout(redirectIntoApp, 250);
    } finally {
      setButtonBusy(form, false, "");
    }
  });
}

function redirectAuthenticatedVisitors() {
  const accounts = ensureAccounts();
  const session = readSession();

  if (!session.activeEmail) return;
  if (!accounts[session.activeEmail]) return;

  const page = document.body.dataset.page;
  if (page === "login" || page === "register") {
    redirectIntoApp();
  }
}

async function loadPendingRankings() {
  const playerRoot = document.getElementById("player-rankings");
  const guildRoot = document.getElementById("guild-rankings");
  const consortiumRoot = document.getElementById("consortium-rankings");
  const playerStatus = document.getElementById("player-rankings-status");
  const guildStatus = document.getElementById("guild-rankings-status");
  const consortiumStatus = document.getElementById("consortium-rankings-status");

  if (!playerRoot || !guildRoot || !consortiumRoot || document.body.dataset.page !== "home") return;

  const renderPendingCard = (title, note) => `
    <article class="ranking-card ranking-card--loading">
      <span class="ranking-card__rank">--</span>
      <div class="ranking-card__body">
        <strong>${title}</strong>
        <p class="ranking-card__note">${note}</p>
      </div>
    </article>
  `;

  const renderPlayerEntries = (entries) =>
    entries
      .map((entry) => {
        const publicId = formatPlayerPublicId(entry.publicId);
        return `
          <article class="ranking-card">
            <span class="ranking-card__rank">#${entry.rank}</span>
            <div class="ranking-card__body">
              <strong>${entry.name} [${publicId}]</strong>
              <span class="ranking-card__meta">${entry.pendingTitle}</span>
              <div class="ranking-card__stats">
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Level</span>
                  <strong>${entry.level}</strong>
                </div>
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Battle Scan</span>
                  <strong>${entry.battleScore}</strong>
                </div>
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Working Scan</span>
                  <strong>${entry.workingScore}</strong>
                </div>
              </div>
              <p class="ranking-card__note">${entry.summary}</p>
            </div>
          </article>
        `;
      })
      .join("");

  const renderPlayerBoards = (boards) =>
    boards
      .map((board) => `
        <section class="ranking-subboard">
          <div class="ranking-subboard__head">
            <span class="ranking-subboard__title">${board.title}</span>
            <span class="ranking-subboard__meta">${board.metricLabel}</span>
          </div>
          <div class="rankings-grid">
            ${board.entries.length
              ? renderPlayerEntries(board.entries)
              : renderPendingCard("Pending", `No ${board.title.toLowerCase()} ladder yet.`)}
          </div>
        </section>
      `)
      .join("");

  const renderGuildEntries = (entries) =>
    entries
      .map((entry) => {
        const publicId = entry.publicId ? `G${String(entry.publicId).padStart(7, "0")}` : "Pending";
        const tagText = entry.tag ? `[${entry.tag}]` : "Charter";
        return `
          <article class="ranking-card">
            <span class="ranking-card__rank">#${entry.rank}</span>
            <div class="ranking-card__body">
              <strong>${entry.name} ${tagText}</strong>
              <span class="ranking-card__meta">${publicId}</span>
              <div class="ranking-card__stats">
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Reputation</span>
                  <strong>${entry.reputationTotal}</strong>
                </div>
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Members</span>
                  <strong>${entry.memberCount}</strong>
                </div>
              </div>
              <p class="ranking-card__note">${entry.summary}</p>
            </div>
          </article>
        `;
      })
      .join("");

  const renderConsortiumEntries = (entries) =>
    entries
      .map((entry) => {
        const publicId = entry.publicId ? `C${String(entry.publicId).padStart(7, "0")}` : "Pending";
        return `
          <article class="ranking-card">
            <span class="ranking-card__rank">#${entry.rank}</span>
            <div class="ranking-card__body">
              <strong>${entry.name}</strong>
              <span class="ranking-card__meta">${entry.consortiumTypeName} - ${publicId}</span>
              <div class="ranking-card__stats">
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Earnings</span>
                  <strong>${entry.earningsTotal}</strong>
                </div>
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Stars</span>
                  <strong>${entry.stars}</strong>
                </div>
                <div class="ranking-card__stat">
                  <span class="ranking-card__stat-label">Employees</span>
                  <strong>${entry.memberCount}</strong>
                </div>
              </div>
              <p class="ranking-card__note">${entry.summary}</p>
            </div>
          </article>
        `;
      })
      .join("");

  try {
    const response = await fetch("/api/site/rankings", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Ranking feed unavailable.");
    }

    const payload = await response.json();
    const playerEntries = Array.isArray(payload?.playerRankings?.entries)
      ? payload.playerRankings.entries
      : Array.isArray(payload?.rankings)
        ? payload.rankings
        : [];
    const playerBoards = Array.isArray(payload?.playerRankings?.boards)
      ? payload.playerRankings.boards
      : [];
    const guildEntries = Array.isArray(payload?.guildRankings?.entries) ? payload.guildRankings.entries : [];
    const consortiumEntries = Array.isArray(payload?.consortiumRankings?.entries) ? payload.consortiumRankings.entries : [];

    if (playerStatus) {
      playerStatus.textContent = payload?.playerRankings?.statusLabel || payload?.statusLabel || "Pending";
    }
    if (guildStatus) {
      guildStatus.textContent = payload?.guildRankings?.statusLabel || "Pending";
    }
    if (consortiumStatus) {
      consortiumStatus.textContent = payload?.consortiumRankings?.statusLabel || "Pending";
    }

    playerRoot.innerHTML = playerBoards.length
      ? renderPlayerBoards(playerBoards)
      : playerEntries.length
        ? renderPlayerEntries(playerEntries)
        : renderPendingCard(
            "Pending",
            "No public player ladder yet. The shard still needs actual citizens, not rehearsal props.",
          );

    guildRoot.innerHTML = guildEntries.length
      ? renderGuildEntries(guildEntries)
      : renderPendingCard(
          "Pending",
          "Guild standings will appear once charters start accumulating real reputation.",
        );

    consortiumRoot.innerHTML = consortiumEntries.length
      ? renderConsortiumEntries(consortiumEntries)
      : renderPendingCard(
          "Pending",
          "Consortium standings will appear once real companies start showing actual earnings.",
        );
  } catch (_error) {
    if (playerStatus) {
      playerStatus.textContent = "Pending";
    }
    if (guildStatus) {
      guildStatus.textContent = "Pending";
    }
    if (consortiumStatus) {
      consortiumStatus.textContent = "Pending";
    }

    playerRoot.innerHTML = renderPendingCard(
      "Pending",
      "The player ladder is offline for the moment, which is still more honest than hallucinating champions.",
    );
    guildRoot.innerHTML = renderPendingCard(
      "Pending",
      "The guild ledger is unavailable right now, so it stays pending instead of pretending.",
    );
    consortiumRoot.innerHTML = renderPendingCard(
      "Pending",
      "The consortium ledger is unavailable right now, so it stays pending instead of bluffing.",
    );
  }
}

bindRegisterForm();
bindLoginForm();
redirectAuthenticatedVisitors();
loadPendingRankings();
