import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentServerUser,
  loginWithServer,
  registerWithServer,
  saveCurrentServerState,
  type ServerAuthUser,
  type ServerPlayerState,
} from "../lib/authApi";
import { migrateStoredAccountIdentities } from "../lib/publicIds";
import {
  mergeServerStateIntoCache,
  readCachedRuntimeState,
  type CachedRuntimeState,
} from "../lib/runtimeStateCache";

export type NexisAccount = {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  publicId: number;
  internalPlayerId: string;
  entityType?: ServerAuthUser["entityType"];
  privilegeRole?: ServerAuthUser["privilegeRole"];
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
  syncServerRuntimeState: (
    runtimeState: CachedRuntimeState,
    options?: { keepalive?: boolean },
  ) => Promise<void>;
  refreshServerState: () => Promise<void>;
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
  _password: string | null,
  playerState: ServerPlayerState,
) {
  const email = normalizeEmail(user.email);
  const existingAccounts = readAccounts();

  const updatedAccount: NexisAccount = {
    email,
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

function clearSessionState(): AuthState {
  return {
    activeEmail: null,
    authSource: "local",
    serverSessionToken: null,
    sessionExpiresAt: null,
  };
}

function sanitizeRuntimeStateForServer(runtimeState: CachedRuntimeState): CachedRuntimeState {
  const player = runtimeState.player && typeof runtimeState.player === "object" ? { ...runtimeState.player } : {};
  const current =
    player.current && typeof player.current === "object" && !Array.isArray(player.current)
      ? { ...player.current as Record<string, unknown> }
      : {};
  delete current.travel;
  delete current.currentCityId;
  delete player.portrait;
  delete player.guild;
  delete player.consortium;
  player.current = current;

  return {
    ...runtimeState,
    player,
    travel: {},
    civicEmployment: {},
    legacy: {},
    guild: {},
    consortium: {},
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
        const updatedAccounts = upsertMirroredAccount(result.user, null, result.playerState);
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

  useEffect(() => {
    if (
      session.authSource !== "server" ||
      !session.serverSessionToken ||
      !session.activeEmail
    ) {
      return undefined;
    }

    const poll = window.setInterval(async () => {
      const cached = readCachedRuntimeState(session.activeEmail!);
      const travel = cached.travel;
      const shouldPollAggressively =
        travel &&
        typeof travel === "object" &&
        travel.status === "in_transit";

      if (!shouldPollAggressively) {
        return;
      }

      const result = await getCurrentServerUser(session.serverSessionToken!);
      if (!("ok" in result) || !result.ok) {
        return;
      }

      const updatedAccounts = upsertMirroredAccount(result.user, null, result.playerState);
      setAccounts(updatedAccounts);
      setServerHydrationVersion((value) => value + 1);
    }, 5000);

    return () => window.clearInterval(poll);
  }, [session.authSource, session.serverSessionToken, session.activeEmail]);

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
        const updatedAccounts = upsertMirroredAccount(serverResult.user, null, serverResult.playerState);
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

      return {
        ok: false,
        error: serverResult.unavailable
          ? "Registration service is unavailable right now. Your account was not created, which is annoying but better than inventing a split-brain save file."
          : serverResult.error,
      };
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
        const updatedAccounts = upsertMirroredAccount(serverResult.user, null, serverResult.playerState);
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
          const updatedAccounts = upsertMirroredAccount(migrationResult.user, null, migrationResult.playerState);
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
          return { ok: false, error: migrationResult.error };
        }
      }

      if (!serverResult.unavailable) {
        return { ok: false, error: serverResult.error };
      }

      return {
        ok: false,
        error: "Login service is unavailable right now. Nexis no longer falls back to local ghost accounts, because that is how progression gets mangled.",
      };
    },
    [],
  );

  const logout = useCallback(() => {
    const newSession = clearSessionState();
    writeSession(newSession);
    setSession(newSession);
  }, []);

  const syncServerRuntimeState = useCallback(
    async (
      runtimeState: CachedRuntimeState,
      options: { keepalive?: boolean } = {},
    ) => {
      if (
        session.authSource !== "server" ||
        !session.serverSessionToken ||
        !session.activeEmail
      ) {
        return;
      }

      const result = await saveCurrentServerState(
        session.serverSessionToken,
        sanitizeRuntimeStateForServer(runtimeState),
        options,
      );
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

  const refreshServerState = useCallback(async () => {
    if (
      session.authSource !== "server" ||
      !session.serverSessionToken ||
      !session.activeEmail
    ) {
      return;
    }

    const result = await getCurrentServerUser(session.serverSessionToken);
    if (result.ok) {
      const updatedAccounts = upsertMirroredAccount(result.user, null, result.playerState);
      setAccounts(updatedAccounts);
      setServerHydrationVersion((value) => value + 1);
      return;
    }

    if (!result.unavailable && result.status === 401) {
      const nextSession = clearSessionState();
      writeSession(nextSession);
      setSession(nextSession);
    }
  }, [session]);

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
    refreshServerState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
