import { NavLink, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { usePlayer } from "../../state/PlayerContext";
import { useAuth } from "../../state/AuthContext";
import { StatBars } from "./StatBars";
import { formatPlayerNameWithPublicId, formatPlayerPublicId } from "../../lib/publicIds";

type AppShellProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
};

const core: Array<[string, string]> = [
  ["Home", "/home"],
  ["Inventory", "/inventory"],
  ["Education", "/education"],
  ["Adventure", "/adventure"],
  ["Arena", "/arena"],
  ["Travel", "/travel"],
  ["Housing", "/housing"],
];

const world: Array<[string, string]> = [
  ["City", "/city"],
  ["City Board", "/city-board"],
  ["Civic Jobs", "/civic-jobs"],
  ["Hospital", "/hospital"],
  ["Guilds / Consortiums", "/guild"],
];

function SidebarSection({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
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
            className={({ isActive }) =>
              `sidebar-link${isActive ? " sidebar-link--active" : ""}`
            }
          >
            <span>{label}</span>
            <span className="sidebar-link__arrow">›</span>
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
  const {
    player,
    isHospitalized,
    hospitalRemainingLabel,
    isJailed,
    jailRemainingLabel,
  } = usePlayer();
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  let conditionLabel = "Normal";
  let conditionClass = "player-condition";
  if (isHospitalized) {
    conditionLabel = `Hospital · ${hospitalRemainingLabel}`;
    conditionClass = "player-condition player-condition--hospital";
  } else if (isJailed) {
    conditionLabel = `Jailed · ${jailRemainingLabel}`;
    conditionClass = "player-condition player-condition--jail";
  }

  const displayName = player.lastName
    ? `${player.name} ${player.lastName}`
    : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-main">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo__title">Nexis</div>
            <div className="sidebar-logo__subtitle">Online realm of adventure</div>
          </div>

          <div className="player-card">
            <div className="player-card__name">
              <span className="player-card__username">{displayNameWithPublicId}</span>
              <span className="player-card__id"> Citizen ID {formatPlayerPublicId(player.publicId)}</span>
            </div>

            <div className="player-card__rows">
              <div className="player-card__row">
                <span className="player-card__key">Level</span>
                <span className="player-card__val">{player.level}</span>
              </div>
              <div className="player-card__row">
                <span className="player-card__key">Title</span>
                <span className="player-card__val">
                  {player.title === "0" ? "The Absolute" : player.title}
                </span>
              </div>
              <div className="player-card__row">
                <span className="player-card__key">Days</span>
                <span className="player-card__val">{player.daysPlayed}</span>
              </div>
              <div className="player-card__row player-card__row--gold">
                <span className="player-card__key">Gold</span>
                <span className="player-card__val player-card__val--gold">
                  {formatGold(player.gold)}
                </span>
              </div>
            </div>

            <div className={conditionClass}>{conditionLabel}</div>
          </div>

          <StatBars />

          <SidebarSection title="Core" links={core} />
          <SidebarSection title="World" links={world} />

          <div className="sidebar-logout">
            <button
              type="button"
              className="sidebar-logout__btn"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        </aside>

        <main className="content">
          {title ? (
            <div className="page-banner">
              <div className="page-banner__title">{title}</div>
              <div className="page-banner__actions">
                <button type="button" className="page-banner__action">
                  Personal stats
                </button>
                <button type="button" className="page-banner__action">
                  Log
                </button>
              </div>
            </div>
          ) : null}
          {hint ? <div className="page-subhint">{hint}</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
