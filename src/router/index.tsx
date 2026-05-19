import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RouteGuard from "../components/routing/RouteGuard";
import RegisterPage from "../pages/Register";
import ForgotPasswordPage from "../pages/ForgotPassword";
import ResetPasswordPage from "../pages/ResetPassword";
import NewsPage from "../pages/News";
import RulesPage from "../pages/Rules";
import ContactPage from "../pages/Contact";
import CreditsPage from "../pages/Credits";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { getProfileRoute } from "../lib/publicIds";
import { getCurrentServerUser } from "../lib/authApi";

import HomePage from "../pages/Home";
import EducationPage from "../pages/Education";
import JobsPage from "../pages/Jobs";
import TravelPage from "../pages/Travel";
import AcademiesPage from "../pages/Academies";
import MarketPage from "../pages/Market";
import HousingPage from "../pages/Housing";
import SkillsPage from "../pages/Skills";
import LifePathsPage from "../pages/LifePaths";
import CityBoardPage from "../pages/CityBoard";
import ProfilePage from "../pages/Profile";
import AchievementsPage from "../pages/Achievements";
import BlackMarketPage from "../pages/BlackMarket";
import BankPage from "../pages/Bank";
import GuildsPage from "../pages/Guilds";
import ConsortiumsPage from "../pages/Consortiums";
import AdminPage from "../pages/Admin";
import HospitalPage from "../pages/Hospital";
import TavernPage from "../pages/Tavern";
import CityPage from "../pages/City";
import InventoryPage from "../pages/Inventory";
import CraftingPage from "../pages/Crafting";
import ArenaPage from "../pages/Arena";
import CivicJobsV2Page from "../pages/CivicJobsV2";
import SalvageYardPage from "../pages/SalvageYard";
import WorldMapPage from "../pages/WorldMap";
import PropertyOfficePage from "../pages/PropertyOffice";

function readStoredSessionProfilePublicId() {
  if (typeof window === "undefined") return null;

  try {
    const rawSession = window.localStorage.getItem("nexis_auth_session");
    const rawAccounts = window.localStorage.getItem("nexis_accounts");
    if (!rawSession || !rawAccounts) return null;

    const session = JSON.parse(rawSession) as { activeEmail?: string | null };
    const accounts = JSON.parse(rawAccounts) as Record<string, { publicId?: number | null }>;
    const activeEmail = typeof session.activeEmail === "string" ? session.activeEmail.trim().toLowerCase() : null;
    const publicId = activeEmail ? accounts[activeEmail]?.publicId : null;

    return typeof publicId === "number" && Number.isInteger(publicId) && publicId > 0 ? publicId : null;
  } catch {
    return null;
  }
}

function RootEntry() {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn) {
    return <Navigate to="/home" replace />;
  }

  return <NewsPage />;
}

function OwnProfileRedirect() {
  const { player } = usePlayer();
  const { activeAccount, serverSessionToken } = useAuth();
  const [resolvedPublicId, setResolvedPublicId] = useState<number | null>(() => {
    const immediatePublicId = activeAccount?.publicId ?? readStoredSessionProfilePublicId();
    return typeof immediatePublicId === "number" && immediatePublicId > 0 ? immediatePublicId : null;
  });
  const [resolving, setResolving] = useState<boolean>(() => !activeAccount?.publicId && Boolean(serverSessionToken));

  useEffect(() => {
    let cancelled = false;

    async function resolveOwnProfile() {
      if (activeAccount?.publicId) {
        setResolvedPublicId(activeAccount.publicId);
        setResolving(false);
        return;
      }

      const storedPublicId = readStoredSessionProfilePublicId();
      if (storedPublicId) {
        setResolvedPublicId(storedPublicId);
      }

      if (!serverSessionToken) {
        setResolvedPublicId(typeof player.publicId === "number" ? player.publicId : null);
        setResolving(false);
        return;
      }

      const result = await getCurrentServerUser(serverSessionToken);
      if (cancelled) return;

      if ("ok" in result && result.ok && typeof result.user.publicId === "number" && result.user.publicId > 0) {
        setResolvedPublicId(result.user.publicId);
      } else if (storedPublicId) {
        setResolvedPublicId(storedPublicId);
      } else {
        setResolvedPublicId(typeof player.publicId === "number" ? player.publicId : null);
      }
      setResolving(false);
    }

    void resolveOwnProfile();
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.publicId, player.publicId, serverSessionToken]);

  if (resolving) {
    return null;
  }

  const targetRoute = getProfileRoute(resolvedPublicId);
  return <Navigate to={targetRoute === "/profile" ? "/home" : targetRoute} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage initialMode="register" />} />
      <Route path="/login" element={<RegisterPage initialMode="login" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/credits" element={<CreditsPage />} />

      <Route path="/" element={<RootEntry />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/crafting" element={<RouteGuard><CraftingPage /></RouteGuard>} />
      <Route path="/profile" element={<OwnProfileRedirect />} />
      <Route path="/profile/:publicId" element={<ProfilePage />} />
      <Route path="/profiles/:publicId" element={<ProfilePage />} />
      <Route path="/profiles" element={<Navigate to="/profile" replace />} />
      <Route path="/achievements" element={<AchievementsPage />} />
      <Route path="/housing" element={<HousingPage />} />
      <Route path="/guild" element={<Navigate to="/guilds" replace />} />
      <Route path="/guild/:publicId" element={<RouteGuard><GuildsPage /></RouteGuard>} />
      <Route path="/guilds" element={<RouteGuard><GuildsPage /></RouteGuard>} />
      <Route path="/guilds/:publicId" element={<RouteGuard><GuildsPage /></RouteGuard>} />
      <Route path="/consortiums" element={<RouteGuard><ConsortiumsPage /></RouteGuard>} />
      <Route path="/consortiums/:publicId" element={<RouteGuard><ConsortiumsPage /></RouteGuard>} />
      <Route path="/admin" element={<RouteGuard><AdminPage /></RouteGuard>} />
      <Route path="/hospital" element={<HospitalPage />} />
      <Route path="/jail" element={<HospitalPage />} />
      <Route path="/salvage-yard" element={<RouteGuard><SalvageYardPage /></RouteGuard>} />
      <Route path="/city-board" element={<CityBoardPage />} />
      <Route path="/skills" element={<SkillsPage />} />
      <Route path="/tavern" element={<TavernPage />} />

      <Route path="/education" element={<RouteGuard><EducationPage /></RouteGuard>} />
      <Route path="/adventure" element={<RouteGuard><JobsPage /></RouteGuard>} />
      <Route path="/jobs" element={<Navigate to="/adventure" replace />} />
      <Route path="/civic-jobs" element={<RouteGuard><CivicJobsV2Page /></RouteGuard>} />
      <Route path="/arena" element={<RouteGuard><ArenaPage /></RouteGuard>} />
      <Route path="/travel" element={<RouteGuard><TravelPage /></RouteGuard>} />
      <Route path="/world-map" element={<RouteGuard><WorldMapPage /></RouteGuard>} />
      <Route path="/maps/:mapId" element={<RouteGuard><WorldMapPage /></RouteGuard>} />
      <Route path="/city" element={<RouteGuard><CityPage /></RouteGuard>} />
      <Route path="/city/property-office" element={<RouteGuard><PropertyOfficePage /></RouteGuard>} />
      <Route path="/city/academy" element={<RouteGuard><Navigate to="/education" replace /></RouteGuard>} />
      <Route path="/market" element={<RouteGuard><MarketPage /></RouteGuard>} />
      <Route path="/black-market" element={<RouteGuard><BlackMarketPage /></RouteGuard>} />
      <Route path="/bank" element={<RouteGuard><BankPage /></RouteGuard>} />
      <Route path="/academies" element={<RouteGuard><AcademiesPage /></RouteGuard>} />
      <Route path="/life-paths" element={<RouteGuard><LifePathsPage /></RouteGuard>} />
    </Routes>
  );
}
