import { useEffect, useMemo, useState } from "react";
import { ContentPanel } from "../layout/ContentPanel";
import {
  collectCivicBenefits,
  getCivicJobs,
  joinCivicJob,
  promoteCivicJob,
  resignCivicJob,
  spendCivicJobPoints,
  type CivicJobsResponse,
  type CivicPolicy,
  type CivicRank,
  type CivicTrack,
} from "../../lib/civicJobsApi";
import {
  getRequiredPointsForRank,
  getShiftCooldownRemaining,
  getTrackProgress,
  normalizeCivicEmploymentState,
  type CivicEmploymentState,
  type CivicTrackProgress,
} from "../../lib/civicJobsState";
import { useEducation } from "../../state/EducationContext";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";

type CivicRule = {
  minimumWorkingTotal?: number;
  minimumManualLabor?: number;
  minimumIntelligence?: number;
  minimumEndurance?: number;
  completedCourses?: string[];
  requireNotHospitalized?: boolean;
  requireNotJailed?: boolean;
};

const EMPTY_POLICY: CivicPolicy = {
  consortiumBlocked: false,
  rule: "none",
  blockedReason: null,
};

function formatRemaining(ms: number) {
  if (ms <= 0) return "Ready now";
  const totalHours = Math.ceil(ms / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function getWorkingTotal(player: ReturnType<typeof usePlayer>["player"]) {
  return (
    player.workingStats.manualLabor +
    player.workingStats.intelligence +
    player.workingStats.endurance
  );
}

function formatWorkingStatGains(gains: Record<string, unknown> | undefined) {
  if (!gains) return "No working-stat gains";
  const entries = Object.entries(gains)
    .filter(([, amount]) => Number(amount ?? 0) > 0)
    .map(([key, amount]) => {
      if (key === "manualLabor") return `+${amount} MAN`;
      if (key === "intelligence") return `+${amount} INT`;
      if (key === "endurance") return `+${amount} END`;
      return `+${amount} ${key}`;
    });
  return entries.length ? entries.join(" | ") : "No working-stat gains";
}

function getRuleFailure(
  ruleValue: unknown,
  player: ReturnType<typeof usePlayer>["player"],
  completedCourses: string[],
  status: { isHospitalized: boolean; isJailed: boolean },
) {
  const rule = (ruleValue ?? {}) as CivicRule;
  if (!rule) return null;
  if (rule.requireNotHospitalized && status.isHospitalized) return "Unavailable while hospitalized.";
  if (rule.requireNotJailed && status.isJailed) return "Unavailable while jailed.";
  if (typeof rule.minimumWorkingTotal === "number" && getWorkingTotal(player) < rule.minimumWorkingTotal) {
    return `Requires ${rule.minimumWorkingTotal}+ combined working stats.`;
  }
  if (typeof rule.minimumManualLabor === "number" && player.workingStats.manualLabor < rule.minimumManualLabor) {
    return `Requires Manual Labor ${rule.minimumManualLabor}+.`;
  }
  if (typeof rule.minimumIntelligence === "number" && player.workingStats.intelligence < rule.minimumIntelligence) {
    return `Requires Intelligence ${rule.minimumIntelligence}+.`;
  }
  if (typeof rule.minimumEndurance === "number" && player.workingStats.endurance < rule.minimumEndurance) {
    return `Requires Endurance ${rule.minimumEndurance}+.`;
  }
  if (Array.isArray(rule.completedCourses) && rule.completedCourses.length) {
    const missing = rule.completedCourses
      .filter((courseId) => !completedCourses.includes(courseId))
      .map((courseId) => courseId.replace(/-/g, " "));
    if (missing.length) return `Requires ${missing.join(", ")}.`;
  }
  return null;
}

function describeRequirement(ruleValue: unknown) {
  const rule = (ruleValue ?? {}) as CivicRule;
  const parts: string[] = [];
  if (typeof rule.minimumWorkingTotal === "number") parts.push(`Working total ${rule.minimumWorkingTotal}+`);
  if (typeof rule.minimumManualLabor === "number") parts.push(`MAN ${rule.minimumManualLabor}+`);
  if (typeof rule.minimumIntelligence === "number") parts.push(`INT ${rule.minimumIntelligence}+`);
  if (typeof rule.minimumEndurance === "number") parts.push(`END ${rule.minimumEndurance}+`);
  if (Array.isArray(rule.completedCourses) && rule.completedCourses.length) {
    parts.push(`Courses: ${rule.completedCourses.map((entry) => entry.replace(/-/g, " ")).join(", ")}`);
  }
  if (rule.requireNotHospitalized) parts.push("Not hospitalized");
  if (rule.requireNotJailed) parts.push("Not jailed");
  return parts.length ? parts.join(" | ") : "No additional gate";
}

function getCurrentRank(track: CivicTrack, progress: CivicTrackProgress | null) {
  const currentRank = progress?.rank ?? 1;
  return track.ranks.find((rank) => rank.rank === currentRank) ?? track.ranks[0];
}

function getNextRank(track: CivicTrack, progress: CivicTrackProgress | null) {
  const currentRank = progress?.rank ?? 1;
  return track.ranks.find((rank) => rank.rank === currentRank + 1) ?? null;
}

export default function CivicJobsBoard() {
  const { player, isHospitalized, isJailed } = usePlayer();
  const { serverHydrationVersion, serverSessionToken, refreshServerState } = useAuth();
  const education = useEducation();

  const [employment, setEmployment] = useState<CivicEmploymentState>(() =>
    normalizeCivicEmploymentState(player.current.civicEmployment),
  );
  const [tracks, setTracks] = useState<CivicTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [civicPolicy, setCivicPolicy] = useState<CivicPolicy>(EMPTY_POLICY);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  function applyServerSnapshot(result: CivicJobsResponse & { ok: true }) {
    const nextEmployment = normalizeCivicEmploymentState(result.civicEmployment);
    const nextTracks = Array.isArray(result.tracks) ? result.tracks : [];

    setEmployment(nextEmployment);
    setTracks(nextTracks);
    setCivicPolicy(result.civicPolicy ?? EMPTY_POLICY);

    const preferredTrack =
      nextEmployment.activeTrackId ??
      selectedTrackId ??
      nextTracks[0]?.id ??
      null;
    setSelectedTrackId(preferredTrack);
  }

  async function hydrateFromServer() {
    if (!serverSessionToken) {
      setEmployment(normalizeCivicEmploymentState(player.current.civicEmployment));
      setTracks([]);
      setSelectedTrackId(null);
      setCivicPolicy(EMPTY_POLICY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getCivicJobs(serverSessionToken);
    if (result.ok) {
      applyServerSnapshot(result);
      if (result.message) setMessage(result.message);
    } else {
      setMessage(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void hydrateFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSessionToken, serverHydrationVersion]);

  const status = { isHospitalized, isJailed };

  const activeTrack = useMemo(() => {
    if (!employment.activeTrackId) return null;
    return tracks.find((track) => track.id === employment.activeTrackId) ?? null;
  }, [employment.activeTrackId, tracks]);

  const selectedTrack = useMemo(() => {
    if (!tracks.length) return null;
    if (selectedTrackId) {
      const found = tracks.find((track) => track.id === selectedTrackId);
      if (found) return found;
    }
    if (employment.activeTrackId) {
      const active = tracks.find((track) => track.id === employment.activeTrackId);
      if (active) return active;
    }
    return tracks[0];
  }, [tracks, selectedTrackId, employment.activeTrackId]);

  useEffect(() => {
    if (selectedTrack?.id && selectedTrackId !== selectedTrack.id) {
      setSelectedTrackId(selectedTrack.id);
    }
  }, [selectedTrack, selectedTrackId]);

  const activeTrackProgress = activeTrack ? getTrackProgress(employment, activeTrack.id) : null;
  const selectedTrackProgress = selectedTrack ? getTrackProgress(employment, selectedTrack.id) : null;

  async function runAction(action: () => Promise<CivicJobsResponse>) {
    if (!serverSessionToken) {
      setMessage("Server session missing. Please log in again.");
      return;
    }

    setSubmitting(true);
    const result = await action();
    if (result.ok) {
      applyServerSnapshot(result);
      setMessage(result.message ?? "Civic records updated.");
      await refreshServerState();
    } else {
      setMessage(result.error);
    }
    setSubmitting(false);
  }

  function joinTrack(trackId: string) {
    void runAction(async () => joinCivicJob(serverSessionToken!, trackId));
  }

  function resignTrack() {
    void runAction(async () => resignCivicJob(serverSessionToken!));
  }

  function collectDailyBenefits() {
    void runAction(async () => collectCivicBenefits(serverSessionToken!));
  }

  function promoteTrack() {
    void runAction(async () => promoteCivicJob(serverSessionToken!));
  }

  function spendPoints(trackId: string, optionId: string) {
    void runAction(async () => spendCivicJobPoints(serverSessionToken!, trackId, optionId));
  }

  if (loading) {
    return (
      <ContentPanel title="Civic Jobs">
        <div style={{ color: "#b7c3cf", fontSize: 13 }}>Loading civic records...</div>
      </ContentPanel>
    );
  }

  if (!selectedTrack) {
    return (
      <ContentPanel title="Civic Jobs">
        <div style={{ color: "#d9a26f", fontSize: 13 }}>No civic tracks are available right now.</div>
      </ContentPanel>
    );
  }

  const selectedCurrentRank = getCurrentRank(selectedTrack, selectedTrackProgress);
  const selectedNextRank = getNextRank(selectedTrack, selectedTrackProgress);
  const selectedEntryFailure = getRuleFailure(selectedTrack.entryRule, player, education.completedCourses, status);
  const selectedNextRankFailure = selectedNextRank
    ? getRuleFailure(selectedNextRank.requirementRule, player, education.completedCourses, status)
    : null;

  const activeCurrentRank = activeTrack ? getCurrentRank(activeTrack, activeTrackProgress) : null;
  const activeNextRank = activeTrack ? getNextRank(activeTrack, activeTrackProgress) : null;
  const activeNextRankFailure = activeTrack && activeNextRank
    ? getRuleFailure(activeNextRank.requirementRule, player, education.completedCourses, status)
    : null;
  const cooldownRemaining = getShiftCooldownRemaining(activeTrackProgress, now);

  const canJoinSelected =
    !civicPolicy.consortiumBlocked &&
    !employment.activeTrackId &&
    !selectedEntryFailure;

  const canPromoteActive =
    !!activeTrack &&
    !!activeTrackProgress &&
    !!activeNextRank &&
    activeTrackProgress.jobPoints >= getRequiredPointsForRank(activeNextRank.rank) &&
    !activeNextRankFailure &&
    !civicPolicy.consortiumBlocked;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {message ? (
        <ContentPanel title="Civic Notice">
          <strong>{message}</strong>
        </ContentPanel>
      ) : null}

      {civicPolicy.consortiumBlocked ? (
        <ContentPanel title="Civic Jobs Blocked">
          <div style={{ border: "1px solid rgba(217, 143, 143, 0.55)", background: "rgba(75, 28, 28, 0.25)", color: "#f0b8b8", padding: 10, borderRadius: 8, fontSize: 13 }}>
            <strong>Consortium conflict:</strong> {civicPolicy.blockedReason ?? "Your consortium role blocks civic employment actions right now."}
          </div>
        </ContentPanel>
      ) : null}

      <ContentPanel title="Civic Employment Status">
        <div style={{ display: "grid", gap: 8 }}>
          {!activeTrack ? (
            <div style={{ border: "1px solid rgba(213, 160, 122, 0.45)", background: "rgba(81, 50, 27, 0.25)", color: "#f0c39a", padding: 10, borderRadius: 8, fontSize: 13 }}>
              You are unaffiliated. Choose a track from the Job Directory, review its entry requirements, then use Take Job when available.
            </div>
          ) : null}
          <div className="info-row">
            <span className="info-row__label">Current Employment</span>
            <span className="info-row__value">
              {activeTrack && activeCurrentRank ? `${activeTrack.name} | Rank ${activeCurrentRank.rank} ${activeCurrentRank.title}` : "Unaffiliated"}
            </span>
          </div>
          <div className="info-row">
            <span className="info-row__label">Current JP (active track)</span>
            <span className="info-row__value">{activeTrackProgress?.jobPoints ?? 0}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">Next Collection</span>
            <span className="info-row__value">{activeTrack ? formatRemaining(cooldownRemaining) : "Not employed"}</span>
          </div>
          {activeTrack ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={collectDailyBenefits} disabled={submitting || cooldownRemaining > 0 || civicPolicy.consortiumBlocked}>
                {cooldownRemaining > 0 ? `Collect (${formatRemaining(cooldownRemaining)})` : "Collect Daily"}
              </button>
              <button type="button" onClick={promoteTrack} disabled={submitting || !canPromoteActive}>
                Promote
              </button>
              <button type="button" onClick={resignTrack} disabled={submitting}>
                Resign
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#b7c3cf" }}>
              Choose a civic track below before collection, promotion, or resignation controls become available.
            </div>
          )}
          {activeTrack && activeNextRank ? (
            <div style={{ fontSize: 12, color: "#b7c3cf" }}>
              Next rank: {activeNextRank.title} | Cost: {getRequiredPointsForRank(activeNextRank.rank)} JP
              {activeNextRankFailure ? ` | ${activeNextRankFailure}` : ""}
            </div>
          ) : null}
          {civicPolicy.consortiumBlocked ? (
            <div style={{ fontSize: 12, color: "#d5a07a" }}>
              {civicPolicy.blockedReason}
            </div>
          ) : null}
        </div>
      </ContentPanel>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)" }}>
        <ContentPanel title="Job Directory">
          <div style={{ display: "grid", gap: 8 }}>
            {tracks.map((track) => {
              const progress = getTrackProgress(employment, track.id);
              const isSelected = selectedTrack?.id === track.id;
              const isActive = employment.activeTrackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelectedTrackId(track.id)}
                  style={{
                    textAlign: "left",
                    border: isSelected ? "1px solid rgba(151, 182, 216, 0.8)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "9px 10px",
                    background: isSelected ? "rgba(22, 34, 48, 0.8)" : "rgba(7, 13, 20, 0.55)",
                    color: "#dbe6f2",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{track.name}</div>
                  <div style={{ fontSize: 12, color: "#a5b5c4" }}>
                    {isActive ? "Active" : "Inactive"}
                    {progress ? ` | Rank ${progress.rank} | JP ${progress.jobPoints}` : " | No saved progress"}
                  </div>
                </button>
              );
            })}
          </div>
        </ContentPanel>

        <ContentPanel title={selectedTrack.name}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <strong>Entry Requirements</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(selectedTrack.entryRequirements ?? []).map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              {Array.isArray(selectedTrack.interviewQuestions) && selectedTrack.interviewQuestions.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <strong>Interview Questions</strong>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {selectedTrack.interviewQuestions.slice(0, 3).map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {selectedEntryFailure ? <div style={{ fontSize: 12, color: "#d98f8f" }}>Currently blocked: {selectedEntryFailure}</div> : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <strong>Selected Track Status</strong>
              <div className="info-row">
                <span className="info-row__label">Rank</span>
                <span className="info-row__value">{selectedTrackProgress ? `${selectedCurrentRank.rank}. ${selectedCurrentRank.title}` : "Not started"}</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">Track JP</span>
                <span className="info-row__value">{selectedTrackProgress?.jobPoints ?? 0}</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">Daily Salary (current rank)</span>
                <span className="info-row__value">{selectedCurrentRank.dailyGold} gold</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">Daily Working Gains</span>
                <span className="info-row__value">{formatWorkingStatGains(selectedCurrentRank.workingStatGains as Record<string, unknown>)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {employment.activeTrackId === selectedTrack.id ? (
                  <button type="button" disabled>
                    Active Job
                  </button>
                ) : (
                  <button type="button" disabled={!canJoinSelected || submitting} onClick={() => joinTrack(selectedTrack.id)}>
                    {civicPolicy.consortiumBlocked
                      ? "Blocked by Consortium"
                      : employment.activeTrackId
                        ? "Another Job Active"
                        : selectedEntryFailure
                          ? "Unavailable"
                          : "Take Job"}
                  </button>
                )}
              </div>
              {selectedNextRank ? (
                <div style={{ fontSize: 12, color: "#b7c3cf" }}>
                  Next rank: {selectedNextRank.title} | Cost {getRequiredPointsForRank(selectedNextRank.rank)} JP
                  {selectedNextRankFailure ? ` | ${selectedNextRankFailure}` : ""}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#8ec8a7" }}>Capstone rank reached for this civic track.</div>
              )}
            </div>

            <div style={{ display: "grid", gap: 7 }}>
              <strong>Rank Ladder</strong>
              {selectedTrack.ranks.map((rank: CivicRank) => {
                const isCurrent = selectedTrackProgress?.rank === rank.rank;
                const promotionCost = rank.rank > 1 ? getRequiredPointsForRank(rank.rank) : 0;
                return (
                  <div
                    key={`${selectedTrack.id}-${rank.rank}`}
                    style={{
                      border: isCurrent ? "1px solid rgba(156, 204, 174, 0.7)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 10,
                      background: "rgba(7, 13, 20, 0.55)",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>{rank.rank}. {rank.title}</strong>
                    <div style={{ fontSize: 12, color: "#cfd7de" }}>
                      Salary {rank.dailyGold} | JP/day {rank.dailyJobPoints} | {formatWorkingStatGains(rank.workingStatGains as Record<string, unknown>)}
                    </div>
                    <div style={{ fontSize: 12, color: "#b7c3cf" }}>
                      {rank.rank === 1 ? "Entry rank" : `Promotion cost ${promotionCost} JP`} | {describeRequirement(rank.requirementRule)}
                    </div>
                    {rank.passiveUnlock ? (
                      <div style={{ fontSize: 12, color: "#8ec8a7" }}>
                        Capstone: {rank.passiveUnlock.name} ({rank.passiveUnlock.activeMode === "permanent" ? "Permanent" : "Employed-only"})
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {selectedTrack.spendOptions?.length ? (
              <div style={{ display: "grid", gap: 7 }}>
                <strong>JP Spend Options ({selectedTrack.name} only)</strong>
                <div style={{ fontSize: 12, color: "#b7c3cf" }}>
                  Job points are job-specific. You can only spend {selectedTrack.name} JP on {selectedTrack.name} options.
                </div>
                {selectedTrack.spendOptions.map((option) => {
                  const availablePoints = selectedTrackProgress?.jobPoints ?? 0;
                  const canSpend = availablePoints >= option.costJobPoints;
                  return (
                    <div key={option.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7,13,20,0.52)", display: "grid", gap: 4 }}>
                      <strong>{option.label}</strong>
                      <div style={{ fontSize: 12, color: "#b7c3cf" }}>{option.description}</div>
                      <div style={{ fontSize: 12, color: "#d5dce3" }}>Cost: {option.costJobPoints} JP | Available: {availablePoints}</div>
                      <div>
                        <button
                          type="button"
                          disabled={submitting || !selectedTrackProgress || !canSpend}
                          onClick={() => spendPoints(selectedTrack.id, option.id)}
                        >
                          Spend JP
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}
