import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import AppRouter from "./router";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { PlayerProvider } from "./state/PlayerContext";
import { EducationProvider } from "./state/EducationContext";
import { TimerProvider } from "./state/TimerContext";
import { JobsProvider } from "./state/JobsContext";
import { ArenaProvider } from "./state/ArenaContext";
import Ciel from "./components/ciel/Ciel";
import { BackendStateBridge } from "./components/state/BackendStateBridge";
import RouteTransitionQuote from "./components/layout/RouteTransitionQuote";

const PUBLIC_PATHS = new Set(["/login", "/register", "/news", "/rules", "/contact", "/credits"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (PUBLIC_PATHS.has(location.pathname)) {
    return <>{children}</>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ redirectedFrom: location.pathname }} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <TimerProvider>
          <JobsProvider>
            <ArenaProvider>
              <EducationProvider>
                <BackendStateBridge />
                <BrowserRouter>
                  <AuthGate>
                    <RouteTransitionQuote />
                    <AppRouter />
                    <Ciel />
                  </AuthGate>
                </BrowserRouter>
              </EducationProvider>
            </ArenaProvider>
          </JobsProvider>
        </TimerProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
