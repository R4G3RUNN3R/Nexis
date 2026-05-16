import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useMemo } from "react";
import { TopBar } from "./TopBar";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { StatBars } from "./StatBars";
import { formatPlayerNameWithPublicId, getProfileRoute } from "../../lib/publicIds";
import { resolveDisplayTitle } from "../../lib/titleAccess";
import { getCityName, getTravelProgress, readTravelStateFromPlayer } from "../../lib/travelState";
import { isStaffOrAdmin } from "../../lib/adminAccess";
import { cielLoadingQuotes } from "../../data/cielPageCopy";

type AppShellProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
};

const core: Array<[string, string]> = [
  ["Home", "/home"],
  ["Profile", "/profile"],
  ["Inventory", "/inventory"],
  ["Education", "/education"],
  ["Adventure", "/adventure"],
  ["Housing", "/housing"],
];

const world: Array<[string, string]> = [
  ["City", "/city"],
  ["Civic Jobs", "/civic-jobs"],
  ["Travel", "/travel"],
  ["World Map", "/world-map"],
  ["Arena", "/arena"],
  ["City Board", "/city-board"],
  ["Hospital", "/hospital"],
];

const factions: Array<[string, string]> = [
  ["Guilds", "/guilds"],
  ["Consortiums", "/consortiums"],
];

const HOSPITAL_HIDDEN = new Set(["/education", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const JAIL_HIDDEN = new Set(["/education", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const TRAVEL_HIDDEN = new Set(["/education", "/adventure", "/arena", "/city", "/civic-jobs", "/guilds", "/consortiums", "/housing"]);

function SidebarSection({ title, links }: { title: string; links: Array<[string, string]> }) {
  if (!links.length) return null;

  return (
    <div className="sidebar-section">
      <div className="sidebar-section__title">{title}</div>
      <div className="sidebar-section__links">
        {links.map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/home"}
            className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--active" : ""}`}
          >
            <span>{label}</span>
            <span className="sidebar-link__arrow">{">"}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function formatGold(amount: number): string {
  return amount.toLocaleString("en-US") + " gp";
}

export function AppShell({ title, hint, children }: AppShellProps) {
  const { player, now, isHospitalized, hospitalRemainingLabel, isJailed, jailRemainingLabel } = usePlayer();
  const { activeAccount, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const travelState = readTravelStateFromPlayer(player);
  const isTraveling = getTravelProgress(travelState, now).active;
  const canAccessAdmin = isStaffOrAdmin({
    publicId: activeAccount?.publicId ?? player.publicId,
    privilegeRole: activeAccount?.privilegeRole ?? "player",
  });

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  let conditionLabel = "Normal";
  let conditionClass = "player-condition";
  if (isHospitalized) {
    conditionLabel = `Hospital | ${hospitalRemainingLabel}`;
    conditionClass = "player-condition player-condition--hospital";
  } else if (isJailed) {
    conditionLabel = `Jailed | ${jailRemainingLabel}`;
    conditionClass = "player-condition player-condition--jail";
  } else if (isTraveling) {
    conditionLabel = `Traveling | ${getCityName(travelState.destinationCityId)}`;
    conditionClass = "player-condition";
  }

  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayPublicId = activeAccount?.publicId ?? player.publicId;
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, displayPublicId);
  const profileRoute = getProfileRoute(displayPublicId);
  const displayTitle = resolveDisplayTitle(player.title, displayPublicId);
  const initials = `${player.name?.charAt(0) ?? "N"}${player.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const hiddenRoutes = useMemo(() => {
    if (isHospitalized) return HOSPITAL_HIDDEN;
    if (isJailed) return JAIL_HIDDEN;
    if (isTraveling) return TRAVEL_HIDDEN;
    return null;
  }, [isHospitalized, isJailed, isTraveling]);
  const quoteSeed = `${location.pathname}|${title ?? ""}`;
  const quoteIndex = Math.abs(Array.from(quoteSeed).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % cielLoadingQuotes.length;
  const shellQuote = cielLoadingQuotes[quoteIndex];
  const visibleCore = hiddenRoutes ? core.filter(([, route]) => !hiddenRoutes.has(route)) : core;
  const visibleWorld = hiddenRoutes ? world.filter(([, route]) => !hiddenRoutes.has(route)) : world;
  const visibleFactions = hiddenRoutes ? factions.filter(([, route]) => !hiddenRoutes.has(route)) : factions;
  const adminLinks = canAccessAdmin ? ([["Admin Panel", "/admin"]] as Array<[string, string]>) : [];
  const onProfileSurface =
    location.pathname === profileRoute ||
    location.pathname === "/profile" ||
    location.pathname.startsWith("/profile/");

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-main">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo__title">Nexis</div>
            <div className="sidebar-logo__subtitle">Citizen command</div>
          </div>

          <div className="player-card">
            <div className="player-card__crest">{initials}</div>

            <div className="player-card__identity">
              <div className="player-card__name">
                <span className="player-card__username">{displayNameWithPublicId}</span>
              </div>
              <div className="player-card__title">{displayTitle || "Untitled citizen"}</div>
            </div>

            <div className="player-card__rows">
              <div className="player-card__row">
                <span className="player-card__key">Level</span>
                <span className="player-card__val">{player.level}</span>
              </div>
              <div className="player-card__row">
                <span className="player-card__key">Title</span>
                <span className="player-card__val">{displayTitle}</span>
              </div>
              <div className="player-card__row">
                <span className="player-card__key">Days</span>
                <span className="player-card__val">{player.daysPlayed}</span>
              </div>
              <div className="player-card__row player-card__row--gold">
                <span className="player-card__key">Gold</span>
                <span className="player-card__val player-card__val--gold">{formatGold(player.gold)}</span>
              </div>
              <div className="player-card__row">
                <span className="player-card__key">Location</span>
                <span className="player-card__val">
                  {isTraveling ? `Caravan to ${getCityName(travelState.destinationCityId)}` : getCityName(travelState.currentCityId)}
                </span>
              </div>
            </div>

            <div className={conditionClass}>{conditionLabel}</div>
          </div>

          <StatBars />

          <div className="sidebar-quote-strip">
            <div className="sidebar-quote-strip__label">CIEL Feed</div>
            <div className="sidebar-quote-strip__text">{shellQuote}</div>
          </div>

          <SidebarSection title="Character" links={visibleCore.map(([label, route]) => [label, route === "/profile" ? profileRoute : route])} />
          <SidebarSection title="Realm" links={visibleWorld} />
          <SidebarSection title="Orders" links={visibleFactions} />
          <SidebarSection title="Authority" links={adminLinks} />

          <div className="sidebar-logout">
            <button type="button" className="sidebar-logout__btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </aside>

        <main className="content">
          {title ? (
            <div className="page-banner">
              <div className="page-banner__copy">
                <div className="page-banner__eyebrow">Nexis command surface</div>
                <div className="page-banner__title">{title}</div>
                {hint ? <div className="page-banner__hint">{hint}</div> : null}
              </div>
              <div className="page-banner__actions">
                {!onProfileSurface ? (
                  <NavLink to={profileRoute} className="page-banner__action">
                    Open profile
                  </NavLink>
                ) : null}
                {canAccessAdmin ? (
                  <NavLink to="/admin" className="page-banner__action page-banner__action--admin">
                    Control panel
                  </NavLink>
                ) : null}
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
