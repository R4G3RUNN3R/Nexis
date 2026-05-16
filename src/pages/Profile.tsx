import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { getPropertyById } from "../data/propertyData";
import { formatPlayerPublicId, getProfileRoute, parsePlayerPublicId } from "../lib/publicIds";
import { resolveDisplayTitle } from "../lib/titleAccess";
import { getProfileView, type ProfileResponse, uploadOwnProfileImage } from "../lib/profileApi";
import { readCachedRuntimeState, writeCachedRuntimeState } from "../lib/runtimeStateCache";
import { getCityName, readTravelStateFromPlayer } from "../lib/travelState";
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

function QuickValue({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="profile-quickvalue">
      <span className="profile-quickvalue__label">{label}</span>
      <strong>{value}</strong>
      <span className="profile-quickvalue__hint">{hint}</span>
    </div>
  );
}

function formatCurrencyBlock(currencies: NonNullable<ProfileResponse["selfProfile"]>["currencies"]) {
  return `${currencies.platinum}p | ${currencies.gold}g | ${currencies.silver}s | ${currencies.copper}c`;
}

function derivePlayerCurrencies(gold: number) {
  return {
    platinum: 0,
    gold,
    silver: 0,
    copper: 0,
  };
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
  const { activeAccount, serverSessionToken } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);

  const targetPublicId = useMemo(() => {
    const parsed = parsePlayerPublicId(publicIdParam);
    if (parsed) return formatPlayerPublicId(parsed);
    const fallbackPublicId = activeAccount?.publicId ?? player.publicId;
    return fallbackPublicId ? formatPlayerPublicId(fallbackPublicId) : null;
  }, [activeAccount?.publicId, player.publicId, publicIdParam]);
  const ownPublicId = (activeAccount?.publicId ?? player.publicId) ? formatPlayerPublicId(activeAccount?.publicId ?? player.publicId) : null;
  const isOwnRoute = Boolean(targetPublicId && ownPublicId && targetPublicId === ownPublicId);

  const cachedPortrait = useMemo(() => {
    if (!activeAccount) return null;
    const cachedRuntime = readCachedRuntimeState(activeAccount.email);
    const cachedPlayer =
      cachedRuntime.player && typeof cachedRuntime.player === "object" && cachedRuntime.player !== null
        ? (cachedRuntime.player as Record<string, unknown>)
        : null;
    return cachedPlayer?.portrait && typeof cachedPlayer.portrait === "object" && cachedPlayer.portrait !== null
      ? (cachedPlayer.portrait as Record<string, unknown>)
      : null;
  }, [activeAccount]);

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
        setError(isOwnRoute ? null : result.error);
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
  }, [isOwnRoute, serverSessionToken, targetPublicId]);

  const flavor =
    "A citizen record should read like a lived station: title, health, movement, allegiances, holdings, and the inconvenient truths people are allowed to know.";

  const localPublicProfile = useMemo(() => {
    if (!isOwnRoute || !player.publicId) return null;
    const displayName = `${player.name}${player.lastName ? ` ${player.lastName}` : ""}`.trim() || "Unknown citizen";
    const meaningfulRank = typeof player.rank === "string" && player.rank && player.rank !== "0" ? player.rank : null;
    const travelState = readTravelStateFromPlayer(player);
    const isTraveling = travelState.status === "in_transit";
    const statusLabel =
      player.condition.type === "hospitalized"
        ? "Hospitalized"
        : player.condition.type === "jailed"
          ? "Jailed"
          : isTraveling
            ? "Traveling"
            : player.current.job
              ? "Working"
              : player.current.education?.name
                ? "Studying"
                : "Idle";

    return {
      name: displayName,
      publicId: player.publicId,
      title: player.title,
      entityType: "player" as const,
      level: player.level,
      rank: meaningfulRank,
      ageLabel: `${player.daysPlayed}d`,
      createdAt: Date.now() - player.daysPlayed * 86400000,
      life: {
        current: Number(player.stats.health ?? 0),
        max: Number(player.stats.maxHealth ?? 0),
      },
      lastAction: {
        isOnline: true,
        lastActionAt: Date.now(),
        label: "Online",
      },
      status: {
        label: statusLabel,
        condition: player.condition,
      },
      guild: profile?.publicProfile.guild ?? null,
      consortium: profile?.publicProfile.consortium ?? null,
      job: player.current.job ?? null,
      property: {
        propertyId: player.property.current ?? "shack",
      },
      travel: {
        summary: isTraveling
          ? `Travelling by caravan to ${getCityName(travelState.destinationCityId)}`
          : `In ${getCityName(travelState.currentCityId)}`,
      },
      portrait: profile?.publicProfile.portrait ?? {
        imageUrl: cachedPortrait
          ? typeof cachedPortrait.imageUrl === "string"
            ? cachedPortrait.imageUrl
            : typeof cachedPortrait.imageKey === "string"
              ? `/api/profile-images/${encodeURIComponent(cachedPortrait.imageKey)}`
              : null
          : null,
        hasCustomImage:
          cachedPortrait && typeof cachedPortrait.hasCustomImage === "boolean"
            ? cachedPortrait.hasCustomImage
            : Boolean(
                cachedPortrait &&
                  (typeof cachedPortrait.imageUrl === "string" || typeof cachedPortrait.imageKey === "string"),
              ),
      },
      bio: profile?.publicProfile.bio ?? {
        bio: null,
        signature: null,
        reservedNote: null,
      },
      legacyEntries: profile?.publicProfile.legacyEntries ?? [],
      counters: null,
    };
  }, [
    isOwnRoute,
    player.condition,
    player.current.education,
    player.current.job,
    player.current.travel,
    player.current.currentCityId,
    player.daysPlayed,
    player.lastName,
    player.level,
    player.name,
    player.property.current,
    player.publicId,
    player.rank,
    player.stats.health,
    player.stats.maxHealth,
    player.title,
    profile?.publicProfile.portrait,
    profile?.publicProfile.bio,
    profile?.publicProfile.consortium,
    profile?.publicProfile.guild,
    profile?.publicProfile.legacyEntries,
    cachedPortrait,
  ]);

  const resolvedPublicProfile = useMemo(() => {
    if (isOwnRoute && localPublicProfile) {
      return {
        ...(profile?.publicProfile ?? {}),
        ...localPublicProfile,
        guild: profile?.publicProfile?.guild ?? localPublicProfile.guild,
        consortium: profile?.publicProfile?.consortium ?? localPublicProfile.consortium,
        portrait: profile?.publicProfile?.portrait ?? localPublicProfile.portrait,
        bio: profile?.publicProfile?.bio ?? localPublicProfile.bio,
        legacyEntries: profile?.publicProfile?.legacyEntries ?? localPublicProfile.legacyEntries,
      };
    }
    return profile?.publicProfile ?? null;
  }, [isOwnRoute, localPublicProfile, profile?.publicProfile]);

  const resolvedSelfProfile = useMemo(() => {
    if (isOwnRoute) {
      return {
        currencies: derivePlayerCurrencies(player.gold),
        workingStats: player.workingStats,
        battleStats: player.battleStats,
        inventoryCount: Object.values(player.inventory ?? {}).reduce((total, value) => total + Number(value ?? 0), 0),
        inventoryTypes: Object.keys(player.inventory ?? {}).length,
      };
    }
    return profile?.selfProfile ?? null;
  }, [isOwnRoute, player.battleStats, player.gold, player.inventory, player.workingStats, profile?.selfProfile]);

  async function handlePortraitSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setUploadError(null);
    setUploadSuccess(null);

    if (!file || !isOwnRoute) return;

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setUploadError("Portrait must be PNG, JPEG, or WEBP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Portrait must be 2 MB or smaller.");
      return;
    }

    setUploadingPortrait(true);
    const result = await uploadOwnProfileImage(file, serverSessionToken);
    setUploadingPortrait(false);

    if (!result.ok) {
      setUploadError(result.error);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            publicProfile: {
              ...current.publicProfile,
              portrait: {
                imageUrl: result.imageUrl,
                hasCustomImage: true,
              },
            },
          }
        : current,
    );
    if (activeAccount) {
      const cachedRuntime = readCachedRuntimeState(activeAccount.email);
      writeCachedRuntimeState(activeAccount.email, {
        player: {
          ...cachedRuntime.player,
          portrait: {
            imageUrl: result.imageUrl,
            hasCustomImage: true,
            updatedAt: Date.now(),
          },
        },
      });
    }
    setUploadSuccess("Portrait updated.");
  }

  if (loading) {
    return (
      <AppShell title="Character Profile" hint={flavor}>
        <div className="character-profile-page">
          <section className="character-panel">
            <div className="character-panel__body">Loading citizen record...</div>
          </section>
        </div>
      </AppShell>
    );
  }

  if ((!resolvedPublicProfile && !isOwnRoute) || error) {
    return (
      <AppShell title="Character Profile" hint={flavor}>
        <div className="character-profile-page">
          <section className="character-panel">
            <div className="character-panel__body">
              <h2 className="character-profile-page__error-title">Citizen Record Unavailable</h2>
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

  const publicProfile = resolvedPublicProfile ?? localPublicProfile;
  const selfProfile = resolvedSelfProfile;
  const moderation = profile?.moderation ?? null;
  const viewer = {
    mode: isOwnRoute ? ("self" as const) : profile?.viewer.mode ?? "public",
    canModerate: profile?.viewer.canModerate ?? false,
    isSelf: isOwnRoute,
  };

  if (!publicProfile) {
    return null;
  }

  const propertyName = getPropertyById(publicProfile.property.propertyId)?.name ?? "Unknown residence";
  const displayTitle = resolveDisplayTitle(publicProfile.title, publicProfile.publicId);
  const displayNameWithPublicId = `${publicProfile.name} [${formatPlayerPublicId(publicProfile.publicId)}]`;
  const guildLabel = publicProfile.guild
    ? `${publicProfile.guild.name} [G${String(publicProfile.guild.publicId).padStart(7, "0")}]`
    : "Unaffiliated";
  const consortiumLabel = publicProfile.consortium
    ? `${publicProfile.consortium.name} [C${String(publicProfile.consortium.publicId).padStart(7, "0")}]`
    : "Independent";
  const guildRoute = publicProfile.guild ? "/guilds/G" + String(publicProfile.guild.publicId).padStart(7, "0") : null;
  const consortiumRoute = publicProfile.consortium ? "/consortiums/C" + String(publicProfile.consortium.publicId).padStart(7, "0") : null;
  const profileMode =
    viewer.isSelf
      ? "Private record"
      : viewer.mode === "staff"
        ? "Staff oversight"
        : "Public dossier";
  const profileInitials = publicProfile.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
  const portraitUrl = publicProfile.portrait.imageUrl;
  const canEditPortrait = viewer.isSelf;
  const characterFacts = [
    { label: "Property", value: propertyName },
    {
      label: "Guild",
      value: guildRoute ? <Link className="inline-route-link" to={guildRoute}>{guildLabel}</Link> : guildLabel,
    },
    {
      label: "Consortium",
      value: consortiumRoute ? <Link className="inline-route-link" to={consortiumRoute}>{consortiumLabel}</Link> : consortiumLabel,
    },
    { label: "Current Job", value: publicProfile.job ?? "None" },
    { label: "Travel", value: publicProfile.travel.summary },
    { label: "Status", value: publicProfile.status.label },
  ];

  return (
    <AppShell title="Character Profile" hint={flavor}>
      <div className="character-profile-page">
        <header className="profile-identity-stage">
          <div className="profile-portrait-panel">
            <div className="profile-portrait-frame">
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={`${publicProfile.name} portrait`}
                  className="profile-portrait-frame__image"
                />
              ) : (
                <div className="profile-portrait-frame__placeholder" aria-label="Portrait placeholder">
                  <div className="profile-portrait-frame__placeholder-mark">{profileInitials || "NC"}</div>
                  <div className="profile-portrait-frame__placeholder-copy">
                    <span>Portrait pending</span>
                    <strong>No likeness recorded</strong>
                  </div>
                </div>
              )}
            </div>

            {canEditPortrait ? (
              <div className="profile-portrait-controls">
                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="profile-portrait-controls__input"
                  onChange={handlePortraitSelection}
                />
                <button
                  type="button"
                  className="profile-portrait-controls__button"
                  onClick={() => portraitInputRef.current?.click()}
                  disabled={uploadingPortrait}
                >
                  {uploadingPortrait ? "Uploading..." : portraitUrl ? "Change portrait" : "Upload portrait"}
                </button>
                <div className="profile-portrait-controls__hint">PNG, JPEG, or WEBP. Max 2 MB.</div>
                {uploadError ? <div className="profile-portrait-controls__message profile-portrait-controls__message--error">{uploadError}</div> : null}
                {uploadSuccess ? <div className="profile-portrait-controls__message">{uploadSuccess}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="profile-identity-shell">
            <div className="profile-masthead">
              <div className="profile-masthead__identity">
                <div className="profile-masthead__copy">
                  <div className="profile-masthead__eyebrow">Citizen dossier</div>
                  <h1>{displayNameWithPublicId}</h1>
                  <div className="profile-masthead__badges">
                    <span>{profileMode}</span>
                    <span>{formatEntityLabel(publicProfile.entityType)}</span>
                    <span>{displayTitle || "Untitled"}</span>
                    <span>Level {publicProfile.level}</span>
                    {publicProfile.rank ? <span>{publicProfile.rank}</span> : null}
                  </div>
                  <div className="profile-masthead__statusline">
                    <span>{publicProfile.status.label}</span>
                    <span>{publicProfile.lastAction.label}</span>
                    <span>{publicProfile.travel.summary}</span>
                  </div>
                </div>
              </div>

              <div className="profile-masthead__aside">
                <QuickValue label="Life" value={`${publicProfile.life.current} / ${publicProfile.life.max}`} hint="Current vitality" />
                <QuickValue label="Age" value={publicProfile.ageLabel} hint="Recorded service" />
                <QuickValue label="Presence" value={publicProfile.lastAction.label} hint={publicProfile.lastAction.isOnline ? "Live on shard" : "Recent activity"} />
              </div>
            </div>

            <section className="profile-facts-strip">
              {characterFacts.map((fact) => (
                <div key={fact.label} className="profile-fact-tile">
                  <span className="profile-fact-tile__label">{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </section>
          </div>
        </header>

        <div className="profile-body">
          <div className="profile-body__main">
            <PanelSection title="Identity and Standing">
              <div className="stat-table">
                <StatRow label="Name" value={displayNameWithPublicId} />
                <StatRow label="Title" value={displayTitle || "Untitled"} />
                <StatRow label="Classification" value={formatEntityLabel(publicProfile.entityType)} />
                <StatRow label="Status" value={publicProfile.status.label} />
                <StatRow label="Last Action" value={publicProfile.lastAction.label} />
              </div>
            </PanelSection>

            <PanelSection title="Affiliations and Standing">
              <div className="profile-affiliation-grid">
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Residence</div>
                  <div className="profile-affiliation-grid__value">{propertyName}</div>
                </div>
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Guild</div>
                  <div className="profile-affiliation-grid__value">{guildRoute ? <Link className="inline-route-link" to={guildRoute}>{guildLabel}</Link> : guildLabel}</div>
                </div>
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Consortium</div>
                  <div className="profile-affiliation-grid__value">{consortiumRoute ? <Link className="inline-route-link" to={consortiumRoute}>{consortiumLabel}</Link> : consortiumLabel}</div>
                </div>
                <div className="panel-cluster">
                  <div className="panel-cluster__title">Current Duty</div>
                  <div className="profile-affiliation-grid__value">{publicProfile.job ?? "None"}</div>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Legacy Record">
              <div className="profile-narrative">
                <p>{publicProfile.bio.bio ?? publicProfile.bio.reservedNote ?? "No public biography has been recorded yet."}</p>
                {publicProfile.bio.signature ? <div className="profile-narrative__signature">"{publicProfile.bio.signature}"</div> : null}
              </div>
              {publicProfile.legacyEntries.length ? (
                <div className="legacy-list">
                  {publicProfile.legacyEntries.map((entry) => (
                    <article key={entry.id} className="legacy-entry">
                      <div className="legacy-entry__date">{new Date(entry.awardedAt).toLocaleDateString("en-GB")}</div>
                      <h3>{entry.title}</h3>
                      <p>{entry.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="profile-empty-note">No legacy entries have been recorded yet.</div>
              )}
            </PanelSection>
          </div>

          <div className="profile-body__rail">
            <PanelSection title="Selected Facts">
              <div className="stat-table">
                <StatRow label="Classification" value={formatEntityLabel(publicProfile.entityType)} />
                <StatRow label="Standing" value={displayTitle || "Untitled"} />
                <StatRow label="Life" value={`${publicProfile.life.current} / ${publicProfile.life.max}`} />
                <StatRow label="Presence" value={publicProfile.lastAction.isOnline ? "Online" : "Offline"} />
                <StatRow label="Condition" value={publicProfile.status.condition.reason ?? "No active condition"} />
                <StatRow label="Recorded At" value={publicProfile.lastAction.lastActionAt ? new Date(publicProfile.lastAction.lastActionAt).toLocaleString("en-GB") : "Unknown"} />
              </div>
            </PanelSection>

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
              <PanelSection title="Private Discipline">
                <div className="profile-split-list">
                  <div className="panel-cluster">
                    <div className="panel-cluster__title">Working</div>
                    <div className="stat-table">
                      <StatRow label="Manual Labor" value={selfProfile.workingStats.manualLabor} />
                      <StatRow label="Intelligence" value={selfProfile.workingStats.intelligence} />
                      <StatRow label="Endurance" value={selfProfile.workingStats.endurance} />
                    </div>
                  </div>

                  <div className="panel-cluster">
                    <div className="panel-cluster__title">Battle</div>
                    <div className="stat-table">
                      <StatRow label="Strength" value={selfProfile.battleStats.strength} />
                      <StatRow label="Defense" value={selfProfile.battleStats.defense} />
                      <StatRow label="Speed" value={selfProfile.battleStats.speed} />
                      <StatRow label="Dexterity" value={selfProfile.battleStats.dexterity} />
                    </div>
                  </div>
                </div>
              </PanelSection>
            ) : null}

            {moderation ? (
              <PanelSection title="Staff Oversight">
                <div className="stat-table">
                  <StatRow label="Email" value={moderation.email} />
                  <StatRow label="Internal ID" value={moderation.internalId} />
                  <StatRow label="Entity Type" value={moderation.entityType} />
                  <StatRow label="Privilege Role" value={moderation.privilegeRole} />
                  {moderation.reservedIdentityName ? (
                    <StatRow label="Reserved Identity" value={moderation.reservedIdentityName} />
                  ) : null}
                </div>
                {viewer.canModerate ? (
                  <div className="profile-empty-note">Administrative intervention remains available through the control panel.</div>
                ) : null}
              </PanelSection>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
