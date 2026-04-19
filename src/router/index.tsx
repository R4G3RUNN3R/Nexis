import { Routes, Route, Navigate } from "react-router-dom";
import RouteGuard from "../components/routing/RouteGuard";
import RegisterPage from "../pages/Register";
import { usePlayer } from "../state/PlayerContext";
import { getProfileRoute } from "../lib/publicIds";

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
import GuildPage from "../pages/Guild";
import GuildsPage from "../pages/Guilds";
import ConsortiumsPage from "../pages/Consortiums";
import HospitalPage from "../pages/Hospital";
import TavernPage from "../pages/Tavern";
import CityPage from "../pages/City";
import InventoryPage from "../pages/Inventory";
import ArenaPage from "../pages/Arena";
import CivicJobsV2Page from "../pages/CivicJobsV2";
import NewsPage from "../pages/News";
import RulesPage from "../pages/Rules";
import ContactPage from "../pages/Contact";
import CreditsPage from "../pages/Credits";

function OwnProfileRedirect() {
  const { player } = usePlayer();
  return <Navigate to={getProfileRoute(player.publicId)} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage initialMode="register" />} />
      <Route path="/login" element={<RegisterPage initialMode="login" />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/credits" element={<CreditsPage />} />

      <Route path="/" element={<HomePage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/profile" element={<OwnProfileRedirect />} />
      <Route path="/profile/:publicId" element={<ProfilePage />} />
      <Route path="/profiles/:publicId" element={<ProfilePage />} />
      <Route path="/profiles" element={<Navigate to="/profile" replace />} />
      <Route path="/achievements" element={<AchievementsPage />} />
      <Route path="/housing" element={<HousingPage />} />
      <Route path="/guild" element={<GuildPage />} />
      <Route path="/guilds" element={<RouteGuard><GuildsPage /></RouteGuard>} />
      <Route path="/consortiums" element={<RouteGuard><ConsortiumsPage /></RouteGuard>} />
      <Route path="/hospital" element={<HospitalPage />} />
      <Route path="/city-board" element={<CityBoardPage />} />
      <Route path="/skills" element={<SkillsPage />} />
      <Route path="/tavern" element={<TavernPage />} />

      <Route path="/education" element={<RouteGuard><EducationPage /></RouteGuard>} />
      <Route path="/adventure" element={<RouteGuard><JobsPage /></RouteGuard>} />
      <Route path="/jobs" element={<Navigate to="/adventure" replace />} />
      <Route path="/civic-jobs" element={<RouteGuard><CivicJobsV2Page /></RouteGuard>} />
      <Route path="/arena" element={<RouteGuard><ArenaPage /></RouteGuard>} />
      <Route path="/travel" element={<RouteGuard><TravelPage /></RouteGuard>} />
      <Route path="/city" element={<RouteGuard><CityPage /></RouteGuard>} />
      <Route path="/market" element={<RouteGuard><MarketPage /></RouteGuard>} />
      <Route path="/black-market" element={<RouteGuard><BlackMarketPage /></RouteGuard>} />
      <Route path="/bank" element={<RouteGuard><BankPage /></RouteGuard>} />
      <Route path="/academies" element={<RouteGuard><AcademiesPage /></RouteGuard>} />
      <Route path="/life-paths" element={<RouteGuard><LifePathsPage /></RouteGuard>} />
    </Routes>
  );
}
