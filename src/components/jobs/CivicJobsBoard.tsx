import { useEffect, useMemo, useState } from "react";
import { ContentPanel } from "../layout/ContentPanel";
import {
  CIVIC_JOB_TRACKS,
  type CivicEntryRequirementRule,
  type CivicJobRank,
  type CivicJobTrack,
  type CivicJobTrackId,
  type CivicRankRequirementRule,
} from "../../data/civicJobsData";
import {
  createTrackProgress,
  getRequiredPointsForRank,
  getShiftCooldownRemaining,
  getTrackProgress,
  readCivicEmploymentState,
  writeCivicEmploymentState,
  type CivicEmploymentState,
  type CivicTrackProgress,
} from "../../lib/civicJobsState";
import { useEducation } from "../../state/EducationContext";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Ready now";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getWorkingTotal(player: ReturnType<typeof usePlayer>["player"]) {
  return (
    player.workingStats.manualLabor +
    player.workingStats.intelligence +
    player.workingStats.endurance
  );
}

function getRuleFailure(
  rule: CivicEntryRequirementRule | CivicRankRequirementRule | undefined,
  player: ReturnType<typeof usePlayer>["player"],
  completedCourses: string[],
  status: { isHospitalized: boolean; isJailed: boolean },
) {
  if (!rule) return null;
  if (rule.requireNotHospitalized && status.isHospitalized) return "Unavailable while hospitalized.";
  if (rule.requireNotJailed && status.isJailed) return "Unavailable while jailed.";
  if (typeof rule.minimumWorkingTotal === "number" && getWorkingTotal(player) < rule.minimumWorkingTotal) {
    return `Requires ${rule.minimumWorkingTotal}+ combined working stats.`;
  }
  if (typeof rule.minimumManualLabor === "number" && player.workingStats.manualLabor < rule.minimumManualLabor) {
    return `Requires Manual Labor ${rule.minimumManualLabor}+ .`;
  }
  if (typeof rule.minimumIntelligence === "number" && player.workingStats.intelligence < rule.minimumIntelligence) {
    return `Requires Intelligence ${rule.minimumIntelligence}+ .`;
  }
  if (typeof rule.minimumEndurance === "number" && player.workingStats.endurance < rule.minimumEndurance) {
    return `Requires Endurance ${rule.minimumEndurance}+ .`;
  }
  if (rule.completedCourses?.length) {
    const missing = rule.completedCourses
      .filter((courseId: string) => !completedCourses.includes(courseId))
      .map((courseId: string) => courseId.replace(/-/g, " "));
    if (missing.length) return `Requires ${missing.join(", ")}.`;
  }
  return null;
}

function getCurrentRank(track: CivicJobTrack, progress: CivicTrackProgress | null) {
  const currentRank = progress?.rank ?? 1;
  return track.ranks.find((rank) => rank.rank === currentRank) ?? track.ranks[0];
}

function getNextRank(track: CivicJobTrack, progress: CivicTrackProgress | null) {
  const currentRank = progress?.rank ?? 1;
  return track.ranks.find((rank) => rank.rank === currentRank + 1) ?? null;
}

export default function CivicJobsBoard() {
  const { player, addGold, addExperience, isHospitalized, isJailed } = usePlayer();
  const { serverHydrationVersion } = useAuth();
  const education = useEducation();
  const [employment, setEmployment] = useState<CivicEmploymentState>(() =>
    readCivicEmploymentState(player.internalId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setEmployment(readCivicEmploymentState(player.internalId));
  }, [player.internalId, serverHydrationVersion]);

  useEffect(() => {
    writeCivicEmploymentState(player.internalId, employment);
  }, [employment, player.internalId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = { isHospitalized, isJailed };
  const activeTrack = employment.activeTrackId
    ? CIVIC_JOB_TRACKS.find((track) => track.id === employment.activeTrackId) ?? null
    : null;

  function showMessage(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(null), 3500);
  }

  function joinTrack(trackId: CivicJobTrackId) {
    const track = CIVIC_JOB_TRACKS.find((entry) => entry.id === trackId);
    if (!track) return;
    const failure = getRuleFailure(track.entryRule, player, education.completedCourses, status);
    if (failure) {
      showMessage(failure);
      return;
    }

    setEmployment((current) => ({
      activeTrackId: trackId,
      trackProgress: {
        ...current.trackProgress,
        [trackId]: current.trackProgress[trackId] ?? createTrackProgress(),
      },
    }));
    showMessage(`Joined ${track.name}. Public service now owns part of your calendar.`);
  }

  function resignTrack() {
    if (!activeTrack) return;
    setEmployment((current) => ({
      ...current,
      activeTrackId: null,
    }));
    showMessage(`You resigned from ${activeTrack.name}. The paperwork is probably thrilled.`);
  }

  function workShift(track: CivicJobTrack) {
    const progress = getTrackProgress(employment, track.id);
    if (!progress || employment.activeTrackId !== track.id) return;
    const cooldownRemaining = getShiftCooldownRemaining(progress, now);
    if (cooldownRemaining > 0) {
      showMessage(`Next shift available in ${formatRemaining(cooldownRemaining)}.`);
      return;
    }

    const currentRank = getCurrentRank(track, progress);
    let nextProgress: CivicTrackProgress = {
      ...progress,
      jobPoints: progress.jobPoints + currentRank.dailyJobPoints,
      shiftsWorked: progress.shiftsWorked + 1,
      lastShiftAt: now,
    };

    addGold(currentRank.dailyGold);
    addExperience(currentRank.dailyJobPoints * 4);

    let promotedTo: string | null = null;
    let nextRank = getNextRank(track, nextProgress);
    while (nextRank) {
      const hasPoints = nextProgress.jobPoints >= getRequiredPointsForRank(nextRank.rank);
      const requirementFailure = getRuleFailure(nextRank.requirementRule, player, education.completedCourses, status);
      if (!hasPoints || requirementFailure) break;
      nextProgress = {
        ...nextProgress,
        rank: nextRank.rank,
      };
      promotedTo = nextRank.title;
      nextRank = getNextRank(track, nextProgress);
    }

    setEmployment((current) => ({
      ...current,
      trackProgress: {
        ...current.trackProgress,
        [track.id]: nextProgress,
      },
    }));

    showMessage(
      promotedTo
        ? `Shift completed. Earned ${currentRank.dailyGold} gold and promoted to ${promotedTo}.`
        : `Shift completed. Earned ${currentRank.dailyGold} gold and ${currentRank.dailyJobPoints} job points.`,
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {message ? (
        <ContentPanel title="Employment Notice">
          <strong>{message}</strong>
        </ContentPanel>
      ) : null}

      {activeTrack ? (
        <ContentPanel title="Current Civic Employment">
          {(() => {
            const progress = getTrackProgress(employment, activeTrack.id);
            const currentRank = getCurrentRank(activeTrack, progress);
            const nextRank = getNextRank(activeTrack, progress);
            const cooldownRemaining = getShiftCooldownRemaining(progress, now);
            const nextRankFailure = nextRank
              ? getRuleFailure(nextRank.requirementRule, player, education.completedCourses, status)
              : null;

            return (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                  {activeTrack.name} | {currentRank.title}
                </div>
                <div className="info-row">
                  <span className="info-row__label">Job Points</span>
                  <span className="info-row__value">{progress?.jobPoints ?? 0}</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Shifts Worked</span>
                  <span className="info-row__value">{progress?.shiftsWorked ?? 0}</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Next Shift</span>
                  <span className="info-row__value">{formatRemaining(cooldownRemaining)}</span>
                </div>
                {nextRank ? (
                  <div style={{ fontSize: 12, color: "#b7c3cf" }}>
                    Next promotion: {nextRank.title} at {getRequiredPointsForRank(nextRank.rank)} job points.
                    {nextRankFailure ? ` ${nextRankFailure}` : ""}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#8ec8a7" }}>Maximum civic rank reached for this track.</div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => workShift(activeTrack)} disabled={cooldownRemaining > 0 || isHospitalized || isJailed}>
                    {cooldownRemaining > 0 ? `Work Shift (${formatRemaining(cooldownRemaining)})` : "Work Shift"}
                  </button>
                  <button type="button" onClick={resignTrack}>
                    Resign
                  </button>
                </div>
              </div>
            );
          })()}
        </ContentPanel>
      ) : null}

      {CIVIC_JOB_TRACKS.map((track) => {
        const progress = getTrackProgress(employment, track.id);
        const currentRank = getCurrentRank(track, progress);
        const nextRank = getNextRank(track, progress);
        const entryFailure = getRuleFailure(track.entryRule, player, education.completedCourses, status);
        const isActive = employment.activeTrackId === track.id;
        const anotherTrackActive = !!employment.activeTrackId && !isActive;
        const canJoin = !isActive && !anotherTrackActive && !entryFailure;

        return (
          <ContentPanel key={track.id} title={track.name}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#9fb0bf", fontSize: 13 }}>{track.subtitle}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>What It Is</strong>
                <div style={{ fontSize: 13, opacity: 0.82 }}>
                  {track.name} is a civic employment track. Join it, work timed shifts, earn gold, and build rank-based passive utility over time.
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Interview Prompt</strong>
                <div style={{ fontSize: 13, opacity: 0.82 }}>{track.interviewPrompt}</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Entry Requirements</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {track.entryRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
                </ul>
                {entryFailure ? <div style={{ fontSize: 12, color: "#d98f8f" }}>Currently blocked: {entryFailure}</div> : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Specialties</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {track.specialties.map((specialty) => <li key={specialty}>{specialty}</li>)}
                </ul>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <strong>Track Status</strong>
                <div className="info-row">
                  <span className="info-row__label">Current Rank</span>
                  <span className="info-row__value">{progress ? `${currentRank.rank}. ${currentRank.title}` : "Not employed"}</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Job Points</span>
                  <span className="info-row__value">{progress?.jobPoints ?? 0}</span>
                </div>
                {nextRank ? (
                  <div className="info-row">
                    <span className="info-row__label">Next Rank</span>
                    <span className="info-row__value">
                      {nextRank.title} at {getRequiredPointsForRank(nextRank.rank)} points
                    </span>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <strong>Rank Ladder</strong>
                {track.ranks.map((rank) => (
                  <div
                    key={`${track.id}-${rank.rank}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 10,
                      background: "rgba(7, 13, 20, 0.55)",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{rank.rank}. {rank.title}</strong>
                      <span style={{ color: "#d1b777" }}>{rank.dailyGold} gold / shift</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#b7c3cf" }}>Requirement: {rank.requirementLabel}</div>
                    <div style={{ fontSize: 12, color: "#8ec8a7" }}>Shift Job Points: +{rank.dailyJobPoints}</div>
                    <div style={{ fontSize: 12, opacity: 0.82 }}>{rank.passiveSummary}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" disabled={!canJoin} onClick={() => joinTrack(track.id)}>
                  {isActive ? "Currently Employed" : anotherTrackActive ? "Another Track Active" : "Apply"}
                </button>
                {!canJoin && !isActive ? (
                  <div style={{ fontSize: 12, color: "#b7c3cf", alignSelf: "center" }}>
                    {anotherTrackActive ? "Resign your current civic job before joining a new one." : entryFailure ?? "Complete the requirements above."}
                  </div>
                ) : null}
              </div>
            </div>
          </ContentPanel>
        );
      })}
    </div>
  );
}
