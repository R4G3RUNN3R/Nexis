import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { formatPlayerNameWithPublicId, getProfileRoute } from "../../lib/publicIds";

type MenuLink = { label: string; to: string };

const communityLinks: MenuLink[] = [
  { label: "News", to: "/news" },
  { label: "Life Paths", to: "/life-paths" },
  { label: "Achievements", to: "/achievements" },
];

const supportLinks: MenuLink[] = [
  { label: "Rules", to: "/rules" },
  { label: "Contact", to: "/contact" },
  { label: "Credits", to: "/credits" },
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

function MenuGroup({ title, links, isOpen, onToggle, menuRef }: { title: string; links: MenuLink[]; isOpen: boolean; onToggle: () => void; menuRef: React.RefObject<HTMLDivElement | null>; }) {
  return (
    <div className="topbar__menu-wrap" ref={menuRef}>
      <button type="button" className="topbar__nav-trigger" onClick={onToggle}>
        <span>{title}</span>
        <span className="topbar__nav-caret">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen ? (
        <div className="topbar__dropdown topbar__dropdown--nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="topbar__dropdown-link" onClick={onToggle}>
              {link.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const { player } = usePlayer();
  const { logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const playerMenuRef = useRef<HTMLDivElement | null>(null);
  const clockMenuRef = useRef<HTMLDivElement | null>(null);
  const communityMenuRef = useRef<HTMLDivElement | null>(null);
  const supportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (playerMenuRef.current && !playerMenuRef.current.contains(target)) setPlayerOpen(false);
      if (clockMenuRef.current && !clockMenuRef.current.contains(target)) setClockOpen(false);
      if (communityMenuRef.current && !communityMenuRef.current.contains(target)) setCommunityOpen(false);
      if (supportMenuRef.current && !supportMenuRef.current.contains(target)) setSupportOpen(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const localTime = useMemo(() => formatClock(now), [now]);
  const crownTime = useMemo(() => formatClock(now, "Europe/London"), [now]);
  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);
  const profileRoute = getProfileRoute(player.publicId);
  const initial = player.name ? player.name.charAt(0).toUpperCase() : "?";

  function handleLogout() {
    setPlayerOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <Link to="/home" className="topbar__brand">Ashen Crown</Link>
        <NavLink to="/home" className="topbar__link">Home</NavLink>
        <NavLink to="/city" className="topbar__link">World</NavLink>
        <MenuGroup title="Community" links={communityLinks} isOpen={communityOpen} onToggle={() => { setCommunityOpen((value) => !value); setSupportOpen(false); }} menuRef={communityMenuRef} />
        <MenuGroup title="Support" links={supportLinks} isOpen={supportOpen} onToggle={() => { setSupportOpen((value) => !value); setCommunityOpen(false); }} menuRef={supportMenuRef} />
      </div>

      <div className="topbar__center">
        <div className="topbar__ticker">Public records and in-world notices.</div>
      </div>

      <div className="topbar__right">
        <div className="topbar__menu-wrap" ref={clockMenuRef}>
          <button type="button" className="topbar__icon" aria-label="Clock" onClick={() => setClockOpen((value) => !value)}>◷</button>
          {clockOpen ? (
            <div className="topbar__dropdown topbar__dropdown--clock">
              <div className="topbar__dropdown-row"><span className="topbar__dropdown-label">Local</span><strong>{localTime}</strong></div>
              <div className="topbar__dropdown-row"><span className="topbar__dropdown-label">Crown</span><strong>{crownTime}</strong></div>
            </div>
          ) : null}
        </div>

        {isLoggedIn ? (
          <div className="player-menu" ref={playerMenuRef}>
            <button type="button" className="player-menu__trigger" onClick={() => setPlayerOpen((value) => !value)}>
              <span className="player-menu__avatar">{initial}</span>
              <span className="player-menu__name">{displayNameWithPublicId}</span>
              <span className="player-menu__caret">{playerOpen ? "▲" : "▼"}</span>
            </button>
            {playerOpen ? (
              <div className="player-menu__dropdown">
                <div className="player-menu__server">Realm: Ashen Crown</div>
                <NavLink to={profileRoute} className="player-menu__item" onClick={() => setPlayerOpen(false)}>Character Profile</NavLink>
                <NavLink to="/education" className="player-menu__item" onClick={() => setPlayerOpen(false)}>Education</NavLink>
                <NavLink to="/inventory" className="player-menu__item" onClick={() => setPlayerOpen(false)}>Inventory</NavLink>
                <NavLink to="/housing" className="player-menu__item" onClick={() => setPlayerOpen(false)}>Housing</NavLink>
                <div className="player-menu__divider" />
                <button type="button" className="player-menu__item player-menu__item--logout" onClick={handleLogout}>Log Out</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="topbar__auth-links">
            <Link to="/register" className="topbar__auth-link topbar__auth-link--accent">Register</Link>
            <Link to="/login" className="topbar__auth-link">Login</Link>
          </div>
        )}
      </div>
    </header>
  );
}
