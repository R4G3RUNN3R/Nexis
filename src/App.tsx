import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import AppRouter from "./router";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { PlayerProvider, usePlayer } from "./state/PlayerContext";
import { AdminModeProvider } from "./state/AdminModeContext";
import { OrgAdvancedModeProvider } from "./state/OrgAdvancedModeContext";
import { EducationProvider } from "./state/EducationContext";
import { TimerProvider } from "./state/TimerContext";
import { JobsProvider } from "./state/JobsContext";
import { ArenaProvider } from "./state/ArenaContext";
import { BackendStateBridge } from "./components/state/BackendStateBridge";
import Ciel from "./components/ciel/Ciel";
import RouteTransitionQuote from "./components/layout/RouteTransitionQuote";
import { shouldShowCielIntro } from "./lib/cielTutorialState";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/news",
  "/rules",
  "/contact",
  "/credits",
]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { activeAccount, isLoggedIn } = useAuth();
  const { player } = usePlayer();
  const location = useLocation();

  if (PUBLIC_PATHS.has(location.pathname)) {
    return <>{children}</>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ redirectedFrom: location.pathname }} />;
  }

  const isCielIntro = location.pathname === "/ciel-intro";
  const accountCreatedAt = activeAccount?.createdAt;
  const createdAtMs = typeof accountCreatedAt === "number"
    ? accountCreatedAt
    : typeof accountCreatedAt === "string"
      ? Date.parse(accountCreatedAt)
      : NaN;
  const freshAccount = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 24 * 60 * 60 * 1000;
  const explicitlyRequestedIntro = new URLSearchParams(location.search).get("ciel") === "intro";

  if (!isCielIntro && shouldShowCielIntro(player) && (freshAccount || explicitlyRequestedIntro)) {
    const afterTutorial = `${location.pathname}${location.search}${location.hash}` || "/home";
    return <Navigate to="/ciel-intro" replace state={{ afterTutorial }} />;
  }

  return (
    <>
      {isCielIntro ? null : <RouteTransitionQuote />}
      {children}
      {isCielIntro ? null : <Ciel />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <AdminModeProvider>
          <OrgAdvancedModeProvider>
            <TimerProvider>
              <JobsProvider>
                <ArenaProvider>
                  <EducationProvider>
                    <BackendStateBridge />
                    <BrowserRouter>
                      <AuthGate>
                        <AppRouter />
                      </AuthGate>
                    </BrowserRouter>
                  </EducationProvider>
                </ArenaProvider>
              </JobsProvider>
            </TimerProvider>
          </OrgAdvancedModeProvider>
        </AdminModeProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
