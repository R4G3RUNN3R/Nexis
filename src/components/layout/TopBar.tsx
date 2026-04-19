import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { formatPlayerNameWithPublicId, getProfileRoute } from "../../lib/publicIds";
import { CONSORTIUM_STORAGE_PREFIX, GUILD_STORAGE_PREFIX } from "../../lib/organizations";

const navLinks: Array<[string, string]> = [
  ["News", "/news"],
  ["Rules", "/rules"],
  ["Contact", "/contact"],
  ["Credits", "/credits"],
];

type SearchResult = {
  id: string;
  label: string;
  hint: string;
  to: string;
};

function formatClock(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(timeZone ? "en-GB" : undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function buildSearchIndex() {
  const results: SearchResult[] = [
    { id: "route-guilds", label: "Guilds", hint: "Group management", to: "/guilds" },
    { id: "route-consortiums", label: "Consortiums", hint: "Player companies", to: "/consortiums" },
    { id: "route-city-board", label: "City Board", hint: "Public notices", to: "/city-board" },
    { id: "route-rules", label: "Rules", hint: "Public guidance", to: "/rules" },
    { id: "route-news", label: "News", hint: "Public updates", to: "/news" },
  ];

  const accounts = readJson<Record<string, { firstName: string; lastName: string; publicId: number }>>("nexis_accounts");
  if (accounts) {
    Object.entries(accounts).forEach(([email, account]) => {
      const displayName = `${account.firstName} ${account.lastName}`.trim();
      results.push({
        id: `player-${email}`,
        label: displayName,
        hint: `Citizen ${account.publicId}`,
        to: getProfileRoute(account.publicId),
      });
    });
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    if (key.startsWith(GUILD_STORAGE_PREFIX)) {
      const guild = readJson<{ name: string; tag: string }>(key);
      if (guild?.name) {
        results.push({
          id: `guild-${key}`,
          label: guild.name,
          hint: `Guild ${guild.tag}`,
          to: "/guilds",
        });
      }
    }

    if (key.startsWith(CONSORTIUM_STORAGE_PREFIX)) {
      const consortium = readJson<{ name: string; tag: string; companyTypeName?: string }>(key);
      if (consortium?.name) {
        results.push({
          id: `consortium-${key}`,
          label: consortium.name,
          hint: consortium.companyTypeName ?? `Consortium ${consortium.tag}`,
          to: "/consortiums",
        });
      }
    }
  }

  return results;
}

export function TopBar() {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const { player } = usePlayer();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const playerMenuRef = useRef<HTMLDivElement | null>(null);
  const clockMenuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (playerMenuRef.current && !playerMenuRef.current.contains(target)) {
        setPlayerOpen(false);
      }
      if (clockMenuRef.current && !clockMenuRef.current.contains(target)) {
        setClockOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const localTime = useMemo(() => formatClock(now), [now]);
  const serverTime = useMemo(() => formatClock(now, "Europe/London"), [now]);
  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return buildSearchIndex()
      .filter((entry) => `${entry.label} ${entry.hint}`.toLowerCase().includes(trimmed))
      .slice(0, 6);
  }, [query, player.publicId, searchOpen]);

  const displayName = player.lastName
    ? `${player.name} ${player.lastName}`
    : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);
  const profileRoute = getProfileRoute(player.publicId);

  const initial = player.name ? player.name.charAt(0).toUpperCase() : "?";

  function handleLogout() {
    setPlayerOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  function openSearchResult(result: SearchResult) {
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
    <header className="topbar">
      <div className="topbar__left">
        {navLinks.map(([label, to]) => (
          <NavLink key={to} to={to} className="topbar__link">
            {label}
          </NavLink>
        ))}
      </div>

      <div className="topbar__center" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} style={{ position: "relative", width: "100%" }}>
          <input
            className="topbar__search"
            type="search"
            placeholder="Search citizens, guilds, consortiums..."
            aria-label="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchOpen && query.trim() ? (
            <div className="topbar__dropdown" style={{ top: "calc(100% + 6px)", left: 0, right: 0, position: "absolute", zIndex: 40 }}>
              {searchResults.length ? (
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
        </form>
      </div>

      <div className="topbar__right">
        <div className="topbar__menu-wrap" ref={clockMenuRef}>
          <button
            type="button"
            className="topbar__icon"
            aria-label="Open time menu"
            onClick={() => setClockOpen((value) => !value)}
          >
            <span aria-hidden="true">⏳</span>
          </button>

          {clockOpen ? (
            <div className="topbar__dropdown topbar__dropdown--clock">
              <div className="topbar__dropdown-row">
                <span className="topbar__dropdown-label">Nexis Time</span>
                <strong>{serverTime}</strong>
              </div>
              <div className="topbar__dropdown-row">
                <span className="topbar__dropdown-label">Local Time</span>
                <strong>{localTime}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <div className="player-menu" ref={playerMenuRef}>
          <button
            type="button"
            className="player-menu__trigger"
            onClick={() => setPlayerOpen((value) => !value)}
          >
            <span className="player-menu__avatar">{initial}</span>
            <span className="player-menu__name">{displayNameWithPublicId}</span>
            <span className="player-menu__caret">{playerOpen ? "^" : "v"}</span>
          </button>

          {playerOpen ? (
            <div className="player-menu__dropdown">
              <div className="player-menu__server">Ashen Crown | Shard: Cay</div>
              <NavLink to={profileRoute} className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                Character Profile
              </NavLink>
              <NavLink to="/achievements" className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                Achievements
              </NavLink>
              <NavLink to="/housing" className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                Housing
              </NavLink>
              <NavLink to="/education" className="player-menu__item" onClick={() => setPlayerOpen(false)}>
                Education
              </NavLink>
              <div className="player-menu__divider" />
              <button
                type="button"
                className="player-menu__item player-menu__item--logout"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
