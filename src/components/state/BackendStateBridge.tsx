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
    syncServerRuntimeState,
  } = useAuth();
  const lastSyncedPayload = useRef<string>("");

  const activeEmail = activeAccount?.email ?? null;
  const shouldSync = useMemo(
    () => authSource === "server" && Boolean(serverSessionToken) && Boolean(activeEmail),
    [activeEmail, authSource, serverSessionToken],
  );

  useEffect(() => {
    lastSyncedPayload.current = "";
  }, [activeEmail]);

  useEffect(() => {
    if (!shouldSync || !activeEmail) return undefined;

    const flushSnapshot = (keepalive = false) => {
      const nextSerialized = serializeSnapshot(activeEmail);
      if (nextSerialized === lastSyncedPayload.current) {
        return;
      }

      lastSyncedPayload.current = nextSerialized;
      const nextSnapshot = JSON.parse(nextSerialized) as ReturnType<typeof readCachedRuntimeState>;
      void syncServerRuntimeState(nextSnapshot, { keepalive });
    };

    const interval = window.setInterval(() => {
      flushSnapshot(false);
    }, 2000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSnapshot(true);
      }
    };

    const handlePageHide = () => {
      flushSnapshot(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [activeEmail, shouldSync, syncServerRuntimeState]);

  return null;
}
