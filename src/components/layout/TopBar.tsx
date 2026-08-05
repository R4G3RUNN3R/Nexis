import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { formatPlayerNameWithPublicId, getProfileRoute } from "../../lib/publicIds";
import { PlayerAvatar } from "../common/PlayerAvatar";
import { resolveDisplayTitle } from "../../lib/titleAccess";
import { NAV_ICONS } from "../../assets/icons";
import { getAdvancedSearchAccess, getServerRecords, searchDirectory, type ServerRecordEntry, type ServerSearchResult } from "../../lib/authApi";
import { getCityHubContent } from "../../data/cityHubData";
import { allWikiEntries } from "../../data/wikiData";

import { isStaffOrAdmin } from "../../lib/adminAccess";

const WORLD_CITY_IDS = ["nexis", "north", "east", "west", "south"] as const;

type SearchCategory = "user" | "faction" | "company" | "areas" | "market" | "wiki";

const SEARCH_CATEGORIES: Array<{ key: SearchCategory; label: string }> = [
  { key: "user", label: "User" },
  { key: "faction", label: "Faction" },
  { key: "company", label: "Company" },
  { key: "areas", label: "Areas" },
  { key: "market", label: "Item Market" },
  { key: "wiki", label: "Wiki" },
];

function searchAreas(term: string): ServerSearchResult[] {
  const lowerTerm = term.toLowerCase();
  return WORLD_CITY_IDS.map((cityId) => getCityHubContent(cityId))
    .filter((hub) => hub.displayName.toLowerCase().includes(lowerTerm) || hub.identity.toLowerCase().includes(lowerTerm))
    .slice(0, 8)
    .map((hub) => ({ id: `area-${hub.cityId}`, label: hub.displayName, hint: hub.identity, to: "/world-map" }));
}

function searchWiki(term: string): ServerSearchResult[] {
  const lowerTerm = term.toLowerCase();
  return allWikiEntries
    .filter((entry) => entry.title.toLowerCase().includes(lowerTerm) || entry.summary.toLowerCase().includes(lowerTerm))
    .slice(0, 8)
    .map((entry) => ({ id: `wiki-${entry.id}`, label: entry.title, hint: entry.summary, to: `/wiki#${entry.id}` }));
}

// Primary, always-visible navigation. These are the high-frequency and
// high-level destinations; everything else lives in the sidebar (see
// AppShell.tsx) grouped under Character / Realm / Orders.
const navLinks: Array<[string, string]> = [
  ["Home", "/home"],
  ["Profile", "/profile"],
  ["Travel", "/travel"],
  ["World Map", "/world-map"],
  ["Codex", "/codex"],
  ["Wiki", "/wiki"],
  ["City", "/city"],
  ["Guilds", "/guilds"],
  ["Consortiums", "/consortiums"],
];

// Thin utility strip above the main bar, matching the reference site's
// Wiki/Rules/Forums/Discord/Staff/Credits row. Forums and Discord are
// omitted - neither exists for Nexis yet.
const utilityLinks: Array<[string, string]> = [
  ["Wiki", "/wiki"],
  ["Rules", "/rules"],
  ["Staff", "/staff"],
  ["Credits", "/credits"],
];

function formatClock(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(timeZone ? "en-GB" : undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatRelativeTime(timestamp: number, now: number) {
  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type TopBarProps = {
  newsTickerEnabled: boolean;
  onToggleNewsTicker: (value: boolean) => void;
};

export function TopBar({ newsTickerEnabled, onToggleNewsTicker }: TopBarProps) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [recordLogOpen, setRecordLogOpen] = useState(false);
  const [recordLog, setRecordLog] = useState<ServerRecordEntry[] | null>(null);
  const [recordLogLoading, setRecordLogLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<SearchCategory>("user");
  const [searchResults, setSearchResults] = useState<ServerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isDonor, setIsDonor] = useState(false);

  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken, logout } = useAuth();
  const navigate = useNavigate();

  const playerMenuRef = useRef<HTMLDivElement | null>(null);
  const clockMenuRef = useRef<HTMLDivElement | null>(null);
  const recordLogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // player.legacy doesn't exist - the runtime state's "legacy" branch is a
  // sibling of "player", not nested inside it, so donorTier can't be read
  // off the player object like dmosOneShots/notifications/etc above. Ask
  // the endpoint directly instead; it re-checks server-side regardless.
  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken) {
      setIsDonor(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await getAdvancedSearchAccess(serverSessionToken);
      if (!cancelled && result.ok) setIsDonor(result.allowed);
    })();
    return () => {
      cancelled = true;
    };
  }, [authSource, serverSessionToken]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (playerMenuRef.current && !playerMenuRef.current.contains(target)) {
        setPlayerOpen(false);
      }
      if (clockMenuRef.current && !clockMenuRef.current.contains(target)) {
        setClockOpen(false);
      }
      if (recordLogRef.current && !recordLogRef.current.contains(target)) {
        setRecordLogOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!recordLogOpen || authSource !== "server" || !serverSessionToken) return;
    let cancelled = false;
    setRecordLogLoading(true);
    (async () => {
      const result = await getServerRecords(serverSessionToken, null, 20);
      if (cancelled) return;
      setRecordLogLoading(false);
      if (result.ok) setRecordLog(result.records);
    })();
    return () => {
      cancelled = true;
    };
  }, [recordLogOpen, authSource, serverSessionToken]);

  const localTime = useMemo(() => formatClock(now), [now]);
  const serverTime = useMemo(() => formatClock(now, "Europe/London"), [now]);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !searchOpen) {
      setSearchResults([]);
      return;
    }
    if (searchCategory === "areas") {
      setSearchResults(searchAreas(trimmed));
      return;
    }
    if (searchCategory === "wiki") {
      setSearchResults(searchWiki(trimmed));
      return;
    }
    if (authSource !== "server" || !serverSessionToken) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      const result = await searchDirectory(serverSessionToken, searchCategory, trimmed, 8);
      if (cancelled) return;
      setSearchLoading(false);
      setSearchResults(result.ok ? result.results : []);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen, searchCategory, authSource, serverSessionToken]);

  const displayName = player.lastName
    ? `${player.name} ${player.lastName}`
    : player.name || "Unknown";
  const displayPublicId = activeAccount?.publicId ?? player.publicId;
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, displayPublicId);
  const profileRoute = getProfileRoute(displayPublicId);
  const canAccessAdmin = isStaffOrAdmin({
    publicId: activeAccount?.publicId ?? player.publicId,
    privilegeRole: activeAccount?.privilegeRole ?? "player",
  });

  const portrait = (player as unknown as { portrait?: { imageUrl?: string | null; imageKey?: string | null } | null }).portrait;
  const displayTitle = resolveDisplayTitle(player.title, displayPublicId);
  const dmosState = (player as unknown as { dmosOneShots?: { tokens?: { patronBound?: number; sealed?: number }; activeSession?: { status?: string } | null } }).dmosOneShots;
  const oneShotTokens = Number(dmosState?.tokens?.patronBound ?? 0) + Number(dmosState?.tokens?.sealed ?? 0);
  const oneShotActive = dmosState?.activeSession?.status === "active";
  const oneShotReady = oneShotTokens > 0 || oneShotActive;
  const guideState = player as unknown as {
    progressionEvents?: { pending?: unknown[] };
    legacy?: { points?: { available?: number } };
    notifications?: { alerts?: unknown[] };
  };
  const pendingProgression = Array.isArray(guideState.progressionEvents?.pending) ? guideState.progressionEvents.pending.length : 0;
  const availableLegacyPoints = Math.max(0, Math.floor(Number(guideState.legacy?.points?.available ?? 0)));
  const unreadAlertCount = Array.isArray(guideState.notifications?.alerts) ? guideState.notifications.alerts.length : 0;
  const readinessCount = Math.min(99, pendingProgression + availableLegacyPoints + unreadAlertCount + (oneShotReady ? 1 : 0));

  function handleLogout() {
    setPlayerOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  function openSearchResult(result: ServerSearchResult) {
    setQuery("");
    setSearchOpen(false);
    navigate(result.to);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchResults.length) return;
    openSearchResult(searchResults[0]);
  }

  return (
    <div className="topbar-wrap">
      <nav className="topbar-utility" aria-label="Site links">
        {utilityLinks.map(([label, to]) => (
          <NavLink key={to} to={to} className="topbar-utility__link">
            {label}
          </NavLink>
        ))}
      </nav>

      <header className="topbar">
      <div className="topbar__left">
        {navLinks.map(([label, to]) => {
          const Icon = NAV_ICONS[to.replace(/^\//, "")];
          return (
            <NavLink
              key={to}
              to={label === "Profile" ? profileRoute : to}
              className={({ isActive }) => `topbar__link${isActive ? " topbar__link--active" : ""}`}
            >
              {Icon ? <Icon size={16} /> : null}
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="topbar__center" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="topbar__search-group">
          <select
            className="topbar__search-category"
            aria-label="Search category"
            value={searchCategory}
            onChange={(event) => {
              setSearchCategory(event.target.value as SearchCategory);
              setSearchOpen(true);
            }}
          >
            {SEARCH_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input
              className="topbar__search"
              type="search"
              placeholder="Search citizens and quick links..."
              aria-label="Search citizens and quick links"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                setSearchOpen(true);
                setPlayerOpen(false);
                setClockOpen(false);
              }}
            />
            {searchOpen && query.trim() ? (
              <div className="topbar__dropdown" style={{ top: "calc(100% + 6px)", left: 0, right: 0, position: "absolute", zIndex: 40 }}>
                {searchLoading ? (
                  <div className="topbar__dropdown-row">
                    <span className="topbar__dropdown-label">Search</span>
                    <strong>Searching…</strong>
                  </div>
                ) : searchResults.length ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="player-menu__item player-menu__item--button"
                      onClick={() => openSearchResult(result)}
                      style={{ width: "100%", textAlign: "left" }}
                    >
                      <div>{result.label}</div>
                      <div style={{ fontSize: 11, color: "#9fb0bf" }}>{result.hint}</div>
                    </button>
                  ))
                ) : (
                  <div className="topbar__dropdown-row">
                    <span className="topbar__dropdown-label">Search</span>
                    <strong>No matches</strong>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </form>
      </div>

      <div className="topbar__right">
        <nav className="topbar__shortcuts" aria-label="Player shortcuts">
          <NavLink
            to="/achievements"
            className="topbar__shortcut"
            title="Achievements and Legacy"
            aria-label={`Achievements and Legacy${readinessCount > 0 ? `, ${readinessCount} pending` : ""}`}
          >
            <span aria-hidden="true">LG</span>
            {readinessCount > 0 ? <b className="topbar__shortcut-badge" aria-hidden="true">{readinessCount}</b> : null}
          </NavLink>
          <NavLink
            to="/one-shots"
            className={`topbar__shortcut${oneShotReady ? " topbar__shortcut--ready" : ""}`}
            title={oneShotActive ? "DMOS one-shot active" : oneShotTokens > 0 ? "DMOS one-shot token ready" : "Nexis One-Shots"}
            aria-label={oneShotActive ? "Nexis One-Shots, session active" : oneShotTokens > 0 ? "Nexis One-Shots, token ready" : "Nexis One-Shots"}
          >
            <span aria-hidden="true">OS</span>
            {oneShotReady ? <i aria-hidden="true" /> : null}
          </NavLink>
          <NavLink to={profileRoute} className="topbar__shortcut" title="Chronicle records" aria-label="Chronicle records">
            <span aria-hidden="true">RC</span>
          </NavLink>
          <NavLink to="/codex" className="topbar__shortcut" title="Codex" aria-label="Codex">
            <span aria-hidden="true">CD</span>
          </NavLink>
          <NavLink to="/wiki" className="topbar__shortcut" title="Wiki manual" aria-label="Wiki manual">
            <span aria-hidden="true">WK</span>
          </NavLink>
        </nav>

        <div className="topbar__menu-wrap" ref={clockMenuRef}>
          <button
            type="button"
            className="topbar__icon"
            aria-label="Clock"
            onClick={() => {
              setClockOpen((value) => !value);
              setPlayerOpen(false);
              setRecordLogOpen(false);
              setSearchOpen(false);
            }}
          >
            <span className="topbar__icon-label">Clock</span>
          </button>

          {clockOpen ? (
            <div className="topbar__dropdown topbar__dropdown--clock">
              <div className="topbar__dropdown-row">
                <span className="topbar__dropdown-label">Server Time</span>
                <strong>{serverTime}</strong>
              </div>
              <div className="topbar__dropdown-row">
                <span className="topbar__dropdown-label">Local Time</span>
                <strong>{localTime}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <div className="topbar__menu-wrap" ref={recordLogRef}>
          <button
            type="button"
            className="topbar__icon"
            aria-label="Record Log"
            onClick={() => {
              setRecordLogOpen((value) => !value);
              setPlayerOpen(false);
              setClockOpen(false);
              setSearchOpen(false);
            }}
          >
            <span className="topbar__icon-label">Log</span>
          </button>

          {recordLogOpen ? (
            <div className="topbar__dropdown topbar__dropdown--log">
              <div className="topbar__dropdown-title">Record Log</div>
              {recordLogLoading ? (
                <div className="topbar__log-empty">Loading.</div>
              ) : recordLog && recordLog.length ? (
                <div className="topbar__log-list">
                  {recordLog.map((entry) => {
                    const body = (
                      <>
                        <span className="topbar__log-time">{formatRelativeTime(entry.timestamp, now.getTime())}</span>
                        <span className="topbar__log-summary">{entry.summary}</span>
                      </>
                    );
                    return entry.route ? (
                      <NavLink key={entry.id} to={entry.route} className="topbar__log-row topbar__log-row--link" onClick={() => setRecordLogOpen(false)}>
                        {body}
                      </NavLink>
                    ) : (
                      <div key={entry.id} className="topbar__log-row">
                        {body}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="topbar__log-empty">No recent activity yet.</div>
              )}
              <NavLink to="/records" className="topbar__log-viewall" onClick={() => setRecordLogOpen(false)}>
                View Log
              </NavLink>
            </div>
          ) : null}
        </div>

        {isDonor ? (
          <NavLink
            to="/search/advanced"
            className="topbar__icon topbar__icon--donor"
            aria-label="Advanced Search"
            title="Advanced Search (donator perk)"
          >
            <span className="topbar__icon-label">Advanced Search</span>
          </NavLink>
        ) : null}

        <div className="player-menu" ref={playerMenuRef}>
          <button
            type="button"
            className="player-menu__trigger"
            onClick={() => {
              setPlayerOpen((value) => !value);
              setClockOpen(false);
              setRecordLogOpen(false);
              setSearchOpen(false);
            }}
          >
            <PlayerAvatar name={player.name} lastName={player.lastName} portrait={portrait} size={30} className="player-menu__avatar" />
            <span className="player-menu__name">P{displayPublicId}{displayTitle ? ` | ${displayTitle}` : ""} | Lv {player.level}</span>
            <span className="player-menu__caret">{playerOpen ? "^" : "v"}</span>
          </button>

          {playerOpen ? (
            <div className="player-menu__dropdown">
              <div className="player-menu__identity">
                <PlayerAvatar name={player.name} lastName={player.lastName} portrait={portrait} size={34} className="player-menu__avatar" />
                <div>
                  <strong>{displayNameWithPublicId}</strong>
                  <span>{displayTitle || "Untitled citizen"} | Level {player.level}</span>
                </div>
              </div>
              {canAccessAdmin ? (
                <NavLink to="/admin" className="player-menu__item player-menu__item--admin" onClick={() => setPlayerOpen(false)}>
                  Administration
                </NavLink>
              ) : null}
              <NavLink to={profileRoute} className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                View Profile
              </NavLink>
              <button
                type="button"
                className="player-menu__item player-menu__item--toggle"
                onClick={() => onToggleNewsTicker(!newsTickerEnabled)}
              >
                <span>News Ticker</span>
                <span className={`player-menu__switch${newsTickerEnabled ? " player-menu__switch--on" : ""}`} aria-hidden="true" />
              </button>
              <NavLink to="/settings" className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                Settings
              </NavLink>
              <div className="player-menu__divider" />
              <button
                type="button"
                className="player-menu__item player-menu__item--logout"
                onClick={handleLogout}
              >
                Log Out
              </button>
              <div className="player-menu__server">Server: Cay</div>
            </div>
          ) : null}
        </div>
      </div>
      </header>
    </div>
  );
}
