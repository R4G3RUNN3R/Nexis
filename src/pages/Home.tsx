import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { formatPlayerNameWithPublicId } from "../lib/publicIds";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function QuickLinkRow({ label, to }: { label: string; to: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value info-row__value--accent">
        <Link className="inline-route-link" to={to}>
          Open
        </Link>
      </span>
    </div>
  );
}

export default function HomePage() {
  const { player, isHospitalized, hospitalRemainingLabel } = usePlayer();
  const currentEducation = player.current.education;
  const displayName = player.lastName
    ? `${player.name} ${player.lastName}`
    : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);

  return (
    <AppShell
      title="Home"
      hint="Control panel. Civic employment now sits separately from adventure work, because structure is better than chaos pretending to be design."
    >
      <div className="nexis-grid">
        <div className="nexis-column">
          <ContentPanel title="General Information">
            <div className="info-list">
              <Row label="Name" value={displayNameWithPublicId} />
              <Row label="Level" value={player.level} />
              <Row label="Rank" value={player.rank} />
              <Row label="Age" value={`${player.daysPlayed} days`} />
              <Row label="Marital Status" value="0" />
            </div>
          </ContentPanel>

          <ContentPanel title="Working Stats">
            <div className="info-list">
              <Row label="Manual Labor" value={player.workingStats.manualLabor} />
              <Row label="Intelligence" value={player.workingStats.intelligence} />
              <Row label="Endurance" value={player.workingStats.endurance} />
            </div>
          </ContentPanel>

          <ContentPanel title="Battle Stats">
            <div className="info-list">
              <Row label="Strength" value={player.battleStats.strength} />
              <Row label="Defense" value={player.battleStats.defense} />
              <Row label="Speed" value={player.battleStats.speed} />
              <Row label="Dexterity" value={player.battleStats.dexterity} />
            </div>
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Current Activity">
            <div className="info-list">
              <Row label="Education" value={currentEducation ? currentEducation.name : "None"} />
              <Row label="Travel" value={player.current.travel ?? "None"} />
              <Row label="Adventure" value={player.current.job ?? "No active contract"} />
              <Row label="Civic Jobs" value="Open Civic Jobs board" />
              <Row
                label="Recovery"
                value={isHospitalized ? `Hospitalized • ${hospitalRemainingLabel}` : "Normal"}
              />
            </div>
          </ContentPanel>

          <ContentPanel title="Quick Actions">
            <div className="info-list">
              <QuickLinkRow label="Education" to="/education" />
              <QuickLinkRow label="City" to="/city" />
              <QuickLinkRow label="Adventure" to="/adventure" />
              <QuickLinkRow label="Civic Jobs" to="/civic-jobs" />
              <QuickLinkRow label="Travel" to="/travel" />
              <QuickLinkRow label="City Board" to="/city-board" />
            </div>
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Core Stats">
            <div className="info-list">
              <Row label="Energy" value={`${player.stats.energy} / ${player.stats.maxEnergy}`} />
              <Row label="Health" value={`${player.stats.health} / ${player.stats.maxHealth}`} />
              <Row label="Stamina" value={`${Math.floor(player.stats.stamina)} / ${player.stats.maxStamina}`} />
              <Row label="Comfort" value={`${player.stats.comfort} / ${player.stats.maxComfort}`} />
            </div>
          </ContentPanel>

          <ContentPanel title="Housing">
            <div className="info-list">
              <Row label="Property" value={player.property.current} />
              <Row label="Comfort Bonus" value={player.property.comfortProvided} />
            </div>
          </ContentPanel>

          <ContentPanel title="Hospital Status">
            <div className="info-list">
              <Row label="State" value={isHospitalized ? "Hospitalized" : "Healthy"} />
              <Row label="Remaining" value={isHospitalized ? hospitalRemainingLabel : "0m 0s"} />
              <Row
                label="Education"
                value={currentEducation ? "Continues while hospitalized" : "No active course"}
              />
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
