import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { OrganizationBaseTab } from "../components/organizations/OrganizationBaseTab";
import { ConsortiumLogisticsBoard } from "../components/organizations/ConsortiumLogisticsBoard";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { allocatePublicNumericId, formatEntityPublicId } from "../lib/publicIds";
import { createOrganization, getMyOrganization, getOrganizationByPublicId } from "../lib/organizationApi";
import { cielPageCopy } from "../data/cielPageCopy";
import {
  CONSORTIUM_STORAGE_PREFIX,
  consortiumKey,
  formatDate,
  readConsortiumBoard,
  type ConsortiumBoard,
  type ConsortiumTypeDefinition,
  writeJson,
  type OrganizationMember,
  type OrganizationRole,
} from "../lib/organizations";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import "../styles/guild.css";

const LOCAL_CONSORTIUM_TYPES = [
  {
    id: "mercantile_house",
    name: "Mercantile House",
    summary: "Trade manifests, route profit, and respectable greed.",
    baseCost: 180_000,
    baseIncomePerShift: 240,
    startingVault: 2_500,
    roleSummary: "Roles: Director, Quartermaster, Trade Clerk",
  },
  {
    id: "security_contractor",
    name: "Security Contractor",
    summary: "Protection contracts, escorts, and expensive people with weapons.",
    baseCost: 220_000,
    baseIncomePerShift: 280,
    startingVault: 3_000,
    roleSummary: "Roles: Director, Operations Captain, Field Lead",
  },
  {
    id: "research_collective",
    name: "Research Collective",
    summary: "Study grants, commissioned analysis, and suspiciously polished reports.",
    baseCost: 260_000,
    baseIncomePerShift: 320,
    startingVault: 3_500,
    roleSummary: "Roles: Director, Archivist, Senior Researcher",
  },
] as const;

type ConsortiumChoice = {
  id: string;
  name: string;
  summary: string;
  baseCost: number;
  baseIncomePerShift: number;
  startingVault: number;
  roleSummary: string;
};

type ConsortiumMemberTab = "overview" | "logistics" | "base";

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function collectExistingOrganizationPublicIds(prefix: string) {
  if (typeof window === "undefined") return [] as number[];

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { publicId?: unknown };
        return typeof parsed.publicId === "number" ? parsed.publicId : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is number => value !== null);
}

function readBoardNumberMetadata(board: ConsortiumBoard, key: string, fallback = 0) {
  const value = board.metadata?.[key];
  return typeof value === "number" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toServerChoice(template: ConsortiumTypeDefinition): ConsortiumChoice {
  return {
    id: template.key,
    name: template.displayName,
    summary: template.description,
    baseCost: template.creationCost,
    baseIncomePerShift: 0,
    startingVault: 0,
    roleSummary: template.rolesFlavor.join(", "),
  };
}

function getApplicantCount(board: ConsortiumBoard) {
  const applications = (board as ConsortiumBoard & { applications?: unknown }).applications;
  return Array.isArray(applications) ? applications.length : readBoardNumberMetadata(board, "applicantCount");
}

function getAdvertisingLevel(board: ConsortiumBoard) {
  const management = asRecord(asRecord(board.metadata).management);
  const outreach = asRecord(management.outreach);
  return typeof outreach.level === "number" ? outreach.level : readBoardNumberMetadata(board, "advertisingLevel", 1);
}

function getDailyGeneration(board: ConsortiumBoard) {
  const directValue = (board as ConsortiumBoard & { companyDailyGeneration?: unknown }).companyDailyGeneration;
  return typeof directValue === "number" ? directValue : readBoardNumberMetadata(board, "baseIncomePerShift");
}

function getHazardPressure(board: ConsortiumBoard) {
  return Math.max(0, Math.min(100, 100 - Math.round(getDailyGeneration(board) / 5)));
}

function getHazardSeverity(pressure: number) {
  if (pressure >= 90) return "Critical";
  if (pressure >= 75) return "High";
  if (pressure >= 50) return "Elevated";
  if (pressure >= 25) return "Guarded";
  return "Stable";
}

function getHazardExplanation(pressure: number) {
  if (pressure >= 90) return "near max route volatility; expect poor outcomes without escort coverage";
  if (pressure >= 75) return "dangerous routes; escorts and logistics matter";
  if (pressure >= 50) return "meaningful volatility on exposed routes";
  if (pressure >= 25) return "manageable pressure with basic coverage";
  return "routes are currently controlled";
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getEmployeeRows(board: ConsortiumBoard) {
  const detailed = (board as ConsortiumBoard & { memberDetails?: unknown }).memberDetails;
  if (Array.isArray(detailed) && detailed.length > 0) {
    return detailed.map((entry) => {
      const employee = asRecord(entry);
      return {
        key: `${String(employee.userInternalId ?? "member")}-${String(employee.roleKey ?? "employee")}`,
        roleLabel: String(employee.positionDisplayName ?? employee.roleDisplayName ?? employee.roleKey ?? "Employee"),
        summary: `${String(employee.displayName ?? "Unknown")} | Daily CP ${String(employee.dailyCpGain ?? 0)}`,
      };
    });
  }

  return board.members.map((employee) => ({
    key: `${employee.userInternalId}-${employee.roleKey}`,
    roleLabel: employee.roleKey,
    summary: `${employee.displayName} | Efficiency 100%`,
  }));
}

export default function ConsortiumsPage() {
  const { publicId: publicIdParam } = useParams();
  const { player, spendGold } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [board, setBoard] = useState<ConsortiumBoard | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [serverTemplates, setServerTemplates] = useState<ConsortiumTypeDefinition[]>([]);
  const [consortiumName, setConsortiumName] = useState("");
  const [consortiumTag, setConsortiumTag] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("mercantile_house");
  const [memberTab, setMemberTab] = useState<ConsortiumMemberTab>("overview");
  const [message, setMessage] = useState<string | null>(null);
  const [boardLoadError, setBoardLoadError] = useState<string | null>(null);
  const routeOrganizationPublicId = typeof publicIdParam === "string" ? publicIdParam.trim() : "";
  const isDetailRoute = routeOrganizationPublicId.length > 0;

  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const hasConsortiumWrit = (player.inventory.consortium_writ ?? 0) > 0;
  const isServerMode = authSource === "server" && Boolean(serverSessionToken);

  const consortiumTypes = useMemo<ConsortiumChoice[]>(
    () => (isServerMode ? serverTemplates.map(toServerChoice) : [...LOCAL_CONSORTIUM_TYPES]),
    [isServerMode, serverTemplates],
  );
  const pageCopy = cielPageCopy.consortiums;
  const selectedType = consortiumTypes.find((type) => type.id === selectedTypeId) ?? consortiumTypes[0] ?? LOCAL_CONSORTIUM_TYPES[0];
  const foundingCost = hasConsortiumWrit ? Math.max(75_000, selectedType.baseCost - 75_000) : selectedType.baseCost;

  async function reloadConsortiumBoard() {
    if (isServerMode && serverSessionToken) {
      setLoadingBoard(true);
      const result = await (isDetailRoute
        ? getOrganizationByPublicId(serverSessionToken, "consortium", routeOrganizationPublicId)
        : getMyOrganization(serverSessionToken, "consortium"));
      if ("ok" in result && result.ok === false) {
        setBoardLoadError(result.error);
        setLoadingBoard(false);
        return;
      }
      const payload = result as {
        organization: ConsortiumBoard | null;
        consortiumTemplates?: ConsortiumTypeDefinition[];
      };
      setBoardLoadError(null);
      setBoard(payload.organization);
      setServerTemplates(payload.consortiumTemplates ?? []);
      setLoadingBoard(false);
      return;
    }

    setLoadingBoard(false);
    setBoard(readConsortiumBoard(player.internalId));
  }

  useEffect(() => {
    void reloadConsortiumBoard();
  }, [isDetailRoute, isServerMode, player.internalId, routeOrganizationPublicId, serverSessionToken]);

  useEffect(() => {
    if (!consortiumTypes.length) return;
    if (!consortiumTypes.some((type) => type.id === selectedTypeId)) {
      setSelectedTypeId(consortiumTypes[0].id);
    }
  }, [consortiumTypes, selectedTypeId]);

  const consortiumBlockReason = useMemo(() => {
    if (board) return "You already operate a consortium on this character.";
    if (consortiumName.trim().length < 3) return "Consortium name must be at least 3 characters.";
    if (!selectedType) return "No consortium template is available yet.";
    if (!isServerMode && consortiumTag.trim().length < 2) return "Consortium tag must be at least 2 characters.";
    if (player.gold < foundingCost) return `You need ${(foundingCost - player.gold).toLocaleString("en-GB")} more gold.`;
    return null;
  }, [board, consortiumName, consortiumTag, foundingCost, isServerMode, player.gold, selectedType]);

  const canCreateConsortium = consortiumBlockReason === null;

  const employeeRows = board ? getEmployeeRows(board) : [];
  const isConsortiumMemberView = Boolean(board?.memberRoleKey);
  const academyContract = asRecord((board as (ConsortiumBoard & { academyContract?: unknown }) | null)?.academyContract);
  const businessContract = asRecord(academyContract.businessStudies);
  const businessCompletionPct = readNumber(businessContract.averageTrackCompletionPct);
  const businessCompletedCourses = readNumber(businessContract.averageCompletedCourses);
  const businessRequiredCourses = Math.max(1, readNumber(businessContract.requiredCourses));
  const businessYieldPct = readNumber(businessContract.consortiumYieldPct);
  const businessWorkerEfficiencyPct = readNumber(businessContract.workerEfficiencyPct);
  const businessTreasuryPct = readNumber(businessContract.treasuryEfficiencyPct);
  const businessRoutePct = readNumber(businessContract.routePerformancePct);
  const commandCards = board
    ? [
        {
          label: "Type",
          value: board.consortiumTypeName ?? "Unclassified",
          note: `Tier ${board.starRating ?? 1}`,
        },
        {
          label: "Treasury",
          value: `${board.treasury.gold.toLocaleString("en-GB")} gold`,
          note: "Liquid reserves",
        },
        {
          label: "Daily Yield",
          value: `${getDailyGeneration(board).toLocaleString("en-GB")} gold`,
          note: businessYieldPct > 0
            ? `${getApplicantCount(board)} applicants waiting | +${businessYieldPct}% academy`
            : `${getApplicantCount(board)} applicants waiting`,
        },
        {
          label: "Personnel",
          value: String(board.members.length),
          note: `Advertising level ${getAdvertisingLevel(board)}`,
        },
      ]
    : [];

  async function createConsortium() {
    if (!canCreateConsortium) return;

    if (isServerMode && serverSessionToken) {
      const result = await createOrganization(serverSessionToken, {
        type: "consortium",
        name: consortiumName.trim(),
        consortiumTypeKey: selectedType.id,
      });
      if ("ok" in result && result.ok === false) {
        setMessage(result.error);
        return;
      }

      const payload = result as {
        organization: ConsortiumBoard;
        playerState: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"];
      };

      if (activeAccount) {
        mergeServerStateIntoCache({
          email: activeAccount.email,
          user: {
            internalPlayerId: activeAccount.internalPlayerId,
            publicId: activeAccount.publicId,
            firstName: activeAccount.firstName,
            lastName: activeAccount.lastName,
          },
          playerState: payload.playerState,
        });
      }

      setBoard(payload.organization);
      setConsortiumName("");
      setConsortiumTag("");
      setMessage(
        `Consortium founded: ${payload.organization.name} [${formatEntityPublicId("consortium", payload.organization.publicId)}]`,
      );
      return;
    }

    const paid = spendGold(foundingCost);
    if (!paid) {
      setMessage("Not enough gold to found a consortium.");
      return;
    }

    const publicId = allocatePublicNumericId(
      "consortium",
      collectExistingOrganizationPublicIds(CONSORTIUM_STORAGE_PREFIX),
    );
    const founderPublicId = typeof player.publicId === "number" ? player.publicId : publicId;
    const directorRole: OrganizationRole = {
      roleKey: "director",
      displayName: "Director",
      rankOrder: 1,
      permissions: ["manage_members", "manage_treasury", "manage_contracts", "recruit_members", "view_logs", "participate"],
      isSystemRole: true,
    };
    const foundingMember: OrganizationMember = {
      userInternalId: player.internalId,
      publicId: founderPublicId,
      displayName,
      roleKey: directorRole.roleKey,
      joinedAt: Date.now(),
    };

    const nextBoard: ConsortiumBoard = {
      internalId: `local_consortium_${player.internalId}`,
      publicId,
      type: "consortium",
      name: consortiumName.trim(),
      tag: consortiumTag.trim().toUpperCase().slice(0, 6),
      founderInternalId: player.internalId,
      founderPublicId,
      description: selectedType.summary,
      statusText: "Founding charter filed",
      consortiumTypeKey: selectedType.id,
      consortiumTypeName: selectedType.name,
      passiveBonusSummary: selectedType.roleSummary,
      creationCost: foundingCost,
      treasury: {
        copper: 0,
        silver: 0,
        gold: selectedType.startingVault,
        platinum: 0,
      },
      metadata: {
        applicantCount: 0,
        advertisingLevel: 1,
        baseIncomePerShift: selectedType.baseIncomePerShift,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      roles: [directorRole],
      members: [foundingMember],
      logs: [],
      starRating: 1,
    };

    writeJson(consortiumKey(player.internalId), nextBoard);
    setBoard(nextBoard);
    setConsortiumName("");
    setConsortiumTag("");
    setMessage(
      `Consortium founded: ${nextBoard.name} [${formatEntityPublicId("consortium", nextBoard.publicId)}]`,
    );

  }

  return (
    <AppShell
      title="Consortiums"
      hint="Economic organizations now behave more like real player companies: pick a type, fund it properly, then run the board."
    >
      <div className="guild-stack">
        <section className="panel">
          <div className="panel__body guild-grid">
            <article className="guild-card">
              <div className="guild-card__section-title">Consortium Brief</div>
              <div className="guild-card__body guild-card__body--small">
                {pageCopy.flavor}
              </div>
              {pageCopy.alt ? <div className="guild-card__body guild-card__body--small">{pageCopy.alt}</div> : null}
            </article>
            <article className="guild-card">
              <div className="guild-card__section-title">CIEL</div>
              <div className="guild-card__body guild-card__body--small">{pageCopy.ciel}</div>
            </article>
          </div>
        </section>

        {message ? (
          <section className="panel guild-message-panel">
            <div className="panel__body">
              <strong>{message}</strong>
            </div>
          </section>
        ) : null}

        {commandCards.length ? (
          <section className="guild-command-strip">
            {commandCards.map((card) => (
              <article key={card.label} className="guild-command-card">
                <span className="guild-command-card__label">{card.label}</span>
                <strong className="guild-command-card__value">{card.value}</strong>
                <span className="guild-command-card__note">{card.note}</span>
              </article>
            ))}
          </section>
        ) : null}

        <section className="panel">
          <div className="panel__header">
            <h2>{board ? "Company Operations" : "Found a Consortium"}</h2>
          </div>
          <div className="panel__body guild-stack">
            {loadingBoard ? (
              <div className="guild-inline-note">
                Loading consortium records from the live shard.
              </div>
            ) : board ? (
              isConsortiumMemberView ? (
                <div className="org-surface">
                  <section className="org-hero org-hero--consortium">
                    <div>
                      <p className="org-eyebrow">Company Dossier</p>
                      <h2 className="org-hero__title">
                        {board.name} <span>[{formatEntityPublicId("consortium", board.publicId)}]</span>
                      </h2>
                      <p className="org-hero__copy">
                        {board.description ?? "Operational board for routes, treasury, and escort contracts."}
                      </p>
                      <div className="org-tag-row">
                        <span>{board.consortiumTypeName ?? "Unclassified"}</span>
                        <span>{board.memberRoleKey ?? "member"}</span>
                        <span>Founded {formatDate(board.createdAt)}</span>
                        <span>{board.statusText}</span>
                      </div>
                    </div>
                    <div className="org-hero__actions">
                      <button type="button" className="org-button" onClick={() => void reloadConsortiumBoard()}>
                        Refresh Board
                      </button>
                      <button type="button" className="org-button" onClick={() => setMemberTab("logistics")}>
                        Logistics
                      </button>
                      <button type="button" className="org-button org-button--ghost" onClick={() => setMemberTab("base")}>
                        Base Ledger
                      </button>
                    </div>
                  </section>

                  <div className="guild-tabs">
                    <button
                      type="button"
                      className={`guild-tab${memberTab === "overview" ? " guild-tab--active" : ""}`}
                      onClick={() => setMemberTab("overview")}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      className={`guild-tab${memberTab === "logistics" ? " guild-tab--active" : ""}`}
                      onClick={() => setMemberTab("logistics")}
                    >
                      Logistics
                    </button>
                    <button
                      type="button"
                      className={`guild-tab${memberTab === "base" ? " guild-tab--active" : ""}`}
                      onClick={() => setMemberTab("base")}
                    >
                      Base
                    </button>
                  </div>

                  {memberTab === "overview" ? (
                    <>
                      <section className="org-stat-strip">
                        <article className="org-stat-card">
                          <span>Treasury</span>
                          <strong>{board.treasury.gold.toLocaleString("en-GB")}g</strong>
                          <p>Liquid reserve</p>
                        </article>
                        <article className="org-stat-card">
                          <span>Staff</span>
                          <strong>{board.members.length}</strong>
                          <p>Assignable employees</p>
                        </article>
                        <article className="org-stat-card">
                          <span>Daily Yield</span>
                          <strong>{getDailyGeneration(board).toLocaleString("en-GB")}</strong>
                          <p>Gold generation</p>
                        </article>
                        {(() => { const hazardPressure = getHazardPressure(board); return (
                          <article className="org-stat-card">
                            <span>Hazard Pressure</span>
                            <strong title={getHazardExplanation(hazardPressure)}>{hazardPressure}</strong>
                            <p>{getHazardSeverity(hazardPressure)} - {getHazardExplanation(hazardPressure)}</p>
                          </article>
                        ); })()}
                        <article className="org-stat-card">
                          <span>Escort State</span>
                          <strong>{board.memberRoleKey ? "Linked" : "Public"}</strong>
                          <p>Guild coverage available</p>
                        </article>
                      </section>

                      <section className="panel org-panel">
                        <div className="org-panel__head">
                          <div>
                            <p className="org-eyebrow">Academy Contract</p>
                            <h3>Business Studies linkage</h3>
                          </div>
                        </div>
                        <div className="org-detail-list">
                          <StatusRow label="Track completion" value={`${businessCompletionPct}%`} />
                          <StatusRow label="Track coverage" value={`${businessCompletedCourses.toFixed(1)} / ${businessRequiredCourses}`} />
                          <StatusRow label="Company yield" value={`+${businessYieldPct}%`} />
                          <StatusRow label="Worker efficiency" value={`+${businessWorkerEfficiencyPct}%`} />
                          <StatusRow label="Treasury discipline" value={`+${businessTreasuryPct}%`} />
                          <StatusRow label="Route performance" value={`+${businessRoutePct}%`} />
                        </div>
                        <div className="guild-inline-note">
                          Business Studies now feeds this board through server-calculated modifiers tied to completed study progress.
                        </div>
                      </section>

                      <section className="org-grid-two">
                        <section className="panel org-panel">
                          <div className="org-panel__head">
                            <div>
                              <p className="org-eyebrow">Operations</p>
                              <h3>Live logistics board</h3>
                            </div>
                          </div>
                          <div className="org-detail-list">
                            <StatusRow label="Company Type" value={board.consortiumTypeName ?? "Unclassified"} />
                            <StatusRow label="Tier" value={board.starRating ?? 1} />
                            <StatusRow label="Applicants" value={getApplicantCount(board)} />
                            <StatusRow label="Advertising" value={`Level ${getAdvertisingLevel(board)}`} />
                            <StatusRow label="Daily Generation" value={`${getDailyGeneration(board).toLocaleString("en-GB")} gold`} />
                          </div>
                        </section>

                        <section className="panel org-panel">
                          <div className="org-panel__head">
                            <div>
                              <p className="org-eyebrow">Escort Contract</p>
                              <h3>Protection layer</h3>
                            </div>
                          </div>
                          <div className="org-detail-list">
                            <StatusRow label="Guild Link" value="Set per logistics operation" />
                            <StatusRow label="Coverage" value="Influences live route outcomes" />
                            <StatusRow label="Mode" value="None / Internal / Guild contract" />
                            <StatusRow label="Status" value="Configured in operation board" />
                          </div>
                          <div className="guild-inline-note">
                            This board follows the handoff flow: consortium route, escort slot, guild linkage, and resolved contribution.
                          </div>
                        </section>
                      </section>

                      <section className="panel org-panel">
                        <div className="org-panel__head">
                          <div>
                            <p className="org-eyebrow">Employees</p>
                            <h3>Assignable crew</h3>
                          </div>
                        </div>
                        <div className="org-table-wrap">
                          <table className="org-compact-table">
                            <thead>
                              <tr>
                                <th>Employee</th>
                                <th>Role</th>
                                <th>Summary</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employeeRows.map((employee) => (
                                <tr key={employee.key}>
                                  <td>{employee.summary.split(" | ")[0]}</td>
                                  <td>{employee.roleLabel}</td>
                                  <td>{employee.summary.split(" | ").slice(1).join(" | ") || "Operationally available"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </>
                  ) : null}

                  {memberTab === "logistics" ? (
                    <ConsortiumLogisticsBoard
                      board={board}
                      serverSessionToken={serverSessionToken}
                      onConsortiumReload={reloadConsortiumBoard}
                      onMessage={setMessage}
                    />
                  ) : null}

                  {memberTab === "base" ? (
                    <ContentPanel title="Consortium Base">
                      <OrganizationBaseTab
                        serverSessionToken={serverSessionToken}
                        organizationInternalId={board.internalId}
                        organizationType="consortium"
                        onMessage={setMessage}
                        onRefreshOrganization={() => void reloadConsortiumBoard()}
                      />
                    </ContentPanel>
                  ) : null}
                </div>
              ) : (
                <div className="org-surface">
                  <section className="org-hero org-hero--public">
                    <div>
                      <p className="org-eyebrow">Consortium Public Detail</p>
                      <h2 className="org-hero__title">
                        {board.name} <span>[{formatEntityPublicId("consortium", board.publicId)}]</span>
                      </h2>
                      <p className="org-hero__copy">{board.description ?? "Public consortium charter."}</p>
                    </div>
                    <div className="org-hero__actions">
                      <button type="button" className="org-button" disabled>
                        Submit Application
                      </button>
                      <button type="button" className="org-button org-button--ghost" disabled>
                        Request Escort Partnering
                      </button>
                    </div>
                  </section>

                  <section className="org-grid-two">
                    <section className="panel org-panel">
                      <div className="org-panel__head">
                        <div>
                          <p className="org-eyebrow">Company Charter</p>
                          <h3>Public standing</h3>
                        </div>
                      </div>
                      <div className="org-detail-list">
                        <StatusRow label="Type" value={board.consortiumTypeName ?? "Unclassified"} />
                        <StatusRow label="Tier" value={board.starRating ?? 1} />
                        <StatusRow label="Director" value={board.members[0]?.displayName ?? "Unlisted"} />
                        <StatusRow label="Founded" value={formatDate(board.createdAt)} />
                        <StatusRow label="Status" value={board.statusText} />
                      </div>
                    </section>

                    <section className="panel org-panel">
                      <div className="org-panel__head">
                        <div>
                          <p className="org-eyebrow">Public Offers</p>
                          <h3>Interaction paths</h3>
                        </div>
                      </div>
                      <div className="org-stack-list">
                        <article>
                          <strong>Applications</strong>
                          <p>Formal applications are reviewed by consortium directors and officers.</p>
                        </article>
                        <article>
                          <strong>Escort coordination</strong>
                          <p>Guild escort contracts are attached on active logistics operations.</p>
                        </article>
                        <article>
                          <strong>Commercial standing</strong>
                          <p>Tier, treasury discipline, and operation outcomes shape consortium reputation.</p>
                        </article>
                      </div>
                    </section>
                  </section>
                </div>
              )
            ) : !board && isDetailRoute ? (
              <div className="guild-grid">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Board unavailable</div>
                  <div className="guild-card__title">Consortium record could not be rendered</div>
                  <div className="guild-card__body guild-card__body--small">
                    {message ?? `No live consortium board matched ${routeOrganizationPublicId}. The route exists now; the record still has to cooperate.`}
                  </div>
                </section>
              </div>
            ) : !board && authSource === "server" && !isDetailRoute && boardLoadError ? (
              <div className="guild-grid">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Board unavailable</div>
                  <div className="guild-card__title">Consortium board could not be loaded</div>
                  <div className="guild-card__body guild-card__body--small">
                    {boardLoadError}
                  </div>
                  <button
                    type="button"
                    className="org-button"
                    onClick={() => {
                      void reloadConsortiumBoard();
                    }}
                  >
                    Retry consortium board
                  </button>
                </section>
              </div>
            ) : (
              <div className="guild-grid">
                <section className="guild-card guild-card--hero">
                  <div className="guild-card__eyebrow">Founding Charter</div>
                  <div className="guild-card__title">Build the operating board</div>
                  <div className="guild-card__body guild-card__body--small">
                    Consortiums are player companies. Choose a business type, fund it properly, and this board becomes its operating surface.
                  </div>
                  <div className="guild-roster">
                    <StatusRow
                      label="Requirement"
                      value={isServerMode ? "Name, company type, and founding funds" : "Name, tag, company type, and founding funds"}
                    />
                    {isServerMode ? null : <StatusRow label="Banner Mark" value="Legacy local tag required" />}
                    <StatusRow label="Founding Cost" value={`${foundingCost.toLocaleString("en-GB")} gold`} />
                    <StatusRow label="Consortium Writ" value={hasConsortiumWrit ? "Present" : "Missing"} />
                  </div>
                  <div className="org-form">
                    <input
                      className="org-input"
                      value={consortiumName}
                      onChange={(event) => setConsortiumName(event.target.value)}
                      placeholder="Consortium name"
                    />
                    {isServerMode ? null : (
                      <input
                        className="org-input"
                        value={consortiumTag}
                        onChange={(event) => setConsortiumTag(event.target.value)}
                        placeholder="Consortium tag"
                      />
                    )}
                    <button type="button" className="org-button" disabled={!canCreateConsortium} onClick={() => void createConsortium()}>
                      Create Consortium
                    </button>
                  </div>
                  <div className={`guild-inline-note${consortiumBlockReason ? " guild-inline-note--warning" : ""}`}>
                    {consortiumBlockReason ?? `${selectedType.name} selected. Founding this company will create your persistent board immediately.`}
                  </div>
                </section>

                <section className="guild-card">
                  <div className="guild-card__eyebrow">Consortium Types</div>
                  <div className="org-choices">
                    {consortiumTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={`org-choice${selectedTypeId === type.id ? " org-choice--active" : ""}`}
                        onClick={() => setSelectedTypeId(type.id)}
                      >
                        <strong>{type.name}</strong>
                        <span>{type.summary}</span>
                        <span>{type.roleSummary}</span>
                        <span>{type.baseIncomePerShift} gold / shift baseline</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
