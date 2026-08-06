import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { OrganizationBaseTab } from "../components/organizations/OrganizationBaseTab";
import { OrganizationOneShotsPanel } from "../components/organizations/OrganizationOneShotsPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { formatEntityPublicId } from "../lib/publicIds";
import { GuildBannerIcon, ArmoryIcon, QuestIcon, DungeonIcon, SkillNodeIcon } from "../assets/icons/orgIcons";
import {
  applyToGuild,
  assignGuildQuestMember,
  cancelGuildQuest,
  createOrganization,
  depositGuildArmory,
  getMyOrganization,
  getOrganizationByPublicId,
  initiateGuildQuest,
  inviteGuildMember,
  launchGuildDungeon,
  planGuildQuest,
  replanGuildQuest,
  respondToGuildInvite,
  reviewGuildApplication,
  swapGuildSkill,
  triggerGuildRally,
  unlockGuildSkill,
  updateGuildSettings,
  withdrawGuildArmory,
} from "../lib/organizationApi";
import { formatDate, readGuildBoard, type GuildBoard } from "../lib/organizations";
import "../styles/guild.css";

const GUILD_PAGE_COPY = {
  flavor: "A public charter outside, a command structure inside: roster, wars, adventuring, doctrine, and an armory.",
  ciel: "CIEL's take: stable guilds run on doctrine, supply, and timing -- organized paranoia, mostly.",
};

type GuildView = GuildBoard;
type GuildMemberTab = "hall" | "roster" | "operations";
type GuildCommandTab = "doctrine" | "quests" | "armory" | "war" | "base" | "settings";
type GuildTab = GuildMemberTab | GuildCommandTab;
type GuildViewMode = "member" | "command";

const MEMBER_TABS: Array<{ key: GuildMemberTab; label: string }> = [
  { key: "hall", label: "Hall" },
  { key: "roster", label: "Roster" },
  { key: "operations", label: "Operations" },
];

const COMMAND_TABS: Array<{ key: GuildCommandTab; label: string }> = [
  { key: "doctrine", label: "Doctrine" },
  { key: "quests", label: "Quests & Dungeons" },
  { key: "armory", label: "Armory" },
  { key: "war", label: "War Room" },
  { key: "base", label: "Base" },
  { key: "settings", label: "Charter Settings" },
];

function formatMsCountdown(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function formatHoursLabel(hours: number) {
  if (hours % 24 === 0) return `${hours / 24}d`;
  return `${hours}h`;
}

function formatCountdown(targetAt: number) {
  const diff = Math.max(0, targetAt - Date.now());
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function refreshPlayerCache(
  email: string,
  user: { internalPlayerId: string; publicId: number; firstName: string; lastName: string },
  playerState: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"],
) {
  mergeServerStateIntoCache({ email, user, playerState });
  window.dispatchEvent(new CustomEvent("nexis:player-refresh"));
}

export default function GuildsPage() {
  const { publicId: publicIdParam } = useParams();
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [board, setBoard] = useState<GuildView | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [guildName, setGuildName] = useState("");
  const [guildTag, setGuildTag] = useState("");
  const [recruitPublicId, setRecruitPublicId] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [directory, setDirectory] = useState<Array<Record<string, unknown>>>([]);
  const [armoryItemId, setArmoryItemId] = useState("");
  const [armoryQty, setArmoryQty] = useState("1");
  const [withdrawItemId, setWithdrawItemId] = useState("");
  const [withdrawQty, setWithdrawQty] = useState("1");
  const [viewMode, setViewMode] = useState<GuildViewMode>("member");
  const [activeTab, setActiveTab] = useState<GuildTab>("hall");
  const [settingsDraft, setSettingsDraft] = useState({
    headline: "",
    recruitmentStatus: "",
    doctrine: "",
    territory: "",
    diplomacy: "",
    publicNotice: "",
    invitePolicy: "",
    warDoctrine: "",
  });
  const [questAssignments, setQuestAssignments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [boardLoadError, setBoardLoadError] = useState<string | null>(null);
  const routeOrganizationPublicId = typeof publicIdParam === "string" ? publicIdParam.trim() : "";
  const isDetailRoute = routeOrganizationPublicId.length > 0;
  const hasGuildCharter = (player.inventory.guild_charter ?? 0) > 0;
  const foundingCost = hasGuildCharter ? 50000 : 150000;
  const pageCopy = GUILD_PAGE_COPY;

  useEffect(() => {
    setMessage(null);
  }, [activeTab, routeOrganizationPublicId]);

  useEffect(() => {
    if (authSource === "server" && serverSessionToken) {
      setLoadingBoard(true);
      void (isDetailRoute
        ? getOrganizationByPublicId(serverSessionToken, "guild", routeOrganizationPublicId)
        : getMyOrganization(serverSessionToken, "guild"))
        .then((result) => {
          if ("ok" in result && result.ok === false) {
            setBoardLoadError(result.error);
            return;
          }
          setBoardLoadError(null);
          setBoard((result as { organization: GuildView | null }).organization);
          setDirectory((result as { directory?: Array<Record<string, unknown>> }).directory ?? []);
        })
        .finally(() => setLoadingBoard(false));
      return;
    }
    setLoadingBoard(false);
    setBoard(readGuildBoard(player.internalId) as GuildView | null);
  }, [authSource, isDetailRoute, player.internalId, routeOrganizationPublicId, serverSessionToken]);

  useEffect(() => {
    if (!board?.settingsView) return;
    setSettingsDraft({
      headline: board.settingsView.publicProfile?.headline ?? "",
      recruitmentStatus: board.settingsView.publicProfile?.recruitmentStatus ?? "",
      doctrine: board.settingsView.publicProfile?.doctrine ?? "",
      territory: board.settingsView.publicProfile?.territory ?? "",
      diplomacy: board.settingsView.publicProfile?.diplomacy ?? "",
      publicNotice: board.settingsView.publicProfile?.publicNotice ?? "",
      invitePolicy: board.settingsView.invitePolicy ?? "",
      warDoctrine: board.settingsView.warDoctrine ?? "",
    });
  }, [board?.internalId, board?.settingsView]);

  useEffect(() => {
    const currentPlan = board?.guildQuestBoard?.currentPlan;
    if (!currentPlan) {
      setQuestAssignments({});
      return;
    }
    setQuestAssignments(Object.fromEntries(currentPlan.slots.map((slot: any) => [slot.slotKey, slot.assignedMember?.publicId ? String(slot.assignedMember.publicId) : ""])));
  }, [board?.guildQuestBoard?.currentPlan]);

  const guildBlockReason = useMemo(() => {
    if (board) return "You already run a guild on this character.";
    if (guildName.trim().length < 3) return "Guild name must be at least 3 characters.";
    if (guildTag.trim().length < 2) return "Guild tag must be at least 2 characters.";
    if (player.gold < foundingCost) return `You need ${(foundingCost - player.gold).toLocaleString("en-GB")} more gold.`;
    return null;
  }, [board, guildName, guildTag, player.gold, foundingCost]);

  const canManageMembers = !!board?.viewerPermissions?.includes("recruit_members");
  const canManageDoctrine = !!board?.viewerPermissions?.includes("declare_operations");
  const canManageTreasury = !!board?.viewerPermissions?.includes("manage_treasury");
  const isLeaderTier = canManageMembers || canManageDoctrine || canManageTreasury;
  const inventoryOptions = useMemo(
    () => Object.entries(player.inventory).filter(([, qty]) => Number(qty) > 0).map(([itemId, qty]) => ({ itemId, quantity: Number(qty) })),
    [player.inventory],
  );
  const recentWarHistory = board?.warRoom?.recentHistory ?? [];
  const activeWars = board?.warRoom?.activeWars ?? [];
  const armoryItems = board?.armory?.items ?? [];
  const guildAcademy = asRecord(asRecord(board).academyContract);
  const guildAcademyAdventuring = asRecord(guildAcademy.adventuringSurvival);
  const guildAcademyCompletionPct = readNumber(guildAcademyAdventuring.averageTrackCompletionPct);
  const guildAcademyCompletedCourses = readNumber(guildAcademyAdventuring.averageCompletedCourses);
  const guildAcademyRequiredCourses = Math.max(1, readNumber(guildAcademyAdventuring.requiredCourses));
  const guildAcademyReadinessPct = readNumber(guildAcademyAdventuring.guildReadinessPct);
  const guildAcademySurvivalPct = readNumber(guildAcademyAdventuring.operationSurvivalPct);
  const guildAcademyBattleEdgePct = readNumber(guildAcademyAdventuring.battleEdgePct);
  const skillTreeState = board?.skillTree;
  const coreSkills = skillTreeState?.core ?? [];
  const specializations = skillTreeState?.specializations ?? [];
  const activeSpecializations = specializations.filter((entry: any) => entry.isActive);
  const specializationCap = skillTreeState?.cap ?? 3;
  const dungeonTemplates = board?.dungeonBoard ?? [];
  const [swapTargetByKey, setSwapTargetByKey] = useState<Record<string, string>>({});

  async function reloadGuild() {
    if (authSource !== "server" || !serverSessionToken) return;
    setLoadingBoard(true);
    const result = await getMyOrganization(serverSessionToken, "guild");
    if ("ok" in result && result.ok === false) {
      setBoardLoadError(result.error);
      setLoadingBoard(false);
      return;
    }
    setBoardLoadError(null);
    setBoard((result as { organization: GuildView | null }).organization);
    setLoadingBoard(false);
  }

  async function createGuild() {
    if (guildBlockReason || authSource !== "server" || !activeAccount || !serverSessionToken) return;
    const result = await createOrganization(serverSessionToken, {
      type: "guild",
      name: guildName.trim(),
      tag: guildTag.trim(),
    });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    const payload = result as {
      organization: GuildView;
      playerState: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"];
    };
    setBoard(payload.organization);
    setGuildName("");
    setGuildTag("");
    setViewMode("member");
    setActiveTab("hall");
    refreshPlayerCache(
      activeAccount.email,
      {
        internalPlayerId: activeAccount.internalPlayerId,
        publicId: activeAccount.publicId,
        firstName: activeAccount.firstName,
        lastName: activeAccount.lastName,
      },
      payload.playerState,
    );
    setMessage(`Guild founded: ${payload.organization.name} [${formatEntityPublicId("guild", payload.organization.publicId)}]`);
  }

  async function runGuildAction(
    runner: () => Promise<any>,
    options?: { message?: (payload: any) => string; refreshPlayerState?: boolean },
  ) {
    if (!activeAccount || !serverSessionToken) return;
    const result = await runner();
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    const payload = result as { organization?: GuildView; playerState?: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"] };
    if (payload.organization) setBoard(payload.organization);
    if (payload.playerState && options?.refreshPlayerState) {
      refreshPlayerCache(
        activeAccount.email,
        {
          internalPlayerId: activeAccount.internalPlayerId,
          publicId: activeAccount.publicId,
          firstName: activeAccount.firstName,
          lastName: activeAccount.lastName,
        },
        payload.playerState,
      );
    }
    if (options?.message) setMessage(options.message(payload));
  }

  function switchToMemberView() {
    setViewMode("member");
    setActiveTab("hall");
  }

  function switchToCommandView() {
    setViewMode("command");
    setActiveTab("doctrine");
  }

  const isGuildMember = Boolean(board?.viewerPermissions && board.viewerPermissions.length > 0);
  const guildOverview = asRecord((board as (GuildView & { guildOverview?: unknown }) | null)?.guildOverview);
  const guildFocus = asRecord(guildOverview.currentFocus);
  const guildNextSteps = Array.isArray(guildOverview.nextSteps) ? guildOverview.nextSteps : [];
  const assistanceOpportunities = Array.isArray((board as (GuildView & { assistanceOpportunities?: unknown }) | null)?.assistanceOpportunities)
    ? ((board as GuildView & { assistanceOpportunities?: Array<Record<string, unknown>> }).assistanceOpportunities ?? [])
    : [];
  const escortBoardEntries = useMemo(() => {
    if (!board?.logs?.length) return [] as Array<{
      key: string;
      source: string;
      lane: string;
      risk: string;
      fee: string;
      createdAt: number;
    }>;

    return board.logs
      .filter((entry) => {
        const action = String(entry.actionType ?? "").toLowerCase();
        return action.includes("escort") || action.includes("contract");
      })
      .slice(0, 4)
      .map((entry) => {
        const summary = entry.summary && typeof entry.summary === "object"
          ? (entry.summary as Record<string, unknown>)
          : {};
        const source = typeof summary.companyName === "string"
          ? summary.companyName
          : typeof summary.targetName === "string"
            ? summary.targetName
            : typeof summary.target === "string"
              ? summary.target
              : "Consortium Offer";
        const lane = typeof summary.lane === "string"
          ? summary.lane
          : typeof summary.routeType === "string"
            ? summary.routeType
            : "Operational lane";
        const risk = typeof summary.riskLevel === "string" ? summary.riskLevel : "Variable";
        const fee = typeof summary.escortFeeGold === "number"
          ? `${summary.escortFeeGold.toLocaleString("en-GB")} gp`
          : "Fee pending";

        return {
          key: `${entry.actionType}-${entry.createdAt}`,
          source,
          lane,
          risk,
          fee,
          createdAt: entry.createdAt,
        };
      });
  }, [board?.logs]);

  const myMembership = board?.memberDetails?.find((entry: any) => entry.userInternalId === player.internalId) ?? null;
  const myQuestSlot = board?.guildQuestBoard?.currentPlan?.slots.find((slot: any) => slot.assignedMember?.userInternalId === player.internalId) ?? null;

  return (
    <AppShell title="Guilds" hint={pageCopy.flavor}>
      <ContentPanel title={board ? "Guild Overview" : "Found a Guild"}>
        <p className="page-intro__lead">{pageCopy.flavor}</p>
        <p className="page-intro__body">{pageCopy.ciel}</p>
      </ContentPanel>

      {message ? (
        <section className="panel guild-message-panel">
          <div className="panel__body">
            <strong>{message}</strong>
          </div>
        </section>
      ) : null}

      {loadingBoard ? (
        <div className="guild-layout">
          <div className="guild-column guild-column--wide">
            <ContentPanel title="Guild Interior">
              <div className="guild-stack">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Membership sync</div>
                  <div className="guild-card__title">Loading guild records</div>
                  <div className="guild-card__body">Hydrating the guild ledger from the live shard.</div>
                </section>
              </div>
            </ContentPanel>
          </div>
        </div>
      ) : !board && isDetailRoute ? (
        <div className="guild-layout">
          <div className="guild-column guild-column--wide">
            <ContentPanel title="Guild Detail">
              <div className="guild-stack">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Charter unavailable</div>
                  <div className="guild-card__title">Guild record could not be rendered</div>
                  <div className="guild-card__body">
                    {message ?? `No live guild board matched ${routeOrganizationPublicId}.`}
                  </div>
                </section>
              </div>
            </ContentPanel>
          </div>
        </div>
      ) : !board && authSource === "server" && !isDetailRoute && boardLoadError ? (
        <div className="guild-layout">
          <div className="guild-column guild-column--wide">
            <ContentPanel title="Guild Interior">
              <div className="guild-stack">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Board unavailable</div>
                  <div className="guild-card__title">Guild board could not be loaded</div>
                  <div className="guild-card__body">
                    {boardLoadError}
                  </div>
                </section>
                <button type="button" className="org-button" onClick={() => void reloadGuild()}>
                  Retry guild board
                </button>
              </div>
            </ContentPanel>
          </div>
        </div>
      ) : board && !isGuildMember ? (
        <div className="org-surface">
          <section className="org-hero org-hero--public">
            <div>
              <p className="org-eyebrow">Guild Public Profile</p>
              <h2 className="org-hero__title">
                <GuildBannerIcon size={22} /> {board.name} <span>[{formatEntityPublicId("guild", board.publicId)}]</span>
              </h2>
              <p className="org-hero__copy">
                {board.publicProfile?.headline ?? board.description}
              </p>
            </div>
            <div className="org-hero__actions">
              {board.viewerHasPendingInvite ? (
                <>
                  <button type="button" className="org-button" onClick={() => runGuildAction(() => respondToGuildInvite(serverSessionToken!, board.internalId, "accept"), { message: () => `Joined ${board.name}.` })}>
                    Accept Invite
                  </button>
                  <button type="button" className="org-button org-button--ghost" onClick={() => runGuildAction(() => respondToGuildInvite(serverSessionToken!, board.internalId, "decline"), { message: () => "Invite declined." })}>
                    Decline Invite
                  </button>
                </>
              ) : board.viewerHasPendingApplication ? (
                <button type="button" className="org-button" disabled>
                  Application Pending
                </button>
              ) : (
                <button type="button" className="org-button" onClick={() => runGuildAction(() => applyToGuild(serverSessionToken!, board.internalId, applicationNote), { message: () => "Application submitted." })}>
                  Apply to Join
                </button>
              )}
              <button type="button" className="org-button org-button--ghost" disabled>
                Request Escort
              </button>
            </div>
          </section>

          {!board.viewerHasPendingInvite && !board.viewerHasPendingApplication ? (
            <section className="panel org-panel">
              <div className="org-panel__head">
                <div>
                  <p className="org-eyebrow">Application</p>
                  <h3>A short note to leadership</h3>
                </div>
              </div>
              <div className="org-form">
                <input className="org-input" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Why this guild? (optional)" />
              </div>
            </section>
          ) : null}

          <section className="org-grid-two">
            <section className="panel org-panel">
              <div className="org-panel__head">
                <div>
                  <p className="org-eyebrow">Charter</p>
                  <h3>Doctrine and standing</h3>
                </div>
              </div>
              <div className="org-detail-list">
                <StatusRow label="Recruitment" value={board.publicProfile?.recruitmentStatus ?? "Unlisted"} />
                <StatusRow label="Doctrine" value={board.publicProfile?.doctrine ?? "Unrecorded"} />
                <StatusRow label="Territory" value={board.publicProfile?.territory ?? "Unknown"} />
                <StatusRow label="Diplomacy" value={board.publicProfile?.diplomacy ?? "Unrecorded"} />
                <StatusRow label="Public Notice" value={board.publicProfile?.publicNotice ?? "No public notice recorded."} />
              </div>
            </section>

            <section className="panel org-panel">
              <div className="org-panel__head">
                <div>
                  <p className="org-eyebrow">Open Offers</p>
                  <h3>Player-facing actions</h3>
                </div>
              </div>
              <div className="org-stack-list">
                <article>
                  <strong>Recruitment review</strong>
                  <p>Applications and direct invites are reviewed by guild leadership.</p>
                </article>
                <article>
                  <strong>Escort availability</strong>
                  <p>Consortium escort support is handled on active contract cycles.</p>
                </article>
                <article>
                  <strong>Diplomatic channel</strong>
                  <p>Public diplomacy stays open while interior command controls remain restricted.</p>
                </article>
              </div>
            </section>
          </section>
        </div>
      ) : !board ? (
        <>
        <div className="guild-layout">
          <div className="guild-column guild-column--wide">
            <ContentPanel title="Found a Guild">
              <div className="guild-stack">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Guild formation</div>
                  <div className="guild-card__title">Raise a banner that actually means something</div>
                  <div className="guild-card__body">
                    A public-facing charter with an internal command structure, dungeon board, doctrine, and an armory.
                  </div>
                </section>

                <section className="guild-card">
                  <div className="guild-card__section-title">Founding Requirements</div>
                  <StatusRow label="Guild Charter" value={hasGuildCharter ? "Filed" : "Missing"} />
                  <StatusRow label="Founding Cost" value={`${foundingCost.toLocaleString("en-GB")} gold`} />
                  <StatusRow label="Banner Mark" value="Guild tag required" />
                </section>

                <section className="guild-card">
                  <div className="guild-card__section-title">Formation Ledger</div>
                  <div className="org-form">
                    <input className="org-input" value={guildName} onChange={(event) => setGuildName(event.target.value)} placeholder="Guild name" />
                    <input className="org-input" value={guildTag} onChange={(event) => setGuildTag(event.target.value)} placeholder="Guild tag" />
                    <button type="button" className="org-button" disabled={guildBlockReason !== null} onClick={createGuild}>
                      Create Guild
                    </button>
                  </div>
                  <div className={`guild-inline-note${guildBlockReason ? " guild-inline-note--warning" : ""}`}>
                    {guildBlockReason ?? "Founding this guild creates the real live guild command board immediately."}
                  </div>
                </section>
              </div>
            </ContentPanel>
          </div>

          <div className="guild-column">
            <ContentPanel title="What changes after founding">
              <div className="guild-stack">
                <section className="guild-card">
                  <div className="guild-card__section-title">Public dossier</div>
                  <div className="guild-card__body guild-card__body--small">
                    The guild master controls what outsiders read: doctrine, territory, recruitment status, and a public notice.
                  </div>
                </section>
                <section className="guild-card">
                  <div className="guild-card__section-title">Two views, one guild</div>
                  <div className="guild-card__body guild-card__body--small">
                    Every member gets a compact Hall/Roster/Operations view. The guildmaster and officers also get a Command Panel for doctrine, quests, armory, and settings.
                  </div>
                </section>
              </div>
            </ContentPanel>
          </div>
        </div>

        <ContentPanel title="Guild Directory">
          <div className="guild-stack">
            {directory.length ? directory.map((entry) => (
              <section key={String(entry.internalId)} className="guild-card">
                <div className="guild-card__title">
                  {String(entry.name)} {entry.tag ? <span>[{String(entry.tag)}]</span> : null}
                </div>
                <div className="guild-card__body guild-card__body--small">
                  {String(entry.headline ?? entry.description ?? "")} | {Number(entry.memberCount ?? 0)} members | {String(entry.recruitmentStatus ?? "")}
                </div>
                <div className="guild-quest-actions">
                  {entry.viewerHasPendingInvite ? <span className="guild-inline-note">Invited</span> : entry.viewerHasPendingApplication ? <span className="guild-inline-note">Applied</span> : null}
                  <Link className="org-button org-button--ghost" to={`/guilds/${formatEntityPublicId("guild", Number(entry.publicId))}`}>
                    View
                  </Link>
                </div>
              </section>
            )) : (
              <div className="guild-inline-note">No guilds have been founded yet -- be the first.</div>
            )}
          </div>
        </ContentPanel>
        </>
      ) : (
        <div className="guild-stack">
          <ContentPanel title="Guild Interior">
            <div className="guild-card guild-card--hero">
              <div className="guild-card__eyebrow">Internal command</div>
              <div className="guild-card__title">
                <GuildBannerIcon size={22} /> {board.name} <span>[{formatEntityPublicId("guild", board.publicId)}]</span>
              </div>
              <div className="guild-card__subline">
                Tag {board.tag} | Founded {formatDate(board.createdAt)} | {board.statusText}
              </div>
              <div className="guild-card__body">{board.publicProfile?.headline ?? board.description}</div>
            </div>

            {isLeaderTier ? (
              <div className="org-mode-toggle">
                <button type="button" className={`org-mode-toggle__button${viewMode === "member" ? " org-mode-toggle__button--active" : ""}`} onClick={switchToMemberView}>
                  Member View
                </button>
                <button type="button" className={`org-mode-toggle__button${viewMode === "command" ? " org-mode-toggle__button--active" : ""}`} onClick={switchToCommandView}>
                  Command Panel
                </button>
              </div>
            ) : null}

            <div className="guild-tabs">
              {(viewMode === "member" ? MEMBER_TABS : COMMAND_TABS).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`guild-tab${activeTab === tab.key ? " guild-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </ContentPanel>

          {viewMode === "member" && activeTab === "hall" ? (
            <div className="org-surface">
              <section className="org-hero org-hero--guild">
                <div>
                  <p className="org-eyebrow">Guild Hall</p>
                  <h2 className="org-hero__title">
                    {board.name} <span>[{formatEntityPublicId("guild", board.publicId)}]</span>
                  </h2>
                  <p className="org-hero__copy">{board.publicProfile?.headline ?? board.description}</p>
                  <div className="org-tag-row">
                    <span>{board.tag ?? "No tag"}</span>
                    <span>{board.publicProfile?.recruitmentStatus ?? "Recruitment unlisted"}</span>
                    <span>{board.publicProfile?.territory ?? "Territory unknown"}</span>
                    <span>{board.statusText}</span>
                  </div>
                </div>

                <div className="org-hero__actions">
                  <button type="button" className="org-button" onClick={() => setActiveTab("roster")}>
                    View Roster
                  </button>
                  <button type="button" className="org-button" onClick={() => setActiveTab("operations")}>
                    My Operations
                  </button>
                  <button type="button" className="org-button org-button--ghost" disabled title="Leaving a guild isn't wired up yet -- ask an officer to remove you.">
                    Leave Guild
                  </button>
                </div>
              </section>

              <section className="org-stat-strip">
                <article className="org-stat-card">
                  <span>Reputation</span>
                  <strong>{board.guildPassives?.reputation ?? 0}</strong>
                  <p>Public standing</p>
                </article>
                <article className="org-stat-card">
                  <span>Members</span>
                  <strong>{board.memberDetails?.length ?? board.members.length}</strong>
                  <p>{board.settingsView?.invitePolicy ?? "Officer approval"}</p>
                </article>
                <article className="org-stat-card">
                  <span>Treasury</span>
                  <strong>{(board.treasury?.gold ?? 0).toLocaleString("en-GB")}</strong>
                  <p>Gold on hand</p>
                </article>
                <article className="org-stat-card">
                  <span>War Readiness</span>
                  <strong>{board.warRoom?.readiness ?? 0}</strong>
                  <p>{guildFocus.rivalry ? String(guildFocus.rivalry) : "No declared rivalry"}</p>
                </article>
              </section>

              <section className="panel org-panel">
                <div className="org-panel__head"><div><p className="org-eyebrow">Message of the Day</p><h3>From the guildmaster</h3></div></div>
                <p className="org-hero__copy" style={{ margin: 0 }}>{board.publicProfile?.publicNotice ?? "No announcement posted yet."}</p>
              </section>

              <section className="panel org-panel">
                <div className="org-panel__head"><div><p className="org-eyebrow">Your Membership</p><h3>{myMembership?.roleDisplayName ?? "Member"}</h3></div></div>
                <div className="org-detail-list">
                  <StatusRow label="Level" value={myMembership?.level ?? player.level ?? "-"} />
                  <StatusRow label="Status" value={myMembership?.status ?? "Available"} />
                  <StatusRow label="Active Operation" value={String(guildFocus.activeOperation ?? "No operation planned")} />
                </div>
                <div className="guild-inline-note">
                  {guildNextSteps.length ? `Next up for the guild: ${guildNextSteps.slice(0, 2).map(String).join(", ")}.` : "Plan an operation, stock the armory, or answer a city event."}
                </div>
              </section>
            </div>
          ) : null}

          {viewMode === "member" && activeTab === "roster" ? (
            <ContentPanel title="Guild Roster">
              <div className="org-table-wrap">
                <table className="org-compact-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Level</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(board.memberDetails ?? []).map((member: any) => (
                      <tr key={`roster-${member.userInternalId}`}>
                        <td>{member.displayName}</td>
                        <td>{member.level}</td>
                        <td>{member.roleDisplayName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentPanel>
          ) : null}

          {viewMode === "member" && activeTab === "operations" ? (
            <div className="guild-stack">
              <ContentPanel title="Your Active Operation">
                {board.guildQuestBoard?.currentPlan ? (
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__title">{board.guildQuestBoard.currentPlan.displayName}</div>
                      <div className="guild-card__subline">Ready in {formatCountdown(board.guildQuestBoard.currentPlan.readyAt)}</div>
                      <div className="guild-card__body guild-card__body--small">{board.guildQuestBoard.currentPlan.summary}</div>
                      <div className="guild-inline-note">
                        {myQuestSlot ? `Your slot: ${myQuestSlot.label} (${myQuestSlot.focus}).` : "You are not assigned to a slot on this operation yet -- ask an officer."}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="guild-inline-note">No operation is currently planned. Guild leadership plans quests and dungeons from the Command Panel.</div>
                )}
              </ContentPanel>

              <ContentPanel title="Guild Armory">
                <div className="guild-stack">
                  <div className="guild-inline-note">
                    {armoryItems.length ? `${armoryItems.reduce((sum: number, entry: any) => sum + entry.quantity, 0)} items stored across ${armoryItems.length} stacks.` : "Armory is empty."}
                  </div>
                  <div className="org-form">
                    <select className="org-input" value={armoryItemId} onChange={(event) => setArmoryItemId(event.target.value)}>
                      <option value="">Select inventory item</option>
                      {inventoryOptions.map((entry) => (
                        <option key={entry.itemId} value={entry.itemId}>{entry.itemId} x{entry.quantity}</option>
                      ))}
                    </select>
                    <input className="org-input" value={armoryQty} onChange={(event) => setArmoryQty(event.target.value)} placeholder="Quantity" />
                    <button type="button" className="org-button" disabled={!armoryItemId} onClick={() => runGuildAction(() => depositGuildArmory(serverSessionToken!, board.internalId, armoryItemId, Number(armoryQty || 1)), { refreshPlayerState: true, message: () => "Item deposited into the guild armory." })}>
                      Deposit
                    </button>
                  </div>
                </div>
              </ContentPanel>

              <OrganizationOneShotsPanel organizationId={board.internalId} organizationName={board.name} organizationType="guild" />
            </div>
          ) : null}

          {viewMode === "command" && activeTab === "doctrine" ? (
            <div className="guild-layout">
              <div className="guild-column guild-column--wide">
                <ContentPanel title="Charter Doctrine">
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__section-title">Accumulation</div>
                      <StatusRow label="Reputation" value={board.guildPassives?.reputation ?? 0} />
                      <StatusRow label="Daily Renown" value={board.guildPassives?.dailyRenown ?? 0} />
                      <StatusRow label="Skill Points Available" value={board.guildPassives?.availablePoints ?? 0} />
                      <StatusRow label="Active Specializations" value={`${activeSpecializations.length} / ${specializationCap}`} />
                      <StatusRow label="Respec Cost" value={`${(board.guildPassives?.respecGoldCost ?? 5000).toLocaleString("en-GB")} gold (guild treasury)`} />
                    </section>

                    <section className="guild-card">
                      <div className="guild-card__section-title"><SkillNodeIcon size={16} /> Core Doctrine (every guild gets this, free)</div>
                      <div className="guild-skill-board">
                        {coreSkills.map((skill: any) => (
                          <div key={skill.key} className="guild-skill-node guild-skill-node--unlocked">
                            <div className="guild-skill-node__branch">Core</div>
                            <div className="guild-skill-node__topline">
                              <strong>{skill.displayName}</strong>
                              <span>Free</span>
                            </div>
                            <div className="guild-card__body guild-card__body--small">{skill.memberBenefit}</div>
                            <div className="guild-skill-node__footer">
                              <span className="guild-skill-node__status guild-skill-node__status--unlocked">Always Active</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="guild-card">
                      <div className="guild-card__section-title">Specializations ({activeSpecializations.length}/{specializationCap} active)</div>
                      <div className="guild-inline-note">
                        Only {specializationCap} of these {specializations.length} named specializations can be active at once. Swapping in a new one at the cap costs {(board.guildPassives?.respecGoldCost ?? 5000).toLocaleString("en-GB")} gold from the treasury.
                      </div>
                      <div className="guild-skill-board">
                        {specializations.map((skill: any) => {
                          const swapTarget = swapTargetByKey[skill.key] ?? activeSpecializations[0]?.key ?? "";
                          return (
                            <div key={skill.key} className={`guild-skill-node${skill.isActive ? " guild-skill-node--unlocked" : ""}`}>
                              <div className="guild-skill-node__branch">{skill.branchLabel}</div>
                              <div className="guild-skill-node__topline">
                                <strong>{skill.displayName}</strong>
                                <span>{skill.pointCost} pt{skill.effectType === "active" ? " | Active" : ""}</span>
                              </div>
                              <div className="guild-card__body guild-card__body--small">{skill.memberBenefit}</div>
                              <div className="guild-skill-node__footer">
                                <span className={`guild-skill-node__status${skill.isActive ? " guild-skill-node__status--unlocked" : ""}`}>
                                  {skill.isActive ? "Active" : skill.everUnlocked ? "Learned (benched)" : "Locked"}
                                </span>
                                {skill.isActive ? (
                                  <span className="org-chip">In use</span>
                                ) : skill.canActivate ? (
                                  <button type="button" className="org-button" disabled={!canManageDoctrine} onClick={() => runGuildAction(() => unlockGuildSkill(serverSessionToken!, board.internalId, skill.key), { message: () => `${skill.displayName} is now active for the guild.` })}>
                                    Activate
                                  </button>
                                ) : (
                                  <div className="guild-swap-controls">
                                    <select className="org-input" value={swapTarget} onChange={(event) => setSwapTargetByKey((prev) => ({ ...prev, [skill.key]: event.target.value }))}>
                                      {activeSpecializations.map((entry: any) => (
                                        <option key={entry.key} value={entry.key}>Bench {entry.displayName}</option>
                                      ))}
                                    </select>
                                    <button type="button" className="org-button" disabled={!canManageDoctrine || !swapTarget} onClick={() => runGuildAction(() => swapGuildSkill(serverSessionToken!, board.internalId, skill.key, swapTarget), { message: () => `Swapped in ${skill.displayName} for ${(board.guildPassives?.respecGoldCost ?? 5000).toLocaleString("en-GB")} gold.` })}>
                                      Swap ({(board.guildPassives?.respecGoldCost ?? 5000).toLocaleString("en-GB")}g)
                                    </button>
                                  </div>
                                )}
                              </div>
                              {skill.key === "strike_cadence" && skill.isActive ? (
                                <div className="guild-inline-note">
                                  {skillTreeState?.rally.ready
                                    ? "A Strike Cadence is primed for the next guild quest or dungeon delve."
                                    : skillTreeState?.rally.canTrigger
                                      ? `Ready to trigger for ${skillTreeState.rally.goldCost.toLocaleString("en-GB")} gold (+${skillTreeState.rally.bonusPct}% success next operation).`
                                      : `On cooldown: ${formatMsCountdown(skillTreeState?.rally.cooldownRemainingMs ?? 0)} remaining.`}
                                  <div style={{ marginTop: 8 }}>
                                    <button type="button" className="org-button" disabled={!canManageDoctrine || !skillTreeState?.rally.canTrigger} onClick={() => runGuildAction(() => triggerGuildRally(serverSessionToken!, board.internalId), { message: () => "Strike Cadence called for the next operation." })}>
                                      Trigger Strike Cadence
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </ContentPanel>
              </div>
              <div className="guild-column">
                <ContentPanel title="Current Bonuses">
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__section-title">Passive Summary</div>
                      <div className="guild-card__body guild-card__body--small">
                        {board.passiveBonusSummary || "No specializations active yet."}
                      </div>
                    </section>
                    <section className="panel org-panel">
                      <div className="org-panel__head"><div><p className="org-eyebrow">Academy Contract</p><h3>Adventuring &amp; Survival linkage</h3></div></div>
                      <div className="org-detail-list">
                        <StatusRow label="Track completion" value={`${guildAcademyCompletionPct}% (${guildAcademyCompletedCourses.toFixed(1)}/${guildAcademyRequiredCourses})`} />
                        <StatusRow label="Readiness / Survival / Battle" value={`+${guildAcademyReadinessPct}% / +${guildAcademySurvivalPct}% / +${guildAcademyBattleEdgePct}%`} />
                      </div>
                    </section>
                    <section className="panel org-panel">
                      <div className="org-panel__head"><div><p className="org-eyebrow">Guild to Consortium Assistance</p><h3>Danger work board</h3></div></div>
                      <div className="org-stack-list">
                        {assistanceOpportunities.length ? assistanceOpportunities.slice(0, 3).map((entry) => <article key={String(entry.key)}><strong>{String(entry.label)}</strong><p>{String(entry.summary)}</p></article>) : <article><strong>No assistance offers</strong><p>These appear as consortium routes and city events generate dangerous work.</p></article>}
                      </div>
                    </section>
                    <section className="panel org-panel">
                      <div className="org-panel__head"><div><p className="org-eyebrow">Escort Board</p><h3>Pending consortium offers</h3></div></div>
                      {escortBoardEntries.length ? (
                        <div className="org-contract-list">
                          {escortBoardEntries.map((entry) => (
                            <article key={entry.key} className="org-contract-card">
                              <div>
                                <p className="org-contract-card__title">{entry.source}</p>
                                <p className="org-contract-card__meta">{entry.lane} | Risk {entry.risk} | {formatDate(entry.createdAt)}</p>
                              </div>
                              <div className="org-contract-card__side">
                                <strong>{entry.fee}</strong>
                                <span>Escort fee</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="guild-inline-note">No escort offers pending.</div>
                      )}
                    </section>
                  </div>
                </ContentPanel>
              </div>
            </div>
          ) : null}

          {viewMode === "command" && activeTab === "quests" ? (
            <div className="guild-layout">
              <div className="guild-column guild-column--wide">
                <ContentPanel title="Guild Quests">
                  <div className="guild-stack">
                    {board.guildQuestBoard?.currentPlan ? (
                      <section className="guild-card guild-card--hero">
                        <div className="guild-card__eyebrow">Planning phase</div>
                        <div className="guild-card__title">{board.guildQuestBoard.currentPlan.displayName}</div>
                        <div className="guild-card__subline">
                          Ready in {formatCountdown(board.guildQuestBoard.currentPlan.readyAt)} | Planned by {board.guildQuestBoard.currentPlan.plannedBy.displayName}
                        </div>
                        <div className="guild-card__body">{board.guildQuestBoard.currentPlan.summary}</div>
                        <div className="guild-quest-actions">
                          <button type="button" className="org-button" disabled={!canManageDoctrine || !board.guildQuestBoard.currentPlan.canInitiate} onClick={() => runGuildAction(() => initiateGuildQuest(serverSessionToken!, board.internalId), { message: () => `${board.guildQuestBoard?.currentPlan?.displayName ?? "Guild quest"} initiated.` })}>
                            Initiate Quest
                          </button>
                          <button type="button" className="org-button" disabled={!canManageDoctrine} onClick={() => runGuildAction(() => cancelGuildQuest(serverSessionToken!, board.internalId), { message: () => "Quest plan cancelled." })}>
                            Cancel Plan
                          </button>
                        </div>
                        <div className={`guild-inline-note${board.guildQuestBoard.currentPlan.blockedReason ? " guild-inline-note--warning" : ""}`}>
                          {board.guildQuestBoard.currentPlan.blockedReason ?? "All members are assigned and the quest is ready to initiate once planning finishes."}
                        </div>
                      </section>
                    ) : (
                      <section className="guild-card">
                        <div className="guild-card__section-title">Quest planning board</div>
                        <div className="guild-card__body guild-card__body--small">
                          Plan a quest, staff every slot, wait out the preparation timer, then initiate when everyone's okay.
                        </div>
                        {(board.guildQuestBoard?.history ?? []).length ? (
                          <button type="button" className="org-button" disabled={!canManageDoctrine} onClick={() => runGuildAction(() => replanGuildQuest(serverSessionToken!, board.internalId), { message: () => "Previous crew submitted for planning again." })}>
                            Plan Last Crew Again
                          </button>
                        ) : (
                          <div className="guild-inline-note">No previous quest crew exists yet.</div>
                        )}
                      </section>
                    )}

                    {board.guildQuestBoard?.currentPlan ? (
                      <section className="guild-card">
                        <div className="guild-card__section-title">Assigned roles</div>
                        <div className="guild-quest-slot-list">
                          {board.guildQuestBoard.currentPlan.slots.map((slot: any) => {
                            const currentAssignedId = questAssignments[slot.slotKey] ?? "";
                            const currentAssigned = slot.assignedMember ? [{ publicId: slot.assignedMember.publicId, displayName: slot.assignedMember.displayName, level: slot.assignedMember.level, status: slot.assignedMember.status, location: slot.assignedMember.location, isQuestReady: slot.assignedMember.isOkay, questBlockReason: slot.assignedMember.unavailableReason }] : [];
                            const pool = [...currentAssigned, ...((board.questMemberPool ?? []).filter((member: any) => member.publicId !== slot.assignedMember?.publicId))];
                            return (
                              <div key={slot.slotKey} className="guild-quest-slot">
                                <div className="guild-quest-slot__meta">
                                  <strong>{slot.label}</strong>
                                  <span>{slot.focus}</span>
                                </div>
                                <div className="guild-quest-slot__body">
                                  <select className="org-input" value={currentAssignedId} onChange={(event) => setQuestAssignments((current) => ({ ...current, [slot.slotKey]: event.target.value }))}>
                                    <option value="">Assign guild member</option>
                                    {pool.map((member: any) => (
                                      <option key={`${slot.slotKey}-${member.publicId}`} value={member.publicId}>
                                        {member.displayName} | Lv {member.level} | {member.status}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="button" className="org-button" disabled={!canManageDoctrine || !questAssignments[slot.slotKey]} onClick={() => runGuildAction(() => assignGuildQuestMember(serverSessionToken!, board.internalId, slot.slotKey, questAssignments[slot.slotKey]), { message: () => `${slot.label} assigned.` })}>
                                    Assign
                                  </button>
                                </div>
                                <div className={`guild-inline-note${slot.assignedMember && !slot.assignedMember.isOkay ? " guild-inline-note--warning" : ""}`}>
                                  {slot.assignedMember ? `${slot.assignedMember.displayName} | ${slot.assignedMember.location}${slot.assignedMember.unavailableReason ? ` | ${slot.assignedMember.unavailableReason}` : ""}` : "No one assigned yet."}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    <section className="guild-card">
                      <div className="guild-card__section-title"><QuestIcon size={16} /> Available guild quests</div>
                      <div className="guild-grid">
                        {(board.guildQuestBoard?.templates ?? []).map((quest: any) => (
                          <section key={quest.key} className="guild-card guild-card--nested">
                            <div className="guild-card__title">{quest.displayName}</div>
                            <div className="guild-card__body guild-card__body--small">{quest.summary}</div>
                            <StatusRow label="Planning Time" value={formatHoursLabel(quest.planningHours)} />
                            <StatusRow label="Members Required" value={quest.requiredMembers} />
                            <StatusRow label="Guild Rewards" value={`${quest.reputationReward} rep, ${quest.treasuryGoldReward.toLocaleString("en-GB")} gold`} />
                            <StatusRow label="Member Cut" value={`${quest.memberGoldReward.toLocaleString("en-GB")} gold each`} />
                            <button
                              type="button"
                              className="org-button"
                              disabled={!canManageDoctrine || !quest.canPlan}
                              title={!canManageDoctrine ? "Only guild leadership can plan quests." : quest.blockedReason ?? "Plan this quest."}
                              onClick={() => runGuildAction(() => planGuildQuest(serverSessionToken!, board.internalId, quest.key), { message: () => `${quest.displayName} entered planning.` })}
                            >
                              Plan Quest
                            </button>
                            <div className={`guild-inline-note${!canManageDoctrine || quest.blockedReason ? " guild-inline-note--warning" : ""}`}>
                              {!canManageDoctrine ? "Only guild leadership can plan quests." : quest.blockedReason ?? "Ready to enter planning."}
                            </div>
                          </section>
                        ))}
                      </div>
                    </section>

                    <section className="guild-card">
                      <div className="guild-card__section-title"><DungeonIcon size={16} /> Dungeon Board</div>
                      <div className="guild-card__body guild-card__body--small">
                        Dungeons resolve immediately against the guild's roster power instead of a planning timer -- pick a delve within the guild's reach.
                      </div>
                      <div className="guild-grid">
                        {dungeonTemplates.map((dungeon: any) => (
                          <section key={dungeon.key} className="guild-card guild-card--nested">
                            <div className="guild-card__title">{dungeon.displayName}</div>
                            <div className="guild-card__body guild-card__body--small">{dungeon.summary}</div>
                            <StatusRow label="Min Members" value={dungeon.minMembers} />
                            <StatusRow label="Recommended Power" value={dungeon.recommendedPower} />
                            <StatusRow label="Rewards" value={`${dungeon.reputationReward} rep, ${dungeon.goldReward.toLocaleString("en-GB")} gold`} />
                            <StatusRow label="Cooldown" value={formatHoursLabel(dungeon.cooldownHours)} />
                            <button
                              type="button"
                              className="org-button"
                              disabled={!canManageDoctrine || !dungeon.canLaunch}
                              title={!canManageDoctrine ? "Only guild leadership can launch dungeons." : dungeon.blockedReason ?? "Launch this dungeon."}
                              onClick={() => runGuildAction(() => launchGuildDungeon(serverSessionToken!, board.internalId, dungeon.key), { message: () => `${dungeon.displayName} launched.` })}
                            >
                              Launch Dungeon
                            </button>
                            <div className={`guild-inline-note${!canManageDoctrine || dungeon.blockedReason ? " guild-inline-note--warning" : ""}`}>
                              {!canManageDoctrine ? "Only guild leadership can launch dungeons." : dungeon.blockedReason ?? "Ready to launch."}
                            </div>
                          </section>
                        ))}
                      </div>
                    </section>
                  </div>
                </ContentPanel>
              </div>
              <div className="guild-column">
                <ContentPanel title="Quest History">
                  <div className="guild-stack">
                    {(board.guildQuestBoard?.history ?? []).length ? (board.guildQuestBoard?.history ?? []).map((entry: any) => (
                      <section key={`${entry.questKey}-${entry.createdAt}`} className="guild-card">
                        <div className="guild-card__section-title">{entry.outcome === "success" ? "Successful run" : "Failed run"}</div>
                        <div className="guild-card__title">{entry.displayName}</div>
                        <div className="guild-card__body guild-card__body--small">{entry.summary}</div>
                        <StatusRow label="Guild Reputation" value={entry.reputationGain} />
                        <StatusRow label="Treasury Gold" value={entry.treasuryGoldGain.toLocaleString("en-GB")} />
                        <StatusRow label="Completed" value={formatDate(entry.createdAt)} />
                      </section>
                    )) : (
                      <section className="guild-card">
                        <div className="guild-card__section-title">No operations logged</div>
                        <div className="guild-card__body guild-card__body--small">
                          Plan a guild quest or launch a dungeon to start the log.
                        </div>
                      </section>
                    )}
                  </div>
                </ContentPanel>
              </div>
            </div>
          ) : null}

          {viewMode === "command" && activeTab === "base" ? (
            <ContentPanel title="Guild Base">
              <OrganizationBaseTab
                serverSessionToken={serverSessionToken}
                organizationInternalId={board.internalId}
                organizationType="guild"
                onMessage={setMessage}
                onRefreshOrganization={() => void reloadGuild()}
              />
            </ContentPanel>
          ) : null}

          {viewMode === "command" && activeTab === "armory" ? (
            <div className="guild-layout">
              <div className="guild-column guild-column--wide">
                <ContentPanel title="Guild Armory">
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__section-title"><ArmoryIcon size={16} /> Stored Equipment</div>
                      <div className="guild-history">
                        {armoryItems.length ? (armoryItems as any[]).map((entry) => (
                          <div key={entry.itemId} className="guild-history__row">
                            <span>{entry.label}</span>
                            <span>x{entry.quantity}</span>
                          </div>
                        )) : <div className="guild-card__body guild-card__body--small">Armory is empty.</div>}
                      </div>
                    </section>
                  </div>
                </ContentPanel>
              </div>
              <div className="guild-column">
                <ContentPanel title="Armory Controls">
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__section-title">Deposit Item</div>
                      <div className="org-form">
                        <select className="org-input" value={armoryItemId} onChange={(event) => setArmoryItemId(event.target.value)}>
                          <option value="">Select inventory item</option>
                          {inventoryOptions.map((entry) => (
                            <option key={entry.itemId} value={entry.itemId}>{entry.itemId} x{entry.quantity}</option>
                          ))}
                        </select>
                        <input className="org-input" value={armoryQty} onChange={(event) => setArmoryQty(event.target.value)} placeholder="Quantity" />
                        <button type="button" className="org-button" disabled={!armoryItemId} onClick={() => runGuildAction(() => depositGuildArmory(serverSessionToken!, board.internalId, armoryItemId, Number(armoryQty || 1)), { refreshPlayerState: true, message: () => "Item deposited into the guild armory." })}>
                          Deposit
                        </button>
                      </div>
                    </section>
                    <section className="guild-card">
                      <div className="guild-card__section-title">Withdraw Item</div>
                      <div className="org-form">
                        <select className="org-input" value={withdrawItemId} onChange={(event) => setWithdrawItemId(event.target.value)}>
                          <option value="">Select armory item</option>
                          {(board.armory?.items ?? []).map((entry: any) => (
                            <option key={entry.itemId} value={entry.itemId}>{entry.label} x{entry.quantity}</option>
                          ))}
                        </select>
                        <input className="org-input" value={withdrawQty} onChange={(event) => setWithdrawQty(event.target.value)} placeholder="Quantity" />
                        <button type="button" className="org-button" disabled={!canManageTreasury || !withdrawItemId} onClick={() => runGuildAction(() => withdrawGuildArmory(serverSessionToken!, board.internalId, withdrawItemId, Number(withdrawQty || 1)), { refreshPlayerState: true, message: () => "Item withdrawn from the guild armory." })}>
                          Withdraw
                        </button>
                      </div>
                      <div className={`guild-inline-note${canManageTreasury ? "" : " guild-inline-note--warning"}`}>
                        {canManageTreasury ? "Treasury-ranked members can issue armory withdrawals." : "Only guildmaster and officers may withdraw from the armory."}
                      </div>
                    </section>
                  </div>
                </ContentPanel>
              </div>
            </div>
          ) : null}

          {viewMode === "command" && activeTab === "war" ? (
            <div className="guild-layout">
              <div className="guild-column guild-column--wide">
                <ContentPanel title="War Room">
                  <div className="guild-stack">
                    <section className="guild-card">
                      <div className="guild-card__section-title">Operational Readiness</div>
                      <StatusRow label="Doctrine" value={board.warRoom?.doctrine ?? "No doctrine set"} />
                      <StatusRow label="Readiness" value={board.warRoom?.readiness ?? 0} />
                      <StatusRow label="War Rating" value={board.warRoom?.warRating ?? 0} />
                    </section>
                    <section className="guild-card">
                      <div className="guild-card__section-title">Campaign History</div>
                      <div className="guild-history">
                        {recentWarHistory.length ? (recentWarHistory as any[]).map((entry) => (
                          <div key={`${entry.createdAt}-${entry.summary}`} className="guild-history__row">
                            <span>{entry.summary}</span>
                            <span>{formatDate(entry.createdAt)}</span>
                          </div>
                        )) : <div className="guild-card__body guild-card__body--small">No declared wars yet.</div>}
                      </div>
                    </section>
                  </div>
                </ContentPanel>
              </div>
              <div className="guild-column">
                <ContentPanel title="Current Conflicts">
                  <div className="guild-stack">
                    {activeWars.length ? (activeWars as any[]).map((entry) => (
                      <section key={`${entry.target}-${entry.startedAt}`} className="guild-card">
                        <StatusRow label="Target" value={entry.target} />
                        <StatusRow label="Status" value={entry.status} />
                        <StatusRow label="Started" value={formatDate(entry.startedAt)} />
                      </section>
                    )) : (
                      <section className="guild-card">
                        <div className="guild-card__section-title">No active wars</div>
                        <div className="guild-card__body guild-card__body--small">The war room is live and ready; no conflicts declared.</div>
                      </section>
                    )}
                  </div>
                </ContentPanel>
              </div>
            </div>
          ) : null}

          {viewMode === "command" && activeTab === "settings" ? (
            <ContentPanel title="Charter Settings">
              <div className="guild-layout">
                <div className="guild-column guild-column--wide">
                  <div className="guild-card">
                    <div className="guild-card__section-title">Public Charter</div>
                    <div className="org-form">
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Headline<input className="org-input" value={settingsDraft.headline} onChange={(event) => setSettingsDraft((current) => ({ ...current, headline: event.target.value }))} placeholder="Recruitment headline" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Recruitment status<input className="org-input" value={settingsDraft.recruitmentStatus} onChange={(event) => setSettingsDraft((current) => ({ ...current, recruitmentStatus: event.target.value }))} placeholder="Open, selective, closed" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Doctrine<input className="org-input" value={settingsDraft.doctrine} onChange={(event) => setSettingsDraft((current) => ({ ...current, doctrine: event.target.value }))} placeholder="Guild doctrine" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Territory<input className="org-input" value={settingsDraft.territory} onChange={(event) => setSettingsDraft((current) => ({ ...current, territory: event.target.value }))} placeholder="Operating territory" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Diplomacy<input className="org-input" value={settingsDraft.diplomacy} onChange={(event) => setSettingsDraft((current) => ({ ...current, diplomacy: event.target.value }))} placeholder="Diplomatic posture" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Message of the Day (member-visible)<textarea className="org-input guild-textarea" value={settingsDraft.publicNotice} onChange={(event) => setSettingsDraft((current) => ({ ...current, publicNotice: event.target.value }))} placeholder="Announcement shown to members and visitors" /></label>
                    </div>
                  </div>
                </div>
                <div className="guild-column">
                  <div className="guild-card">
                    <div className="guild-card__section-title">Send Invite</div>
                    <div className="org-form">
                      <input className="org-input" value={recruitPublicId} onChange={(event) => setRecruitPublicId(event.target.value)} placeholder="P1000000" />
                      <button type="button" className="org-button" disabled={!canManageMembers || recruitPublicId.trim().length < 7} onClick={() => runGuildAction(() => inviteGuildMember(serverSessionToken!, board.internalId, recruitPublicId.trim()), { message: () => "Invite sent." })}>
                        Send Invite
                      </button>
                    </div>
                    <div className={`guild-inline-note${canManageMembers ? "" : " guild-inline-note--warning"}`}>
                      {canManageMembers ? "The citizen must accept before joining -- this no longer adds them directly." : "Only guild leadership can send invites."}
                    </div>
                  </div>
                  <div className="guild-card">
                    <div className="guild-card__section-title">Applications</div>
                    <div className="guild-stack">
                      {(board.applications ?? []).length ? (board.applications ?? []).map((entry) => (
                        <section key={String(entry.applicantPublicId)} className="guild-card">
                          <div className="guild-card__title">{String(entry.applicantName ?? "Applicant")}</div>
                          <div className="guild-card__body guild-card__body--small">{String(entry.note ?? "No note attached.")}</div>
                          <div className="guild-quest-actions">
                            <button type="button" className="org-button" disabled={!canManageMembers} onClick={() => runGuildAction(() => reviewGuildApplication(serverSessionToken!, board.internalId, String(entry.applicantPublicId), "accept"), { message: () => `${String(entry.applicantName ?? "Applicant")} accepted.` })}>Accept</button>
                            <button type="button" className="org-button org-button--ghost" disabled={!canManageMembers} onClick={() => runGuildAction(() => reviewGuildApplication(serverSessionToken!, board.internalId, String(entry.applicantPublicId), "reject"), { message: () => `${String(entry.applicantName ?? "Applicant")} rejected.` })}>Reject</button>
                          </div>
                        </section>
                      )) : (<div className="guild-inline-note">No pending applications.</div>)}
                    </div>
                  </div>
                  <div className="guild-card">
                    <div className="guild-card__section-title">Sent Invites</div>
                    <div className="guild-stack">
                      {(board.invites ?? []).length ? (board.invites ?? []).map((entry) => (
                        <div key={String(entry.targetPublicId)} className="guild-inline-note">
                          {String(entry.targetName ?? "Citizen")} -- pending
                        </div>
                      )) : (<div className="guild-inline-note">No pending invites.</div>)}
                    </div>
                  </div>
                  <div className="guild-card">
                    <div className="guild-card__section-title">Command Settings</div>
                    <div className="org-form">
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>Recruitment policy<input className="org-input" value={settingsDraft.invitePolicy} onChange={(event) => setSettingsDraft((current) => ({ ...current, invitePolicy: event.target.value }))} placeholder="e.g. Officer approval required" /></label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>War doctrine<input className="org-input" value={settingsDraft.warDoctrine} onChange={(event) => setSettingsDraft((current) => ({ ...current, warDoctrine: event.target.value }))} placeholder="War doctrine" /></label>
                      <button type="button" className="org-button" disabled={!canManageDoctrine} onClick={() => runGuildAction(() => updateGuildSettings(serverSessionToken!, board.internalId, settingsDraft), { message: () => "Guild settings updated." })}>
                        Save Settings
                      </button>
                    </div>
                    <div className={`guild-inline-note${canManageDoctrine ? "" : " guild-inline-note--warning"}`}>
                      {canManageDoctrine ? "Guildmaster and officers only." : "Only the guildmaster and officers can rewrite the charter."}
                    </div>
                  </div>
                </div>
              </div>
            </ContentPanel>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
