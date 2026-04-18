import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { formatPlayerNameWithPublicId } from "../lib/publicIds";
import {
  formatTravelDuration,
  getCityName,
  getTravelProgress,
  resolveTravelState,
} from "../lib/travelState";
import { getConsortiumSummary, getGuildSummary } from "../lib/organizations";
import { cielPageCopy } from "../data/cielPageCopy";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function QuickLinkRow({ label, to, disabledReason }: { label: string; to: string; disabledReason?: string | null }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value info-row__value--accent">
        {disabledReason ? (
          <span title={disabledReason} style={{ color: "#9aa7b4", cursor: "not-allowed" }}>
            Locked
          </span>
        ) : (
          <Link className="inline-route-link" to={to}>
            Open
          </Link>
        )}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { player, isHospitalized, hospitalRemainingLabel, isJailed, jailRemainingLabel } = usePlayer();
  const currentEducation = player.current.education;
  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, player.publicId);
  const travelState = resolveTravelState(player.internalId);
  const travelProgress = getTravelProgress(travelState, Date.now());
  const isTraveling = travelProgress.active;
  const guildSummary = getGuildSummary(player.internalId);
  const consortiumSummary = getConsortiumSummary(player.internalId);
  const homeCopy = cielPageCopy.home;

  const actionLockReason = isTraveling
    ? `Unavailable while traveling. Arrival in ${formatTravelDuration(travelProgress.remainingMs)}.`
    : isHospitalized
      ? `Unavailable while hospitalized. Recovery in ${hospitalRemainingLabel}.`
      : isJailed
        ? `Unavailable while jailed. Release in ${jailRemainingLabel}.`
        : null;

  const travelStatus = travelProgress.active
    ? `${getCityName(travelState.originCityId)} -> ${getCityName(travelState.destinationCityId)} | ${formatTravelDuration(travelProgress.remainingMs)}`
    : getCityName(travelState.currentCityId);

  return (
    <AppShell title="Home" hint={homeCopy.flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="World Overview">
          <p className="page-intro__lead">{homeCopy.flavor}</p>
          <p className="page-intro__body">{homeCopy.alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{homeCopy.ciel}</p>
        </ContentPanel>
      </div>

      <div className="nexis-grid">
        <div className="nexis-column">
          <ContentPanel title="General Information">
            <div className="info-list">
              <Row label="Name" value={displayNameWithPublicId} />
              <Row label="Level" value={player.level} />
              <Row label="Rank" value={player.rank || "0"} />
              <Row label="Age" value={`${player.daysPlayed} days`} />
              <Row label="Household" value={player.property.current || "No residence"} />
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
              <Row label="Education" value={currentEducation ? currentEducation.name : "No active course"} />
              <Row label="Travel" value={travelStatus} />
              <Row label="Adventure" value={player.current.job ?? "No active contract"} />
              <Row label="Guild" value={guildSummary} />
              <Row label="Consortium" value={consortiumSummary} />
              <Row
                label="Recovery"
                value={isHospitalized ? `Hospitalized | ${hospitalRemainingLabel}` : "Normal"}
              />
            </div>
          </ContentPanel>

          <ContentPanel title="Quick Actions">
            <div className="info-list">
              <QuickLinkRow label="Education" to="/education" disabledReason={actionLockReason} />
              <QuickLinkRow label="City" to="/city" disabledReason={actionLockReason} />
              <QuickLinkRow label="Adventure" to="/adventure" disabledReason={actionLockReason} />
              <QuickLinkRow label="Civic Jobs" to="/civic-jobs" disabledReason={actionLockReason} />
              <QuickLinkRow label="Guilds" to="/guilds" disabledReason={isTraveling ? actionLockReason : null} />
              <QuickLinkRow label="Consortiums" to="/consortiums" disabledReason={isTraveling ? actionLockReason : null} />
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
              <Row label="Comfort Cap" value={player.property.comfortProvided} />
            </div>
          </ContentPanel>

          <ContentPanel title="Condition">
            <div className="info-list">
              <Row label="State" value={isHospitalized ? "Hospitalized" : isJailed ? "Jailed" : "Healthy"} />
              <Row label="Remaining" value={isHospitalized ? hospitalRemainingLabel : isJailed ? jailRemainingLabel : "0m 0s"} />
              <Row
                label="Education"
                value={currentEducation ? "Continues during recovery" : "No active course"}
              />
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
