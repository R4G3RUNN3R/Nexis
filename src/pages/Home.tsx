import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { formatEntityPublicId, formatPlayerNameWithPublicId, getProfileRoute } from "../lib/publicIds";
import {
  formatTravelDuration,
  getCityName,
  getTravelProgress,
  readTravelStateFromPlayer,
} from "../lib/travelState";
import { getProfileView } from "../lib/profileApi";
import { resolveDisplayTitle } from "../lib/titleAccess";
import { getPropertyById } from "../data/propertyData";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function ActionLink({
  label,
  to,
  description,
  disabledReason,
}: {
  label: string;
  to: string;
  description: string;
  disabledReason?: string | null;
}) {
  return (
    <div className="home-action">
      <div className="home-action__copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      {disabledReason ? (
        <span className="home-action__lock" title={disabledReason}>
          Locked
        </span>
      ) : (
        <Link className="home-action__link" to={to}>
          Open
        </Link>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="summary-tile">
      <span className="summary-tile__label">{label}</span>
      <strong>{value}</strong>
      <span className="summary-tile__hint">{hint}</span>
    </div>
  );
}

export default function HomePage() {
  const { player, isHospitalized, hospitalRemainingLabel, isJailed, jailRemainingLabel } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const currentEducation = player.current.education;
  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayPublicId = activeAccount?.publicId ?? player.publicId;
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, displayPublicId);
  const displayTitle = resolveDisplayTitle(player.title, displayPublicId);
  const profileRoute = getProfileRoute(displayPublicId);
  const travelState = readTravelStateFromPlayer(player);
  const travelProgress = getTravelProgress(travelState, Date.now());
  const residenceName = getPropertyById(player.property.current)?.name ?? "No residence";
  const isTraveling = travelProgress.active;
  const [orgSummary, setOrgSummary] = useState({
    guild: "Unaffiliated",
    consortium: "Independent",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOrgSummary() {
      if (authSource !== "server" || !serverSessionToken) {
        if (!cancelled) {
          setOrgSummary({ guild: "Unaffiliated", consortium: "Independent" });
        }
        return;
      }

      const resolvedPublicId = activeAccount?.publicId ?? player.publicId;
      if (!resolvedPublicId) {
        if (!cancelled) {
          setOrgSummary({ guild: "Unaffiliated", consortium: "Independent" });
        }
        return;
      }

      const profile = await getProfileView(formatEntityPublicId("player", resolvedPublicId), serverSessionToken);
      if (cancelled) return;

      if (!profile.ok) {
        setOrgSummary({ guild: "Unavailable", consortium: "Unavailable" });
        return;
      }

      const guild = profile.profile.publicProfile.guild;
      const consortium = profile.profile.publicProfile.consortium;
      setOrgSummary({
        guild: guild ? `${guild.name} [${formatEntityPublicId("guild", guild.publicId)}]` : "Unaffiliated",
        consortium: consortium ? `${consortium.name} [${formatEntityPublicId("consortium", consortium.publicId)}]` : "Independent",
      });
    }

    void loadOrgSummary();

    return () => {
      cancelled = true;
    };
  }, [activeAccount?.publicId, authSource, player.publicId, serverSessionToken]);

  const guildSummary = useMemo(() => orgSummary.guild, [orgSummary.guild]);
  const consortiumSummary = useMemo(() => orgSummary.consortium, [orgSummary.consortium]);

  const actionLockReason = isTraveling
    ? `Unavailable while traveling. Arrival in ${formatTravelDuration(travelProgress.remainingMs)}.`
    : isHospitalized
      ? `Unavailable while hospitalized. Recovery in ${hospitalRemainingLabel}.`
      : isJailed
        ? `Unavailable while jailed. Release in ${jailRemainingLabel}.`
        : null;

  const travelStatus = travelProgress.active
    ? `${getCityName(travelState.originCityId)} to ${getCityName(travelState.destinationCityId)}`
    : getCityName(travelState.currentCityId);

  const conditionLabel = isHospitalized
    ? `Hospitalized for ${hospitalRemainingLabel}`
    : isJailed
      ? `Jailed for ${jailRemainingLabel}`
      : isTraveling
        ? `In caravan for ${formatTravelDuration(travelProgress.remainingMs)}`
        : "Ready for orders";

  const quickActions = [
    { label: "City", to: "/city", description: "District access and city services", disabledReason: actionLockReason },
    { label: "Education", to: "/education", description: "Courses, prerequisites, and outcomes", disabledReason: actionLockReason },
    { label: "Adventure", to: "/adventure", description: "Fieldwork, contracts, and risk bands", disabledReason: actionLockReason },
    { label: "Civic Jobs", to: "/civic-jobs", description: "Lawful ladder, pay, and job points", disabledReason: actionLockReason },
    { label: "Guilds", to: "/guilds", description: "Operations, dungeons, and war rooms", disabledReason: isTraveling ? actionLockReason : null },
    { label: "Consortiums", to: "/consortiums", description: "Companies, benefits, and workhouses", disabledReason: isTraveling ? actionLockReason : null },
  ];

  return (
    <AppShell title="Home" hint="Citizen command board, current obligations, and the parts of your life that matter before the next bad decision.">
      <div className="home-surface">
        <section className="home-hero">
          <div className="home-hero__identity">
            <div className="home-hero__crest">{displayNameWithPublicId.charAt(0)}</div>
            <div className="home-hero__copy">
              <div className="home-hero__eyebrow">Character command</div>
              <h1>{displayNameWithPublicId}</h1>
              <div className="home-hero__meta">
                <span>{displayTitle || "Untitled citizen"}</span>
                <span>Level {player.level}</span>
                <span>{travelStatus}</span>
                <span>{conditionLabel}</span>
              </div>
            </div>
          </div>

          <div className="home-hero__actions">
            <Link className="home-hero__action home-hero__action--primary" to={profileRoute}>
              Open character profile
            </Link>
            <Link className="home-hero__action" to="/travel">
              Review travel
            </Link>
            <Link className="home-hero__action" to="/inventory">
              Inspect inventory
            </Link>
          </div>
        </section>

        <section className="home-summary-strip">
          <SummaryTile label="Life" value={`${player.stats.health} / ${player.stats.maxHealth}`} hint={isHospitalized ? hospitalRemainingLabel : "Stable"} />
          <SummaryTile label="Energy" value={`${player.stats.energy} / ${player.stats.maxEnergy}`} hint="Daily operations" />
          <SummaryTile label="Education" value={currentEducation ? currentEducation.name : "No active course"} hint="Progression ledger" />
          <SummaryTile label="Guild" value={guildSummary} hint="Operational bloc" />
          <SummaryTile label="Consortium" value={consortiumSummary} hint="Economic footing" />
          <SummaryTile label="Residence" value={residenceName} hint="Current household" />
        </section>

        <div className="home-grid">
          <div className="home-grid__main">
            <ContentPanel title="Current Activity" className="panel--heroic">
              <div className="info-list">
                <Row label="Travel" value={travelProgress.active ? `${travelStatus} | ${formatTravelDuration(travelProgress.remainingMs)}` : travelStatus} />
                <Row label="Education" value={currentEducation ? currentEducation.name : "No active course"} />
                <Row label="Adventure" value={player.current.job ?? "No active contract"} />
                <Row label="Guild" value={guildSummary} />
                <Row label="Consortium" value={consortiumSummary} />
                <Row label="Condition" value={conditionLabel} />
              </div>
            </ContentPanel>

            <ContentPanel title="Operations Board">
              <div className="home-actions-grid">
                {quickActions.map((action) => (
                  <ActionLink
                    key={action.label}
                    label={action.label}
                    to={action.to}
                    description={action.description}
                    disabledReason={action.disabledReason}
                  />
                ))}
              </div>
            </ContentPanel>

            <ContentPanel title="Discipline and Readiness">
              <div className="home-stats-grid">
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Working discipline</div>
                  <div className="info-list">
                    <Row label="Manual Labor" value={player.workingStats.manualLabor} />
                    <Row label="Intelligence" value={player.workingStats.intelligence} />
                    <Row label="Endurance" value={player.workingStats.endurance} />
                  </div>
                </div>
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Battle footing</div>
                  <div className="info-list">
                    <Row label="Strength" value={player.battleStats.strength} />
                    <Row label="Defense" value={player.battleStats.defense} />
                    <Row label="Speed" value={player.battleStats.speed} />
                    <Row label="Dexterity" value={player.battleStats.dexterity} />
                  </div>
                </div>
              </div>
            </ContentPanel>
          </div>

          <div className="home-grid__rail">
            <ContentPanel title="Vital Ledger">
              <div className="info-list">
                <Row label="Energy" value={`${player.stats.energy} / ${player.stats.maxEnergy}`} />
                <Row label="Health" value={`${player.stats.health} / ${player.stats.maxHealth}`} />
                <Row label="Stamina" value={`${Math.floor(player.stats.stamina)} / ${player.stats.maxStamina}`} />
                <Row label="Comfort" value={`${player.stats.comfort} / ${player.stats.maxComfort}`} />
              </div>
            </ContentPanel>

            <ContentPanel title="Realm Standing">
              <div className="info-list">
                <Row label="Title" value={displayTitle || "Untitled citizen"} />
                <Row label="Rank" value={player.rank || "Unranked"} />
                <Row label="Age" value={`${player.daysPlayed} days`} />
                <Row label="Household" value={residenceName} />
                <Row label="Comfort Cap" value={player.property.comfortProvided} />
              </div>
            </ContentPanel>

            <ContentPanel title="Condition Report">
              <div className="info-list">
                <Row label="State" value={isHospitalized ? "Hospitalized" : isJailed ? "Jailed" : isTraveling ? "Traveling" : "Healthy"} />
                <Row label="Remaining" value={isHospitalized ? hospitalRemainingLabel : isJailed ? jailRemainingLabel : isTraveling ? formatTravelDuration(travelProgress.remainingMs) : "None"} />
                <Row label="Current City" value={getCityName(travelState.currentCityId)} />
                <Row label="Destination" value={travelProgress.active ? getCityName(travelState.destinationCityId) : "No active caravan"} />
              </div>
            </ContentPanel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
