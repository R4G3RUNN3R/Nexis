// ─────────────────────────────────────────────────────────────────────────────
// Nexis — OrgAdvancedModeContext
//
// Shared "Advanced Mode" toggle for Guilds and Consortiums. Off by default so
// new members land on a short, approachable tab set (Headquarters/Overview,
// Members/Employees, day-to-day operations, settings). Toggling it on reveals
// the deeper systems (wars, specializations, armory, logistics, assets,
// advancement, base) for members who want that depth. No mechanics are
// removed - this only changes which tabs are shown by default.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useState } from "react";

const ORG_ADVANCED_MODE_STORAGE_KEY = "nexis_org_advanced_mode";

type OrgAdvancedModeContextValue = {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  toggleAdvancedMode: () => void;
};

const OrgAdvancedModeContext = createContext<OrgAdvancedModeContextValue | null>(null);

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ORG_ADVANCED_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function OrgAdvancedModeProvider({ children }: { children: React.ReactNode }) {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(readStoredPreference);

  const setAdvancedMode = useCallback((enabled: boolean) => {
    setAdvancedModeState(enabled);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ORG_ADVANCED_MODE_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures (private browsing, quota, etc.) - the toggle
      // just won't persist across reloads, which is harmless.
    }
  }, []);

  const toggleAdvancedMode = useCallback(() => {
    setAdvancedMode(!readStoredPreference());
  }, [setAdvancedMode]);

  const value: OrgAdvancedModeContextValue = { advancedMode, setAdvancedMode, toggleAdvancedMode };

  return <OrgAdvancedModeContext.Provider value={value}>{children}</OrgAdvancedModeContext.Provider>;
}

export function useOrgAdvancedMode(): OrgAdvancedModeContextValue {
  const context = useContext(OrgAdvancedModeContext);
  if (!context) throw new Error("useOrgAdvancedMode must be used within an OrgAdvancedModeProvider");
  return context;
}
