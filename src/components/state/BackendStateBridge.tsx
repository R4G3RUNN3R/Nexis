import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../state/AuthContext";
import { readCachedRuntimeState } from "../../lib/runtimeStateCache";

function serializeSnapshot(email: string) {
  return JSON.stringify(readCachedRuntimeState(email));
}

export function BackendStateBridge() {
  const {
    activeAccount,
    authSource,
    serverSessionToken,
    serverHydrationVersion,
    syncServerRuntimeState,
  } = useAuth();
  const lastSyncedPayload = useRef<string>("");

  const activeEmail = activeAccount?.email ?? null;
  const shouldSync = useMemo(
    () => authSource === "server" && Boolean(serverSessionToken) && Boolean(activeEmail),
    [activeEmail, authSource, serverSessionToken],
  );

  useEffect(() => {
    if (!activeEmail) {
      lastSyncedPayload.current = "";
      return;
    }

    lastSyncedPayload.current = "";
  }, [activeEmail, serverHydrationVersion]);

  useEffect(() => {
    if (!shouldSync || !activeEmail) return undefined;

    const interval = window.setInterval(() => {
      const nextSerialized = serializeSnapshot(activeEmail);
      if (nextSerialized === lastSyncedPayload.current) {
        return;
      }

      lastSyncedPayload.current = nextSerialized;
      const nextSnapshot = JSON.parse(nextSerialized) as ReturnType<typeof readCachedRuntimeState>;
      void syncServerRuntimeState(nextSnapshot);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activeEmail, shouldSync, syncServerRuntimeState]);

  return null;
}
