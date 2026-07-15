// ─────────────────────────────────────────────────────────────────────────────
// Nexis — AdminModeContext
//
// "Admin Mode" is a pure client-side UI convenience: it only decides whether
// compact inline admin buttons are rendered next to bars/gold/condition
// displays throughout the app. It is NEVER consulted for authorization.
//
// Every action those buttons trigger calls the same server-authorized
// /api/admin/players/:targetInternalId/actions endpoint used by the full
// Admin Panel (src/pages/Admin.tsx), which independently re-verifies the
// caller's privilegeRole on every request via assertStaffOrAdmin /
// assertAdminActionAllowed (see server/services/adminService.js and
// server/lib/adminActionPolicy.js). A forged request from a non-admin
// session is rejected there regardless of what this context's state says.
//
// Visibility of the toggle itself is gated by `isAdministrator`, which is
// derived the same way the rest of the app already determines admin status
// (src/lib/adminAccess.ts, mirroring server/lib/adminAccess.js) from the
// user's `privilegeRole` as returned by the server (AuthContext's
// activeAccount, sourced from /api/me and /api/login /api/register).
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { usePlayer } from "./PlayerContext";
import { isAdministrator as checkIsAdministrator } from "../lib/adminAccess";

const ADMIN_MODE_STORAGE_KEY = "nexis_admin_mode_enabled";

type AdminModeContextValue = {
  /** True when the server says this account's privilegeRole is "admin". */
  isAdministrator: boolean;
  /** True only when isAdministrator AND the user has flipped the toggle on. */
  adminModeEnabled: boolean;
  setAdminModeEnabled: (enabled: boolean) => void;
  toggleAdminMode: () => void;
};

const AdminModeContext = createContext<AdminModeContextValue | null>(null);

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const { activeAccount } = useAuth();
  const { player } = usePlayer();
  const [storedPreference, setStoredPreference] = useState<boolean>(readStoredPreference);

  const administrator = checkIsAdministrator({
    publicId: activeAccount?.publicId ?? player.publicId ?? undefined,
    privilegeRole: activeAccount?.privilegeRole ?? "player",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, storedPreference ? "1" : "0");
    } catch {
      // Ignore storage failures (private browsing, quota, etc.) — the toggle
      // just won't persist across reloads, which is harmless.
    }
  }, [storedPreference]);

  const setAdminModeEnabled = useCallback((enabled: boolean) => {
    setStoredPreference(enabled);
  }, []);

  const toggleAdminMode = useCallback(() => {
    setStoredPreference((value) => !value);
  }, []);

  // Non-admins never see admin-mode UI, even if a stale "1" is sitting in
  // localStorage from a previous admin session on a shared browser.
  const adminModeEnabled = administrator && storedPreference;

  const value: AdminModeContextValue = {
    isAdministrator: administrator,
    adminModeEnabled,
    setAdminModeEnabled,
    toggleAdminMode,
  };

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode(): AdminModeContextValue {
  const context = useContext(AdminModeContext);
  if (!context) throw new Error("useAdminMode must be used within an AdminModeProvider");
  return context;
}
