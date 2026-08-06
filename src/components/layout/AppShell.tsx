import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { TopBar } from "./TopBar";
import { NewsTicker } from "./NewsTicker";
import { useNewsTickerPreference } from "../../lib/uiPreferences";
import { PlayerAvatar } from "../common/PlayerAvatar";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { StatBars } from "./StatBars";
import { formatPlayerNameWithPublicId } from "../../lib/publicIds";
import { resolveDisplayTitle } from "../../lib/titleAccess";
import { getCityName, getTravelProgress, readTravelStateFromPlayer } from "../../lib/travelState";
import { isStaffOrAdmin } from "../../lib/adminAccess";
import { AdminModeToggle, AdminGoldInlineControls, AdminConditionInlineControls } from "../admin/AdminInlineControls";
import { cielLoadingQuotes } from "../../data/cielPageCopy";
import { getCityHubContent } from "../../data/cityHubData";
import { acknowledgeProgressionEvent, getServerCityAcademy, type ServerProgressionEvent } from "../../lib/authApi";
import { NAV_ICONS } from "../../assets/icons";
import { applySidebarLinkOrder, type SidebarLinksPreference } from "../../data/sidebarCatalog";

type AppShellProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
};

// Home, Profile, Travel, World Map, Codex, Wiki, City, Guilds, and
// Consortiums live in the top bar (see TopBar.tsx) as the primary,
// always-visible nav. The sidebar below only holds destinations that AREN'T
// already reachable from the top bar, grouped into three refined sections.
// The canonical catalog for these three sections lives in
// src/data/sidebarCatalog.ts (shared with Settings.tsx's Navigation settings
// customization UI) - order/visibility below is the canonical default,
// overridden per-player by applySidebarLinkOrder() further down.

/** Resolves the nav icon for a sidebar link from its route (strips hash/query). */
function iconForRoute(route: string) {
  const key = route.split("#")[0].split("?")[0].replace(/^\//, "");
  return NAV_ICONS[key];
}

const HOSPITAL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const JAIL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/travel", "/city", "/civic-jobs"]);
const TRAVEL_HIDDEN = new Set(["/education", "/crafting", "/salvage-yard", "/adventure", "/arena", "/city", "/civic-jobs", "/guilds", "/consortiums", "/housing", "/city-board"]);

function SidebarSection({ title, links }: { title: string; links: Array<[string, string]> }) {
  if (!links.length) return null;

  return (
    <div className="sidebar-section">
      <div className="sidebar-section__title">{title}</div>
      <div className="sidebar-section__links">
        {links.map(([label, to]) => {
          const Icon = iconForRoute(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/home"}
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--active" : ""}`}
            >
              <span className="sidebar-link__label">
                {Icon ? <Icon size={16} /> : null}
                <span>{label}</span>
              </span>
              <span className="sidebar-link__arrow">{">"}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

function formatGold(amount: number): string {
  return amount.toLocaleString("en-US") + " gp";
}

// academyOpen is a live per-player value fetched from the same server evaluator the City page's
// Academy panel uses (see AppShell's academy-status effect below) - null while it hasn't loaded
// yet (or the player is signed out), in which case the static per-city placeholder is used only
// as a display fallback, never as the authority (Ticket 6: this static value used to be shown
// forever regardless of real course completion).
function buildCityLocalLinks(cityId: string | null | undefined, academyOpen: boolean | null): Array<[string, string]> {
  const hub = getCityHubContent(cityId);
  const links: Array<[string, string]> = [
    [hub.services.market.label, hub.services.market.route ?? "/market"],
    ["People", "/city#people"],
  ];

  if (hub.services.blackMarket.status === "open" && hub.services.blackMarket.route) {
    links.push(["Black Market", hub.services.blackMarket.route]);
  }

  const isAcademyOpen = academyOpen ?? hub.services.academy.status === "open";
  links.push(
    ["City Special", "/city#special"],
    ["Crafting", "/crafting"],
    ["Salvage Yard", "/salvage-yard"],
    [isAcademyOpen ? "Academy" : "Academy (Locked)", "/city#academy"],
  );

  // Travel, Consortiums, and Guilds are always reachable from the top bar,
  // so they're intentionally left out of this city-local list.

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
  const eventTitle = typeof event.title === "string" && event.title.trim() ? event.title : event.summary || "Progress recorded";
  const isLevelEvent = event.type === "level_up" || (oldLevel !== null && newLevel !== null);
  const rewardPoints = toNumber(detail.rewardPoints);

  return (
    <section className="progression-event" aria-live="polite">
      <div className="progression-event__copy">
        <div className="progression-event__eyebrow">Progression record</div>
        <h2>{eventTitle}</h2>
        <div className="progression-event__facts">
          {oldLevel !== null && newLevel !== null ? <span>Level {oldLevel} to {newLevel}</span> : null}
          {oldMaxLife !== null && newMaxLife !== null ? <span>Max Life {oldMaxLife} to {newMaxLife}</span> : null}
          {isLevelEvent ? <span>Life fully restored</span> : null}
          {!isLevelEvent && rewardPoints !== null ? <span>+{rewardPoints} Legacy Point{rewardPoints === 1 ? "" : "s"}</span> : null}
          {!isLevelEvent && rewardPoints === null ? <span>{event.summary}</span> : null}
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
  const { activeAccount, logout, authSource, serverHydrationVersion, serverSessionToken, refreshServerState } = useAuth();
  const [acknowledgingEventId, setAcknowledgingEventId] = useState<string | null>(null);
  const [sidebarAcademyOpen, setSidebarAcademyOpen] = useState<boolean | null>(null);
  const [newsTickerEnabled] = useNewsTickerPreference();
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

  const sidebarNormalizedCityId = getCityHubContent(travelState.currentCityId).cityId;
  const sidebarAcademyCityId = !isTraveling && sidebarNormalizedCityId !== "nexis" ? sidebarNormalizedCityId : null;
  useEffect(() => {
    let cancelled = false;
    if (!sidebarAcademyCityId || authSource !== "server" || !serverSessionToken) {
      setSidebarAcademyOpen(null);
      return;
    }
    (async () => {
      const result = await getServerCityAcademy(serverSessionToken, sidebarAcademyCityId);
      if (cancelled) return;
      if (!result.ok) {
        setSidebarAcademyOpen(null);
        return;
      }
      const entries = result.academies ?? (result.academy ? [result.academy] : []);
      setSidebarAcademyOpen(entries.some((entry) => entry.isCompleted || entry.canStart || !entry.lockReason));
    })();
    return () => {
      cancelled = true;
    };
  }, [sidebarAcademyCityId, authSource, serverSessionToken, serverHydrationVersion]);

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
  const sidebarLinksPref = (player as unknown as { ui?: { sidebarLinks?: SidebarLinksPreference } }).ui?.sidebarLinks;
  const orderedCharacter = applySidebarLinkOrder("character", sidebarLinksPref?.character);
  const orderedRealm = applySidebarLinkOrder("realm", sidebarLinksPref?.realm);
  const orderedOrders = applySidebarLinkOrder("orders", sidebarLinksPref?.orders);
  // Player customization is applied first; the hospital/jail/travel filter
  // is a second, unconditional layer on top - a hospitalized player never
  // sees Education even if they pinned it in Navigation settings.
  const visibleCharacter = hiddenRoutes ? orderedCharacter.filter(([, route]) => !hiddenRoutes.has(route)) : orderedCharacter;
  const visibleRealm = hiddenRoutes ? orderedRealm.filter(([, route]) => !hiddenRoutes.has(route)) : orderedRealm;
  const visibleOrders = hiddenRoutes ? orderedOrders.filter(([, route]) => !hiddenRoutes.has(route)) : orderedOrders;
  const currentCityHub = getCityHubContent(travelState.currentCityId);
  const useCityLocalSidebar = !isTraveling && currentCityHub.cityId !== "nexis";
  const visibleCityLocal = buildCityLocalLinks(currentCityHub.cityId, sidebarAcademyOpen).filter(([, route]) => !hiddenRoutes?.has(route.split("#")[0]));
  const adminLinks = canAccessAdmin ? ([["Admin Panel", "/admin"]] as Array<[string, string]>) : [];

  return (
    <div className="app-shell">
      <TopBar />
      {newsTickerEnabled ? <NewsTicker /> : null}
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
                <span className="player-card__val player-card__val--gold">
                  {formatGold(player.gold)}
                  <AdminGoldInlineControls gold={player.gold} />
                </span>
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
            <AdminConditionInlineControls conditionType={player.condition.type} isTraveling={isTraveling} />
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
              <SidebarSection title="Character" links={visibleCharacter} />
              <SidebarSection title="Realm" links={visibleRealm} />
              <SidebarSection title="Orders" links={visibleOrders} />
            </>
          )}
          <SidebarSection title="Authority" links={adminLinks} />
          <div className="sidebar-admin-toggle">
            <AdminModeToggle />
          </div>

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
