import { useEffect, useState, type ReactNode } from "react";
import {
  assignConsortiumLogisticsWorker,
  createConsortiumLogisticsOperation,
  getConsortiumLogisticsBoard,
  setConsortiumLogisticsEscort,
} from "../../lib/organizationApi";
import {
  type ConsortiumBoard,
  type ConsortiumLogisticsBoard as ConsortiumLogisticsState,
  type ConsortiumLogisticsOperation,
} from "../../lib/organizations";

type Props = {
  board: ConsortiumBoard;
  serverSessionToken: string | null;
  onConsortiumReload: () => Promise<void> | void;
  onMessage: (message: string | null) => void;
};

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function formatDuration(hours: number) {
  if (hours % 24 === 0) return `${hours / 24}d`;
  return `${hours}h`;
}

function formatRewardRange(minGold: number, maxGold: number) {
  return `${minGold.toLocaleString("en-GB")} - ${maxGold.toLocaleString("en-GB")} gold`;
}

function formatCountdown(targetAt: number | null) {
  if (!targetAt) return "Not started";
  const diff = Math.max(0, targetAt - Date.now());
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) return "Not available";
  return new Date(timestamp).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatOutcomeLabel(result: string | null) {
  switch (result) {
    case "strong_success": return "Strong Success";
    case "success": return "Success";
    case "partial_success": return "Partial Success";
    case "failure": return "Failure";
    case "severe_failure": return "Severe Failure";
    default: return "Pending";
  }
}

function formatDelta(delta: number | null) {
  if (delta === null) return "Pending";
  return `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toLocaleString("en-GB")} gold`;
}

function formatDangerPressure(value: number | null | undefined) {
  const pressure = Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
  if (pressure >= 75) return `${pressure}/100 (severe)`;
  if (pressure >= 50) return `${pressure}/100 (high)`;
  if (pressure >= 25) return `${pressure}/100 (guarded)`;
  return `${pressure}/100 (low)`;
}

function getOperationTimingLabel(operation: ConsortiumLogisticsOperation) {
  if (operation.state === "resolved") {
    return `Resolved ${formatTimestamp(operation.outcome.resolvedAt)}`;
  }
  if (operation.state === "active") {
    return `Due in ${formatCountdown(operation.expectedOutcomeAt)}`;
  }
  return "Draft only";
}

export function ConsortiumLogisticsBoard({
  board,
  serverSessionToken,
  onConsortiumReload,
  onMessage,
}: Props) {
  const [logistics, setLogistics] = useState<ConsortiumLogisticsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [workerDrafts, setWorkerDrafts] = useState<Record<string, string>>({});
  const [escortModeDrafts, setEscortModeDrafts] = useState<Record<string, string>>({});
  const [escortGuildDrafts, setEscortGuildDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!serverSessionToken) return;
    let cancelled = false;
    setLoading(true);
    void getConsortiumLogisticsBoard(serverSessionToken, board.internalId)
      .then((result) => {
        if (cancelled) return;
        if ("ok" in result && result.ok === false) {
          onMessage(result.error);
          return;
        }
        setLogistics((result as { logistics: ConsortiumLogisticsState }).logistics);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board.internalId, onMessage, serverSessionToken]);

  useEffect(() => {
    if (!logistics) return;
    setEscortModeDrafts(
      Object.fromEntries(logistics.operations.map((operation) => [operation.internalId, operation.escortContract.mode])),
    );
    setEscortGuildDrafts(
      Object.fromEntries(
        logistics.operations.map((operation) => [
          operation.internalId,
          operation.escortContract.guildPublicId ? String(operation.escortContract.guildPublicId) : "",
        ]),
      ),
    );
  }, [logistics]);

  const treasuryGold = board.treasury.gold ?? 0;
  const logisticsSummary = logistics?.summary ?? { draftCount: 0, activeCount: 0, resolvedCount: 0, escortLinkedCount: 0 };
  const canManage = logistics?.canManageOperations ?? false;

  async function syncBoardAfterMutation(nextLogistics: ConsortiumLogisticsState) {
    setLogistics(nextLogistics);
    await onConsortiumReload();
  }

  async function createOperation(templateKey: string, mode: "draft" | "launch") {
    if (!serverSessionToken) return;
    setBusyKey(`${templateKey}:${mode}`);
    const result = await createConsortiumLogisticsOperation(serverSessionToken, board.internalId, { templateKey, mode });
    setBusyKey(null);
    if ("ok" in result && result.ok === false) {
      onMessage(result.error);
      return;
    }
    const payload = result as { logistics: ConsortiumLogisticsState };
    await syncBoardAfterMutation(payload.logistics);
    onMessage(mode === "launch" ? "Logistics operation launched." : "Logistics draft created.");
  }

  async function assignWorker(operationId: string, action: "assign" | "remove", publicId?: string) {
    if (!serverSessionToken) return;
    const targetPublicId = publicId ?? workerDrafts[operationId];
    if (!targetPublicId) {
      onMessage("Choose a consortium worker first.");
      return;
    }
    setBusyKey(`${operationId}:worker:${action}`);
    const result = await assignConsortiumLogisticsWorker(serverSessionToken, board.internalId, operationId, { publicId: targetPublicId, action });
    setBusyKey(null);
    if ("ok" in result && result.ok === false) {
      onMessage(result.error);
      return;
    }
    const payload = result as { logistics: ConsortiumLogisticsState };
    await syncBoardAfterMutation(payload.logistics);
    onMessage(action === "assign" ? "Worker assigned to operation." : "Worker removed from operation.");
  }

  async function saveEscort(operationId: string) {
    if (!serverSessionToken) return;
    const mode = (escortModeDrafts[operationId] ?? "none") as "none" | "internal_team" | "guild_contract";
    const guildPublicId = escortGuildDrafts[operationId];
    setBusyKey(`${operationId}:escort`);
    const result = await setConsortiumLogisticsEscort(serverSessionToken, board.internalId, operationId, {
      mode,
      guildPublicId,
    });
    setBusyKey(null);
    if ("ok" in result && result.ok === false) {
      onMessage(result.error);
      return;
    }
    const payload = result as { logistics: ConsortiumLogisticsState };
    await syncBoardAfterMutation(payload.logistics);
    onMessage(mode === "none" ? "Escort link cleared." : "Escort coverage updated.");
  }

  if (!serverSessionToken) return null;

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Logistics Operations</h2>
      </div>
      <div className="panel__body guild-stack">
        {loading && !logistics ? <div className="guild-inline-note">Loading consortium logistics from the live shard.</div> : null}

        {logistics ? (
          <>
            <div className="guild-command-strip">
              <article className="guild-command-card">
                <span className="guild-command-card__label">Drafts</span>
                <strong className="guild-command-card__value">{logisticsSummary.draftCount}</strong>
                <span className="guild-command-card__note">Routes in preparation</span>
              </article>
              <article className="guild-command-card">
                <span className="guild-command-card__label">Active Routes</span>
                <strong className="guild-command-card__value">{logisticsSummary.activeCount}</strong>
                <span className="guild-command-card__note">Operations currently underway</span>
              </article>
              <article className="guild-command-card">
                <span className="guild-command-card__label">Resolved Runs</span>
                <strong className="guild-command-card__value">{logisticsSummary.resolvedCount}</strong>
                <span className="guild-command-card__note">Results already settled into treasury</span>
              </article>
              <article className="guild-command-card">
                <span className="guild-command-card__label">Escort Links</span>
                <strong className="guild-command-card__value">{logisticsSummary.escortLinkedCount}</strong>
                <span className="guild-command-card__note">Guild coverage contracts attached</span>
              </article>
              <article className="guild-command-card">
                <span className="guild-command-card__label">Treasury Ready</span>
                <strong className="guild-command-card__value">{treasuryGold.toLocaleString("en-GB")}g</strong>
                <span className="guild-command-card__note">Launch costs and payouts settle here</span>
              </article>
            </div>

            <section className="guild-card">
              <div className="guild-card__eyebrow">Route Templates</div>
              <div className="org-choices logistics-template-grid">
                {logistics.templates.map((template) => {
                  const launchBlocked = treasuryGold < template.upfrontCostGold;
                  return (
                    <div key={template.key} className="org-choice logistics-template-card">
                      <strong>{template.displayName}</strong>
                      <span>{template.summary}</span>
                      <span>Route: {template.routeType} | Risk: {template.riskLevel}</span>
                      <span>Duration: {formatDuration(template.durationHours)}</span>
                      <span>Cost: {template.upfrontCostGold.toLocaleString("en-GB")} gold</span>
                      <span>Potential: {formatRewardRange(template.rewardRange.minGold, template.rewardRange.maxGold)}</span>
                      <span>Dangers: {template.dangerTags.join(", ")}</span>
                      <div className="logistics-template-card__actions">
                        <button
                          type="button"
                          className="org-button"
                          disabled={!canManage || busyKey === `${template.key}:draft`}
                          onClick={() => void createOperation(template.key, "draft")}
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          className="org-button"
                          disabled={!canManage || launchBlocked || busyKey === `${template.key}:launch`}
                          onClick={() => void createOperation(template.key, "launch")}
                        >
                          Launch
                        </button>
                      </div>
                      <div className={`guild-inline-note${launchBlocked ? " guild-inline-note--warning" : ""}`}>
                        {launchBlocked
                          ? `Treasury needs ${(template.upfrontCostGold - treasuryGold).toLocaleString("en-GB")} more gold to launch immediately.`
                          : `Recommended crew ${template.recommendedWorkers} | Work ${template.recommendedWorkingScore} | Battle ${template.recommendedBattleScore}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel org-panel org-panel--escort-flow">
              <div className="org-panel__head">
                <div>
                  <p className="org-eyebrow">Escort Contracts</p>
                  <h3>Consortium to Guild contract loop</h3>
                </div>
              </div>
              <div className="org-grid-two">
                <section className="org-flow-card">
                  <strong>Consortium side</strong>
                  <p>Create or launch a route, set escort mode, and attach guild contract coverage when needed.</p>
                </section>
                <section className="org-flow-card">
                  <strong>Guild impact</strong>
                  <p>Guild contract coverage directly modifies route outcomes today; pricing and negotiation UX stay in the next pass.</p>
                </section>
              </div>
            </section>

            <section className="guild-card">
              <div className="guild-card__eyebrow">Active, Draft, and Resolved Operations</div>
              {logistics.operations.length ? (
                <div className="guild-stack">
                  {logistics.operations.map((operation) => {
                    const busyWorker = busyKey?.startsWith(`${operation.internalId}:worker`);
                    const busyEscort = busyKey === `${operation.internalId}:escort`;
                    const selectedWorker = workerDrafts[operation.internalId] ?? "";
                    const escortDraftMode = escortModeDrafts[operation.internalId] ?? operation.escortContract.mode;
                    const canManageThisOperation = canManage && Boolean(operation.canManageAssignments);

                    return (
                      <article key={operation.internalId} className="guild-card logistics-operation-card">
                        <div className="guild-card__title">{operation.displayName} <span>{operation.state}</span></div>
                        <div className="guild-grid">
                          <div className="guild-roster">
                            <StatusRow label="Status" value={operation.statusText} />
                            <StatusRow label="Route" value={`${operation.routeType} / ${operation.lane}`} />
                            <StatusRow label="Risk" value={operation.riskLevel} />
                            <StatusRow label="Duration" value={formatDuration(operation.durationHours)} />
                            <StatusRow label="Reward" value={formatRewardRange(operation.rewardRange.minGold, operation.rewardRange.maxGold)} />
                            <StatusRow label="Danger" value={operation.dangerProfile.tags.join(", ")} />
                            <StatusRow label="Timing" value={getOperationTimingLabel(operation)} />
                          </div>
                          <div className="guild-roster">
                            <StatusRow label="Success Preview" value={`${operation.preview?.successOdds ?? 0}%`} />
                            <StatusRow label="Crew Coverage" value={`${operation.preview?.workerCoverage ?? 0}%`} />
                            <StatusRow label="Working Load" value={operation.preview?.totalWorking ?? 0} />
                            <StatusRow label="Battle Cover" value={operation.preview?.totalBattle ?? 0} />
                            <StatusRow label="Escort Score" value={operation.preview?.escortScore ?? 0} />
                            <StatusRow label="Danger Pressure" value={formatDangerPressure(operation.preview?.dangerPressure)} />
                            <StatusRow label="Outcome" value={formatOutcomeLabel(operation.outcome.result)} />
                          </div>
                        </div>

                        {operation.outcome.result ? (
                          <section className="guild-card">
                            <div className="guild-card__eyebrow">Resolved Outcome</div>
                            <div className="guild-grid">
                              <div className="guild-roster">
                                <StatusRow label="Result" value={formatOutcomeLabel(operation.outcome.result)} />
                                <StatusRow label="Resolved At" value={formatTimestamp(operation.outcome.resolvedAt)} />
                                <StatusRow label="Gold Returned" value={operation.outcome.goldReturned?.toLocaleString("en-GB") ?? "0"} />
                                <StatusRow label="Treasury Impact" value={formatDelta(operation.outcome.treasuryDeltaGold)} />
                                <StatusRow label="Loss Applied" value={`${operation.outcome.lossAppliedGold.toLocaleString("en-GB")} gold`} />
                                <StatusRow label="Danger Triggered" value={operation.outcome.dangerTriggered.length ? operation.outcome.dangerTriggered.join(", ") : "None that stuck"} />
                              </div>
                              <div className="guild-roster">
                                <StatusRow label="Crew Contribution" value={operation.outcome.crewContribution ?? "Pending"} />
                                <StatusRow label="Escort Contribution" value={operation.outcome.escortContribution ?? "Pending"} />
                                <StatusRow label="Resolution Score" value={operation.outcome.resolutionScore ?? "Pending"} />
                                <StatusRow label="Loss Summary" value={operation.outcome.lossSummary ?? "No additional losses recorded."} />
                              </div>
                            </div>
                            <div className="guild-inline-note">{operation.outcome.summary}</div>
                          </section>
                        ) : (
                          <div className="guild-inline-note">Outcome is still pending. Danger Pressure is a 0-100 lane risk score lowered by crew quality, battle cover, and escort choice before the operation settles.</div>
                        )}

                        <div className="guild-grid">
                          <section className="guild-card">
                            <div className="guild-card__eyebrow">Assigned Workers</div>
                            {operation.assignedWorkers.length ? (
                              <div className="guild-stack">
                                {operation.assignedWorkers.map((worker) => (
                                  <div key={worker.userInternalId} className="guild-roster__row">
                                    <div>
                                      <div className="guild-roster__role">{worker.assignmentRole}</div>
                                      <div className="guild-roster__name">{worker.displayName} [{worker.publicId}]</div>
                                    </div>
                                    <button
                                      type="button"
                                      className="org-button"
                                      disabled={!canManageThisOperation || Boolean(busyWorker)}
                                      onClick={() => void assignWorker(operation.internalId, "remove", String(worker.publicId))}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="guild-inline-note">No employees assigned yet.</div>
                            )}
                            <div className="org-form logistics-inline-form">
                              <select
                                className="org-input"
                                value={selectedWorker}
                                disabled={!canManageThisOperation}
                                onChange={(event) => setWorkerDrafts((current) => ({ ...current, [operation.internalId]: event.target.value }))}
                              >
                                <option value="">Select consortium worker</option>
                                {logistics.workerPool.map((worker) => (
                                  <option key={worker.userInternalId} value={worker.publicId}>
                                    {worker.displayName} [{worker.publicId}] | W {worker.workingScore} | B {worker.battleScore}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="org-button"
                                disabled={!canManageThisOperation || !selectedWorker || Boolean(busyWorker)}
                                onClick={() => void assignWorker(operation.internalId, "assign")}
                              >
                                Assign Worker
                              </button>
                            </div>
                          </section>

                          <section className="guild-card">
                            <div className="guild-card__eyebrow">Escort Contract Slot</div>
                            <div className="guild-roster">
                              <StatusRow label="Mode" value={operation.escortContract.mode} />
                              <StatusRow label="Coverage" value={operation.escortContract.coverageRating} />
                              <StatusRow label="Guild Link" value={operation.escortContract.guildName ?? "None"} />
                              <StatusRow label="Contract State" value={operation.escortContract.status} />
                            </div>
                            <div className="org-form logistics-inline-form">
                              <select
                                className="org-input"
                                disabled={!canManageThisOperation}
                                value={escortDraftMode}
                                onChange={(event) => setEscortModeDrafts((current) => ({ ...current, [operation.internalId]: event.target.value }))}
                              >
                                {logistics.escortModes.map((mode) => (
                                  <option key={mode.key} value={mode.key}>{mode.displayName}</option>
                                ))}
                              </select>
                              {escortDraftMode === "guild_contract" ? (
                                <input
                                  className="org-input"
                                  disabled={!canManageThisOperation}
                                  value={escortGuildDrafts[operation.internalId] ?? ""}
                                  onChange={(event) => setEscortGuildDrafts((current) => ({ ...current, [operation.internalId]: event.target.value }))}
                                  placeholder="Guild public ID"
                                />
                              ) : null}
                              <button
                                type="button"
                                className="org-button"
                                disabled={!canManageThisOperation || Boolean(busyEscort)}
                                onClick={() => void saveEscort(operation.internalId)}
                              >
                                Save Escort Link
                              </button>
                            </div>
                            <div className="guild-inline-note">{logistics.placeholderNotice}</div>
                          </section>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="guild-inline-note">No logistics operations exist yet. Draft one above and the board will start looking appropriately expensive.</div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
