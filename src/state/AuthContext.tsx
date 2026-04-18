import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentServerUser,
  loginWithServer,
  registerWithServer,
  saveCurrentServerState,
  type ServerAuthUser,
  type ServerPlayerState,
} from "../lib/authApi";
import { allocatePlayerIdentity, migrateStoredAccountIdentities } from "../lib/publicIds";
import {
  mergeServerStateIntoCache,
  type CachedRuntimeState,
} from "../lib/runtimeStateCache";

export type NexisAccount = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  publicId: number;
  internalPlayerId: string;
  entityType: "player" | "npc" | "system" | "event";
  privilegeRole: "player" | "staff" | "admin";
};

type AuthSource = "local" | "server";

type AuthState = {
  activeEmail: string | null;
  authSource: AuthSource;
  serverSessionToken: string | null;
  sessionExpiresAt: string | null;
};

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthContextValue = {
  activeAccount: NexisAccount | null;
  isLoggedIn: boolean;
  authSource: AuthSource;
  serverSessionToken: string | null;
  sessionExpiresAt: string | null;
  serverHydrationVersion: number;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  syncServerRuntimeState: (runtimeState: CachedRuntimeState) => Promise<void>;
};

const ACCOUNTS_KEY = "nexis_accounts";
const SESSION_KEY = "nexis_auth_session";
const PLAYER_KEY = "nexis_player";

export function playerStorageKey(email: string): string {
  return `${PLAYER_KEY}__${email}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readAccounts(): Record<string, NexisAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, NexisAccount>) : {};
    const migrated = migrateStoredAccountIdentities(parsed);

    if (migrated.changed) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(migrated.accounts));
    }

    return migrated.accounts;
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, NexisAccount>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function normalizeSession(state: unknown): AuthState {
  if (!state || typeof state !== "object") {
    return {
      activeEmail: null,
      authSource: "local",
      serverSessionToken: null,
      sessionExpiresAt: null,
    };
  }

  const parsed = state as Partial<AuthState>;
  return {
    activeEmail: typeof parsed.activeEmail === "string" ? parsed.activeEmail : null,
    authSource: parsed.authSource === "server" ? "server" : "local",
    serverSessionToken:
      typeof parsed.serverSessionToken === "string" && parsed.serverSessionToken
        ? parsed.serverSessionToken
        : null,
    sessionExpiresAt:
      typeof parsed.sessionExpiresAt === "string" && parsed.sessionExpiresAt
        ? parsed.sessionExpiresAt
        : null,
  };
}

function readSession(): AuthState {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const session = normalizeSession(raw ? JSON.parse(raw) : null);
    if (
      session.authSource === "server" &&
      session.sessionExpiresAt &&
      Date.parse(session.sessionExpiresAt) <= Date.now()
    ) {
      const cleared = clearSessionState();
      localStorage.setItem(SESSION_KEY, JSON.stringify(cleared));
      return cleared;
    }
    return session;
  } catch {
    return normalizeSession(null);
  }
}

function writeSession(state: AuthState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function upsertMirroredAccount(
  user: ServerAuthUser,
  password: string | null,
  playerState: ServerPlayerState,
) {
  const email = normalizeEmail(user.email);
  const existingAccounts = readAccounts();
  const existingAccount = existingAccounts[email];

  const updatedAccount: NexisAccount = {
    email,
    password: password ?? existingAccount?.password ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    publicId: user.publicId,
    internalPlayerId: user.internalPlayerId,
    entityType: user.entityType,
    privilegeRole: user.privilegeRole,
  };

  const updatedAccounts = {
    ...existingAccounts,
    [email]: updatedAccount,
  };

  writeAccounts(updatedAccounts);
  mergeServerStateIntoCache({ email, user, playerState });
  return updatedAccounts;
}

function createServerSessionState(
  email: string,
  serverSessionToken: string,
  sessionExpiresAt: string | null,
): AuthState {
  return {
    activeEmail: normalizeEmail(email),
    authSource: "server",
    serverSessionToken,
    sessionExpiresAt,
  };
}

function createLocalSessionState(email: string): AuthState {
  return {
    activeEmail: normalizeEmail(email),
    authSource: "local",
    serverSessionToken: null,
    sessionExpiresAt: null,
  };
}

function clearSessionState(): AuthState {
  return {
    activeEmail: null,
    authSource: "local",
    serverSessionToken: null,
    sessionExpiresAt: null,
  };
}

function registerLocally(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): {
  result: AuthResult;
  accounts: Record<string, NexisAccount>;
  session: AuthState;
} {
  const email = normalizeEmail(data.email);
  const existing = readAccounts();

  if (existing[email]) {
    return {
      result: { ok: false, error: "An account with this email already exists." },
      accounts: existing,
      session: readSession(),
    };
  }

  const identity = allocatePlayerIdentity(Object.values(existing));
  const account: NexisAccount = {
    email,
    password: data.password,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    createdAt: Date.now(),
    publicId: identity.publicId,
    internalPlayerId: identity.internalPlayerId,
    entityType: "player",
    privilegeRole: "player",
  };

  const updatedAccounts = { ...existing, [email]: account };
  writeAccounts(updatedAccounts);
  const newSession = createLocalSessionState(email);
  writeSession(newSession);

  return {
    result: { ok: true },
    accounts: updatedAccounts,
    session: newSession,
  };
}

function loginLocally(email: string, password: string): {
  result: AuthResult;
  accounts: Record<string, NexisAccount>;
  session: AuthState;
} {
  const normalizedEmail = normalizeEmail(email);
  const existing = readAccounts();
  const account = existing[normalizedEmail];

  if (!account) {
    return {
      result: { ok: false, error: "No account found with that email." },
      accounts: existing,
      session: readSession(),
    };
  }

  if (account.password !== password) {
    return {
      result: { ok: false, error: "Incorrect password." },
      accounts: existing,
      session: readSession(),
    };
  }

  const newSession = createLocalSessionState(normalizedEmail);
  writeSession(newSession);

  return {
    result: { ok: true },
    accounts: existing,
    session: newSession,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthState>(readSession);
  const [accounts, setAccounts] = useState<Record<string, NexisAccount>>(readAccounts);
  const [serverHydrationVersion, setServerHydrationVersion] = useState(0);

  const activeAccount = session.activeEmail ? accounts[session.activeEmail] ?? null : null;

  useEffect(() => {
    function syncFromStorage(event: StorageEvent) {
      if (event.key === ACCOUNTS_KEY) {
        setAccounts(readAccounts());
      }
      if (event.key === SESSION_KEY) {
        setSession(readSession());
      }
    }

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateServerSession() {
      if (
        session.authSource !== "server" ||
        !session.serverSessionToken ||
        !session.activeEmail
      ) {
        return;
      }

      if (
        session.sessionExpiresAt &&
        Date.parse(session.sessionExpiresAt) <= Date.now()
      ) {
        const nextSession = clearSessionState();
        writeSession(nextSession);
        setSession(nextSession);
        return;
      }

      const result = await getCurrentServerUser(session.serverSessionToken);
      if (cancelled) return;

      if (result.ok) {
        const updatedAccounts = upsertMirroredAccount(
          result.user,
          readAccounts()[normalizeEmail(result.user.email)]?.password ?? null,
          result.playerState,
        );
        setAccounts(updatedAccounts);
        setServerHydrationVersion((value) => value + 1);

        const normalizedEmail = normalizeEmail(result.user.email);
        if (normalizedEmail !== session.activeEmail) {
          const nextSession = {
            ...session,
            activeEmail: normalizedEmail,
          };
          writeSession(nextSession);
          setSession(nextSession);
        }
        return;
      }

      if (result.unavailable) {
        return;
      }

      const nextSession = clearSessionState();
      writeSession(nextSession);
      setSession(nextSession);
    }

    void hydrateServerSession();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const register = useCallback(
    async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }): Promise<AuthResult> => {
      const normalizedEmail = normalizeEmail(data.email);
      const existingLocalAccount = readAccounts()[normalizedEmail];
      if (existingLocalAccount) {
        return { ok: false, error: "An account with this email already exists." };
      }

      const serverResult = await registerWithServer({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: normalizedEmail,
        password: data.password,
      });

      if (serverResult.ok) {
        const updatedAccounts = upsertMirroredAccount(
          serverResult.user,
          data.password,
          serverResult.playerState,
        );
        const nextSession = createServerSessionState(
          serverResult.user.email,
          serverResult.sessionToken,
          serverResult.sessionExpiresAt,
        );

        writeSession(nextSession);
        setAccounts(updatedAccounts);
        setSession(nextSession);
        setServerHydrationVersion((value) => value + 1);
        return { ok: true };
      }

      if (!serverResult.unavailable) {
        return { ok: false, error: serverResult.error };
      }

      const fallback = registerLocally(data);
      setAccounts(fallback.accounts);
      setSession(fallback.session);
      return fallback.result;
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const normalizedEmail = normalizeEmail(email);
      const serverResult = await loginWithServer({
        email: normalizedEmail,
        password,
      });

      if (serverResult.ok) {
        const updatedAccounts = upsertMirroredAccount(
          serverResult.user,
          password,
          serverResult.playerState,
        );
        const nextSession = createServerSessionState(
          serverResult.user.email,
          serverResult.sessionToken,
          serverResult.sessionExpiresAt,
        );

        writeSession(nextSession);
        setAccounts(updatedAccounts);
        setSession(nextSession);
        setServerHydrationVersion((value) => value + 1);
        return { ok: true };
      }

      const localAccount = readAccounts()[normalizedEmail];

      if (
        serverResult.code === "ACCOUNT_NOT_FOUND" &&
        localAccount &&
        localAccount.password === password
      ) {
        const migrationResult = await registerWithServer({
          firstName: localAccount.firstName,
          lastName: localAccount.lastName,
          email: localAccount.email,
          password: localAccount.password,
          existingPublicId: localAccount.publicId,
        });

        if (migrationResult.ok) {
          const updatedAccounts = upsertMirroredAccount(
            migrationResult.user,
            localAccount.password,
            migrationResult.playerState,
          );
          const nextSession = createServerSessionState(
            migrationResult.user.email,
            migrationResult.sessionToken,
            migrationResult.sessionExpiresAt,
          );

          writeSession(nextSession);
          setAccounts(updatedAccounts);
          setSession(nextSession);
          setServerHydrationVersion((value) => value + 1);
          return { ok: true };
        }

        if (migrationResult.unavailable) {
          const fallback = loginLocally(normalizedEmail, password);
          setAccounts(fallback.accounts);
          setSession(fallback.session);
          return fallback.result;
        }
      }

      if (!serverResult.unavailable) {
        return { ok: false, error: serverResult.error };
      }

      const fallback = loginLocally(normalizedEmail, password);
      setAccounts(fallback.accounts);
      setSession(fallback.session);
      return fallback.result;
    },
    [],
  );

  const logout = useCallback(() => {
    const newSession = clearSessionState();
    writeSession(newSession);
    setSession(newSession);
  }, []);

  const syncServerRuntimeState = useCallback(
    async (runtimeState: CachedRuntimeState) => {
      if (
        session.authSource !== "server" ||
        !session.serverSessionToken ||
        !session.activeEmail
      ) {
        return;
      }

      const result = await saveCurrentServerState(session.serverSessionToken, runtimeState);
      if (result.ok) {
        const account = accounts[session.activeEmail];
        if (account) {
          mergeServerStateIntoCache({
            email: account.email,
            user: {
              internalPlayerId: account.internalPlayerId,
              publicId: account.publicId,
              firstName: account.firstName,
              lastName: account.lastName,
            },
            playerState: result.playerState,
          });
        }
        return;
      }

      if (!result.unavailable && result.status === 401) {
        const nextSession = clearSessionState();
        writeSession(nextSession);
        setSession(nextSession);
      }
    },
    [accounts, session],
  );

  const value: AuthContextValue = {
    activeAccount,
    isLoggedIn: activeAccount !== null,
    authSource: session.authSource,
    serverSessionToken: session.serverSessionToken,
    sessionExpiresAt: session.sessionExpiresAt,
    serverHydrationVersion,
    register,
    login,
    logout,
    syncServerRuntimeState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
