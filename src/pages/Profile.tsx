import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { getPropertyById } from "../data/propertyData";
import { formatPlayerPublicId, getProfileRoute, parsePlayerPublicId } from "../lib/publicIds";
import { resolveDisplayTitle } from "../lib/titleAccess";
import { getProfileView, type ProfileResponse } from "../lib/profileApi";
import "../styles/character-profile.css";

type PanelSectionProps = {
  title: string;
  children: ReactNode;
};

function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="character-panel">
      <div className="character-panel__header">
        <span>{title}</span>
      </div>
      <div className="character-panel__body">{children}</div>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <strong className="stat-row__value">{value}</strong>
    </div>
  );
}

function formatCurrencyBlock(currencies: NonNullable<ProfileResponse["selfProfile"]>["currencies"]) {
  return `${currencies.platinum}p | ${currencies.gold}g | ${currencies.silver}s | ${currencies.copper}c`;
}

function formatEntityLabel(entityType: ProfileResponse["publicProfile"]["entityType"]) {
  switch (entityType) {
    case "npc":
      return "NPC";
    case "system":
      return "System";
    case "event":
      return "Event";
    default:
      return "Citizen";
  }
}

export default function ProfilePage() {
  const { publicId: publicIdParam } = useParams();
  const { player } = usePlayer();
  const { serverSessionToken } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetPublicId = useMemo(() => {
    const parsed = parsePlayerPublicId(publicIdParam);
    if (parsed) return formatPlayerPublicId(parsed);
    return player.publicId ? formatPlayerPublicId(player.publicId) : null;
  }, [player.publicId, publicIdParam]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!targetPublicId) {
        setError("Citizen record unavailable.");
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getProfileView(targetPublicId, serverSessionToken);
      if (cancelled) return;

      if (!result.ok) {
        setProfile(null);
        setError(result.error);
        setLoading(false);
        return;
      }

      setProfile(result.profile);
      setError(null);
      setLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [serverSessionToken, targetPublicId]);

  if (loading) {
    return (
      <AppShell title="Character Profile">
        <div className="character-profile-page">
          <section className="character-panel">
            <div className="character-panel__body">Loading citizen record...</div>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!profile || error) {
    return (
      <AppShell title="Character Profile">
        <div className="character-profile-page">
          <section className="character-panel">
            <div className="character-panel__body">
              <h2 style={{ marginTop: 0 }}>Citizen Record Unavailable</h2>
              <p>{error ?? "This record could not be loaded from the live shard."}</p>
              <Link className="inline-route-link" to={getProfileRoute(player.publicId)}>
                Return to your own profile
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  const { publicProfile, selfProfile, moderation, viewer } = profile;
  const propertyName = getPropertyById(publicProfile.property.propertyId)?.name ?? "Unknown residence";
  const displayTitle = resolveDisplayTitle(publicProfile.title, publicProfile.publicId);
  const displayNameWithPublicId = `${publicProfile.name} [${formatPlayerPublicId(publicProfile.publicId)}]`;
  const guildLabel = publicProfile.guild ? `${publicProfile.guild.name} [G${String(publicProfile.guild.publicId).padStart(7, "0")}]` : "Unaffiliated";
  const consortiumLabel = publicProfile.consortium ? `${publicProfile.consortium.name} [C${String(publicProfile.consortium.publicId).padStart(7, "0")}]` : "Independent";

  return (
    <AppShell title="Character Profile">
      <div className="character-profile-page">
        <header className="character-hero">
          <div className="character-hero__identity">
            <div className="character-hero__status-dot" />
            <div>
              <h1>{displayNameWithPublicId}</h1>
              <div className="character-hero__meta">
                <span>{formatEntityLabel(publicProfile.entityType)}</span>
                <span>{displayTitle || "Untitled"}</span>
                <span>Level {publicProfile.level}</span>
                {publicProfile.rank ? <span>{publicProfile.rank}</span> : null}
              </div>
            </div>
          </div>

          <div className="character-hero__quickstats">
            <div className="quickstat">
              <span className="quickstat__label">Life</span>
              <strong>{publicProfile.life.current} / {publicProfile.life.max}</strong>
            </div>
            <div className="quickstat">
              <span className="quickstat__label">Age</span>
              <strong>{publicProfile.ageLabel}</strong>
            </div>
            <div className="quickstat">
              <span className="quickstat__label">Last Action</span>
              <strong>{publicProfile.lastAction.label}</strong>
            </div>
          </div>
        </header>

        <div className="character-layout">
          <div className="character-column">
            <PanelSection title="Identity">
              <div className="stat-table">
                <StatRow label="Name" value={displayNameWithPublicId} />
                <StatRow label="Title" value={displayTitle || "Untitled"} />
                <StatRow label="Level" value={publicProfile.level} />
                {publicProfile.rank ? <StatRow label="Rank" value={publicProfile.rank} /> : null}
                <StatRow label="Classification" value={formatEntityLabel(publicProfile.entityType)} />
                <StatRow label="Status" value={publicProfile.status.label} />
              </div>
            </PanelSection>

            <PanelSection title="Residence and Affiliation">
              <div className="stat-table">
                <StatRow label="Property" value={propertyName} />
                <StatRow label="Guild" value={guildLabel} />
                <StatRow label="Consortium" value={consortiumLabel} />
                <StatRow label="Current Job" value={publicProfile.job ?? "None"} />
                <StatRow label="Travel" value={publicProfile.travel.summary} />
              </div>
            </PanelSection>
          </div>

          <div className="character-column">
            <PanelSection title="Status Block">
              <div className="stat-table">
                <StatRow label="Life" value={`${publicProfile.life.current} / ${publicProfile.life.max}`} />
                <StatRow label="Presence" value={publicProfile.lastAction.isOnline ? "Online" : "Offline"} />
                <StatRow label="Last Action" value={publicProfile.lastAction.label} />
                <StatRow label="Condition" value={publicProfile.status.condition.reason ?? "No active condition"} />
              </div>
            </PanelSection>

            <PanelSection title="Legacy and Bio">
              <div style={{ display: "grid", gap: 10, color: "#d7dee6", fontSize: 13 }}>
                <div>{publicProfile.bio.bio ?? publicProfile.bio.reservedNote ?? "No public biography has been recorded yet."}</div>
                {publicProfile.bio.signature ? <div style={{ color: "#9fb0bf" }}>"{publicProfile.bio.signature}"</div> : null}
              </div>
            </PanelSection>
          </div>

          <div className="character-column">
            {viewer.isSelf && selfProfile ? (
              <PanelSection title="Private Holdings">
                <div className="stat-table">
                  <StatRow label="Currencies" value={formatCurrencyBlock(selfProfile.currencies)} />
                  <StatRow label="Inventory Count" value={selfProfile.inventoryCount} />
                  <StatRow label="Inventory Types" value={selfProfile.inventoryTypes} />
                </div>
              </PanelSection>
            ) : null}

            {viewer.isSelf && selfProfile ? (
              <PanelSection title="Private Stats">
                <div className="stat-table">
                  <StatRow label="Manual Labor" value={selfProfile.workingStats.manualLabor} />
                  <StatRow label="Intelligence" value={selfProfile.workingStats.intelligence} />
                  <StatRow label="Endurance" value={selfProfile.workingStats.endurance} />
                  <StatRow label="Strength" value={selfProfile.battleStats.strength} />
                  <StatRow label="Defense" value={selfProfile.battleStats.defense} />
                  <StatRow label="Speed" value={selfProfile.battleStats.speed} />
                  <StatRow label="Dexterity" value={selfProfile.battleStats.dexterity} />
                </div>
              </PanelSection>
            ) : null}

            {moderation ? (
              <PanelSection title="Staff View">
                <div className="stat-table">
                  <StatRow label="Email" value={moderation.email} />
                  <StatRow label="Internal ID" value={moderation.internalId} />
                  <StatRow label="Entity Type" value={moderation.entityType} />
                  <StatRow label="Privilege Role" value={moderation.privilegeRole} />
                  {moderation.reservedIdentityName ? <StatRow label="Reserved Identity" value={moderation.reservedIdentityName} /> : null}
                </div>
              </PanelSection>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
