// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Character Profile Page
// Reads ALL data from PlayerContext — no mock data.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { usePlayer } from "../state/PlayerContext";
import { getPropertyById } from "../data/propertyData";
import { formatPlayerNameWithPublicId, formatPlayerPublicId, getProfileRoute, parsePlayerPublicId } from "../lib/publicIds";
import { formatTravelDuration, getCityName, getTravelProgress, resolveTravelState } from "../lib/travelState";
import "../styles/character-profile.css";

type PanelSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function PanelSection({ title, defaultOpen = true, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="character-panel">
      <button
        type="button"
        className="character-panel__header"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="character-panel__toggle">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="character-panel__body">{children}</div> : null}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <strong className="stat-row__value">{String(value)}</strong>
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k`;
  return amount.toLocaleString("en-US");
}

export default function ProfilePage() {
  const { player } = usePlayer();
  const { publicId: publicIdParam } = useParams();

  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);
  const profileRoute = getProfileRoute(player.publicId);
  const requestedPublicId = parsePlayerPublicId(publicIdParam);
  const isCurrentCitizenRoute = publicIdParam === undefined || requestedPublicId === player.publicId;
  const travelState = resolveTravelState(player.internalId);
  const travelProgress = getTravelProgress(travelState, Date.now());
  const travelStatus = travelProgress.active
    ? `${getCityName(travelState.originCityId)} → ${getCityName(travelState.destinationCityId)} • ${formatTravelDuration(travelProgress.remainingMs)}`
    : getCityName(travelState.currentCityId);

  const property = getPropertyById(player.property.current);
  const propertyName = property?.name ?? "None";

  const inventoryCount = Object.values(player.inventory).reduce((a, b) => a + b, 0);
  const inventoryTypes = Object.keys(player.inventory).length;

  if (!isCurrentCitizenRoute) {
    return (
      <AppShell title="Character Profile">
        <div className="character-profile-page">
          <section className="character-panel">
            <div className="character-panel__body">
              <h2 style={{ marginTop: 0 }}>Citizen Record Unavailable</h2>
              <p>
                Citizen {formatPlayerPublicId(requestedPublicId)} is not mirrored into this local Nexis shard yet.
              </p>
              <Link className="inline-route-link" to={profileRoute}>Open your own profile</Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Character Profile">
      <div className="character-profile-page">
        <header className="character-hero">
          <div className="character-hero__identity">
            <div className="character-hero__status-dot" />
            <div>
              <h1>{displayNameWithPublicId}</h1>
              <div className="character-hero__meta">
                <span>{formatPlayerPublicId(player.publicId)}</span>
                <span>{player.title === "0" ? "The Absolute" : player.title}</span>
                <span>Level {player.level}</span>
                <span>{player.rank === "0" ? "Unranked" : player.rank}</span>
              </div>
            </div>
          </div>

          <div className="character-hero__quickstats">
            <div className="quickstat">
              <span className="quickstat__label">Net Worth</span>
              <strong>{formatGold(player.gold)}</strong>
            </div>
            <div className="quickstat">
              <span className="quickstat__label">Health</span>
              <strong>{Math.floor(player.stats.health)} / {player.stats.maxHealth}</strong>
            </div>
            <div className="quickstat">
              <span className="quickstat__label">Days</span>
              <strong>{player.daysPlayed}</strong>
            </div>
          </div>
        </header>

        <div className="character-layout">
          <div className="character-column">
            <PanelSection title="User Information">
              <div className="stat-table">
                <StatRow label="Name" value={displayNameWithPublicId} />
                <StatRow label="Public ID" value={formatPlayerPublicId(player.publicId)} />
                <StatRow label="Level" value={player.level} />
                <StatRow label="Rank" value={player.rank === "0" ? "Unranked" : player.rank} />
                <StatRow label="Title" value={player.title === "0" ? "The Absolute" : player.title} />
                <StatRow label="Days Played" value={player.daysPlayed} />
              </div>
            </PanelSection>

            <PanelSection title="General Stats">
              <div className="stat-table">
                <StatRow label="Gold" value={`${player.gold.toLocaleString("en-US")} gp`} />
                <StatRow label="Property" value={propertyName} />
                <StatRow label="Comfort" value={`${Math.floor(player.stats.comfort)} / ${player.stats.maxComfort}`} />
                <StatRow label="Energy" value={`${Math.floor(player.stats.energy)} / ${player.stats.maxEnergy}`} />
                <StatRow label="Stamina" value={`${Math.floor(player.stats.stamina)} / ${player.stats.maxStamina}`} />
              </div>
            </PanelSection>
          </div>

          <div className="character-column">
            <PanelSection title="Working Stats">
              <div className="stat-table">
                <StatRow label="Manual Labor" value={player.workingStats.manualLabor} />
                <StatRow label="Intelligence" value={player.workingStats.intelligence} />
                <StatRow label="Endurance" value={player.workingStats.endurance} />
              </div>
            </PanelSection>

            <PanelSection title="Battle Stats">
              <div className="stat-table">
                <StatRow label="Strength" value={player.battleStats.strength} />
                <StatRow label="Defense" value={player.battleStats.defense} />
                <StatRow label="Speed" value={player.battleStats.speed} />
                <StatRow label="Dexterity" value={player.battleStats.dexterity} />
              </div>
            </PanelSection>

            <PanelSection title="Property">
              <div className="stat-table">
                <StatRow label="Current" value={propertyName} />
                <StatRow label="Comfort Bonus" value={player.property.comfortProvided} />
                <StatRow label="Upgrades Installed" value={player.property.installedUpgrades.length} />
              </div>
            </PanelSection>
          </div>

          <div className="character-column">
            <PanelSection title="Inventory Snapshot">
              {inventoryCount === 0 ? (
                <div style={{ color: "#6a7a8a", fontSize: 13 }}>No items yet.</div>
              ) : (
                <div className="stat-table">
                  <StatRow label="Total items" value={inventoryCount} />
                  <StatRow label="Unique types" value={inventoryTypes} />
                  {Object.entries(player.inventory).slice(0, 8).map(([id, qty]) => (
                    <StatRow key={id} label={id} value={`×${qty}`} />
                  ))}
                  {inventoryTypes > 8 && (
                    <div style={{ color: "#6a7a8a", fontSize: 12, paddingTop: 4 }}>
                      …and {inventoryTypes - 8} more
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Current Status">
              <div className="stat-table">
                <StatRow label="Education" value={player.current.education?.name ?? "None"} />
                <StatRow label="Adventure" value={player.current.job ?? "No active contract"} />
                <StatRow label="Civic Jobs" value="Open Civic Jobs board" />
                <StatRow label="Travel" value={travelStatus} />
              </div>
            </PanelSection>

            <PanelSection title="Achievements" defaultOpen={false}>
              <div style={{ color: "#6a7a8a", fontSize: 13 }}>
                No achievements recorded yet.
              </div>
            </PanelSection>

            <PanelSection title="Legacy" defaultOpen={false}>
              <div style={{ color: "#6a7a8a", fontSize: 13 }}>
                No legacy entries recorded yet.
              </div>
            </PanelSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
