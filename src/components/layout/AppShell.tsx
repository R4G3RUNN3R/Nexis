import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useMemo, useState } from "react";
import { TopBar } from "./TopBar";
import { PlayerAvatar } from "../common/PlayerAvatar";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { StatBars } from "./StatBars";
import { formatPlayerNameWithPublicId, getProfileRoute } from "../../lib/publicIds";
import { resolveDisplayTitle } from "../../lib/titleAccess";
import { getCityName, getTravelProgress, readTravelStateFromPlayer } from "../../lib/travelState";
import { isStaffOrAdmin } from "../../lib/adminAccess";
import { cielLoadingQuotes } from "../../data/cielPageCopy";
import { getCityHubContent } from "../../data/cityHubData";
import { acknowledgeProgressionEvent, type ServerProgressionEvent } from "../../lib/authApi";

type AppShellProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
};

const core: Array<[string, string]> = [
  ["Home", "/home"],
  ["Profile", "/profile"],
  ["Inventory", "/inventory"],
  ["Crafting", "/crafting"],
  ["Education", "/education"],
  ["Skills", "/skills"],
  ["Adventure", "/adventure"],
  ["Housing", "/housing"],
];

const world: Array<[string, string]> = [
  ["City", "/city"],
  ["Civic Jobs", "/civic-jobs"],
  ["Travel", "/travel"],
  ["World Map", "/world-map"],
  ["Codex", "/codex"],
  ["Arena", "/arena"],
  ["City Board", "/city-board"],
  ["Salvage Yard", "/salvage-yard"],
  ["Hospital", "/hospital"],
];

const factions: Array<[string, string]> = [
  ["Guilds", "/guilds"],
  ["Consortiums", "/consortiums"],
];

const HOSPITAL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const JAIL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const TRAVEL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/city", "/civic-jobs", "/guilds", "/consortiums", "/housing"]);

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

function buildCityLocalLinks(cityId: string | null | undefined): Array<[string, string]> {
  const hub = getCityHubContent(cityId);
  const links: Array<[string, string]> = [
    [hub.services.market.label, hub.services.market.route ?? "/market"],
    ["People", "/city#people"],
  ];

  if (hub.services.blackMarket.status === "open" && hub.services.blackMarket.route) {
    links.push(["Black Market", hub.services.blackMarket.route]);
  }

  links.push(
    ["City Special", "/city#special"],
    ["Crafting", "/crafting"],
    ["Salvage Yard", "/salvage-yard"],
    [hub.services.academy.status === "open" ? "Academy" : "Academy (Locked)", "/city#academy"],
    ["Travel", "/travel"],
    ["Consortium", "/consortiums"],
    ["Guild", "/guilds"],
  );

  return links;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ProgressionEventPanel({
  event,
  busy,
  onAcknowledge,
}: {
  event: ServerProgressionEvent | null;
  busy: boolean;
  onAcknowledge: (eventId: string) => Promise<void>;
}) {
  if (!event) return null;

  const detail = (event.detail && typeof event.detail === "object" ? event.detail : {}) as Record<string, unknown>;
  const oldLevel = toNumber(detail.oldLevel);
  const newLevel = toNumber(detail.newLevel);
  const oldMaxLife = toNumber(detail.oldMaxLife);
  const newMaxLife = toNumber(detail.newMaxLife);
  const milestones = Array.isArray(detail.milestones) ? detail.milestones.filter((entry): entry is string => typeof entry === "string") : [];
  const rareManualUnlocks = Array.isArray(detail.rareManualUnlocks)
    ? detail.rareManualUnlocks.filter((entry): entry is string => typeof entry === "string")
    : [];

  return (
    <section className="progression-event" aria-live="polite">
      <div className="progression-event__copy">
        <div className="progression-event__eyebrow">Progression record</div>
        <h2>{event.summary || "Level advanced"}</h2>
        <div className="progression-event__facts">
          {oldLevel !== null && newLevel !== null ? <span>Level {oldLevel} to {newLevel}</span> : null}
          {oldMaxLife !== null && newMaxLife !== null ? <span>Max Life {oldMaxLife} to {newMaxLife}</span> : null}
          <span>Life fully restored</span>
        </div>
        {milestones.length || rareManualUnlocks.length ? (
          <div className="progression-event__milestones">
            {[...milestones, ...rareManualUnlocks].slice(0, 3).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" className="progression-event__ack" disabled={busy} onClick={() => onAcknowledge(event.id)}>
        {busy ? "Recording" : "Acknowledge"}
      </button>
    </section>
  );
}

export function AppShell({ title, hint, children }: AppShellProps) {
  const { player, now, isHospitalized, hospitalRemainingLabel, isJailed, jailRemainingLabel } = usePlayer();
  const { activeAccount, logout, authSource, serverSessionToken, refreshServerState } = useAuth();
  const [acknowledgingEventId, setAcknowledgingEventId] = useState<string | null>(null);
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

  const progressionEvents = ((player as unknown as { progressionEvents?: { pending?: ServerProgressionEvent[] } }).progressionEvents?.pending ?? [])
    .filter((event) => event && typeof event.id === "string");
  const activeProgressionEvent = progressionEvents[0] ?? null;

  async function handleAcknowledgeProgression(eventId: string) {
    if (authSource !== "server" || !serverSessionToken) return;
    setAcknowledgingEventId(eventId);
    try {
      await acknowledgeProgressionEvent(serverSessionToken, eventId);
      await refreshServerState();
    } finally {
      setAcknowledgingEventId(null);
    }
  }

  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayPublicId = activeAccount?.publicId ?? player.publicId;
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, displayPublicId);
  const profileRoute = getProfileRoute(displayPublicId);
  const displayTitle = resolveDisplayTitle(player.title, displayPublicId);
  const portrait = (player as unknown as { portrait?: { imageUrl?: string | null; imageKey?: string | null } | null }).portrait;
  const shadow = (player as unknown as { shadow?: { current?: number; max?: number; label?: string } }).shadow;
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
  const currentCityHub = getCityHubContent(travelState.currentCityId);
  const useCityLocalSidebar = !isTraveling && currentCityHub.cityId !== "nexis";
  const visibleCityLocal = buildCityLocalLinks(currentCityHub.cityId).filter(([, route]) => !hiddenRoutes?.has(route.split("#")[0]));
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
            <PlayerAvatar name={player.name} lastName={player.lastName} portrait={portrait} size={46} className="player-card__crest" />

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
              {shadow ? (
                <div className="player-card__row">
                  <span className="player-card__key">Shadow</span>
                  <span className="player-card__val">{shadow.current ?? 0}/{shadow.max ?? 0}</span>
                </div>
              ) : null}
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

          {useCityLocalSidebar ? (
            <SidebarSection title={currentCityHub.displayName} links={visibleCityLocal} />
          ) : (
            <>
              <SidebarSection title="Character" links={visibleCore.map(([label, route]) => [label, route === "/profile" ? profileRoute : route])} />
              <SidebarSection title="Realm" links={visibleWorld} />
              <SidebarSection title="Orders" links={visibleFactions} />
            </>
          )}
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
          <ProgressionEventPanel
            event={activeProgressionEvent}
            busy={Boolean(acknowledgingEventId)}
            onAcknowledge={handleAcknowledgeProgression}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
