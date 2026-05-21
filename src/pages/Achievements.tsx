import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { achievements, achievementCategories } from "../data/achievementsData";
import {
  legacyPerks,
  legacyPerkCategories,
  getLegacyRankCost,
  getPerkEffectText,
  type LegacyPerk,
  type LegacyPerkCategory,
} from "../data/legacyPerksData";
import {
  getLegacyAchievements,
  spendLegacyPerkRank,
  type ApiLegacyAchievementsResponse,
  type ServerLegacyAchievement,
} from "../lib/authApi";
import { writeCachedRuntimeState } from "../lib/runtimeStateCache";
import { useAuth } from "../state/AuthContext";

type LegacyPoints = {
  totalEarned: number;
  totalSpent: number;
  available: number;
};

type AchievementKind = "All" | "honor" | "medal";

type DisplayAchievement = ServerLegacyAchievement & {
  completedOn?: string;
  kind?: string;
};

function kindLabel(kind: string | undefined) {
  return kind === "medal" ? "Medal" : "Honor";
}

function normalizeFallbackAchievements(): DisplayAchievement[] {
  return achievements.map((achievement) => ({
    ...achievement,
    kind: achievement.kind ?? "honor",
    completed: achievement.progress >= achievement.target,
  }));
}

function AchievementProgress({
  progress,
  target,
}: {
  progress: number;
  target: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
  return (
    <div className="legacy-progress">
      <div className="legacy-progress__bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="legacy-progress__text">{pct}%</span>
    </div>
  );
}

function LegacyRankRing({
  rank,
  maxRank,
}: {
  rank: number;
  maxRank: number;
}) {
  return (
    <div className="legacy-ring">
      <div className="legacy-ring__bars">
        {Array.from({ length: maxRank }).map((_, index) => {
          const filled = index < rank;
          return (
            <span
              key={index}
              className={`legacy-ring__bar${filled ? " legacy-ring__bar--filled" : ""}`}
              style={{ transform: `rotate(${index * (360 / maxRank)}deg) translateY(-46px)` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function MeritCard({
  perk,
  rank,
  isSelected,
  onSelect,
}: {
  perk: LegacyPerk;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`merit-card${isSelected ? " merit-card--active" : ""}`}
      onClick={onSelect}
    >
      <div className="merit-card__icon-wrap">
        <LegacyRankRing rank={rank} maxRank={perk.maxRank} />
        <div className="merit-card__icon">{perk.icon}</div>
      </div>

      <div className="merit-card__content">
        <div className="merit-card__header">
          <span className="merit-card__name">{perk.name}</span>
          <span className="merit-card__rank">
            {rank}/{perk.maxRank}
          </span>
        </div>
        <div className="merit-card__description">
          {perk.effectSummary || `${perk.description} by ${getPerkEffectText(perk.baseEffect, perk.effectUnit, 1)} per rank.`}
        </div>
      </div>
    </button>
  );
}

export default function AchievementsPage() {
  const { activeAccount, serverHydrationVersion, serverSessionToken } = useAuth();
  const [selectedAchievementKind, setSelectedAchievementKind] = useState<AchievementKind>("All");
  const [selectedAchievementCategory, setSelectedAchievementCategory] =
    useState<string | "All">("All");
  const [selectedLegacyCategory, setSelectedLegacyCategory] =
    useState<LegacyPerkCategory | "All">("All");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [achievementRows, setAchievementRows] = useState<DisplayAchievement[]>(normalizeFallbackAchievements);
  const [categoryRows, setCategoryRows] = useState<string[]>(achievementCategories);
  const [kindRows, setKindRows] = useState<Array<"honor" | "medal">>(["honor", "medal"]);
  const [legacyPoints, setLegacyPoints] = useState<LegacyPoints | null>(null);
  const [perkRanks, setPerkRanks] = useState<Record<string, number>>({});
  const [selectedPerkId, setSelectedPerkId] = useState<string>(legacyPerks[0]?.id ?? "");
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [spendingPerkId, setSpendingPerkId] = useState<string | null>(null);

  const applyLegacyPayload = useCallback(
    (result: Extract<ApiLegacyAchievementsResponse, { ok: true }>) => {
      setAchievementRows(result.achievements.map((achievement) => ({ ...achievement, kind: achievement.kind ?? "honor" })));
      setCategoryRows(result.achievementCategories.length ? result.achievementCategories : achievementCategories);
      setKindRows(result.achievementKinds?.length ? result.achievementKinds.filter((kind): kind is "honor" | "medal" => kind === "honor" || kind === "medal") : ["honor", "medal"]);
      setLegacyPoints(result.legacyPoints);
      setPerkRanks(result.perkRanks);
      setLegacyError(null);
      if (activeAccount) {
        writeCachedRuntimeState(activeAccount.email, { legacy: result.legacy });
      }
    },
    [activeAccount],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLegacyState() {
      if (!serverSessionToken) {
        setAchievementRows(normalizeFallbackAchievements());
        setCategoryRows(achievementCategories);
        setKindRows(["honor", "medal"]);
        setLegacyPoints(null);
        setPerkRanks({});
        setLegacyError("Log in to sync Legacy Points with the server.");
        return;
      }

      setLegacyLoading(true);
      const result = await getLegacyAchievements(serverSessionToken);
      if (cancelled) return;
      setLegacyLoading(false);

      if (result.ok) {
        applyLegacyPayload(result);
        return;
      }

      setLegacyError(result.error);
    }

    void loadLegacyState();
    return () => {
      cancelled = true;
    };
  }, [applyLegacyPayload, serverHydrationVersion, serverSessionToken]);

  const filteredAchievements = useMemo(() => {
    return achievementRows.filter((achievement) => {
      const matchesKind = selectedAchievementKind === "All" || (achievement.kind ?? "honor") === selectedAchievementKind;
      const matchesCategory =
        selectedAchievementCategory === "All" ||
        achievement.category === selectedAchievementCategory;
      const completed = achievement.completed || achievement.progress >= achievement.target;
      const matchesVisibility = hideCompleted ? !completed : true;
      return matchesKind && matchesCategory && matchesVisibility;
    });
  }, [achievementRows, selectedAchievementCategory, selectedAchievementKind, hideCompleted]);

  const filteredPerks = useMemo(() => {
    return legacyPerks.filter((perk) => {
      return selectedLegacyCategory === "All" || perk.category === selectedLegacyCategory;
    });
  }, [selectedLegacyCategory]);

  const fallbackEarned = achievementRows
    .filter((achievement) => achievement.completed || achievement.progress >= achievement.target)
    .reduce((sum, achievement) => sum + achievement.rewardPoints, 0);
  const fallbackSpent = Object.entries(perkRanks).reduce((sum, [, rank]) => {
    let local = 0;
    for (let i = 1; i <= rank; i += 1) local += i;
    return sum + local;
  }, 0);
  const totalPointsEarned = legacyPoints?.totalEarned ?? fallbackEarned;
  const totalPointsSpent = legacyPoints?.totalSpent ?? fallbackSpent;
  const totalPointsAvailable = legacyPoints?.available ?? Math.max(0, fallbackEarned - fallbackSpent);
  const completedRows = achievementRows.filter(
    (achievement) => achievement.completed || achievement.progress >= achievement.target,
  );
  const completedAchievementCount = completedRows.length;
  const completedHonorCount = completedRows.filter((achievement) => (achievement.kind ?? "honor") === "honor").length;
  const completedMedalCount = completedRows.filter((achievement) => achievement.kind === "medal").length;

  const selectedPerk =
    filteredPerks.find((perk) => perk.id === selectedPerkId) ??
    legacyPerks.find((perk) => perk.id === selectedPerkId) ??
    filteredPerks[0] ??
    legacyPerks[0];

  const selectedPerkRank = selectedPerk ? perkRanks[selectedPerk.id] ?? 0 : 0;
  const nextRank = selectedPerk ? Math.min(selectedPerk.maxRank, selectedPerkRank + 1) : 0;
  const nextRankCost = selectedPerk ? getLegacyRankCost(nextRank) : 0;
  const canSpend =
    Boolean(serverSessionToken) &&
    !legacyLoading &&
    !spendingPerkId &&
    selectedPerkRank < (selectedPerk?.maxRank ?? 0) &&
    totalPointsAvailable >= nextRankCost;

  async function handleSpendSelectedPerk() {
    if (!serverSessionToken || !selectedPerk || !canSpend) return;
    setSpendingPerkId(selectedPerk.id);
    const result = await spendLegacyPerkRank(serverSessionToken, selectedPerk.id);
    setSpendingPerkId(null);

    if (result.ok) {
      applyLegacyPayload(result);
      return;
    }

    setLegacyError(result.error);
  }

  return (
    <AppShell
      title="Achievements & Legacy"
      hint="Achievements grant server-tracked Legacy Points. Legacy ranks cost 1 point for rank 1, 2 for rank 2, and so on."
    >
      <div className="legacy-summary-grid">
        <div className="legacy-summary-card">
          <span className="legacy-summary-card__label">Available Legacy Points</span>
          <strong className={totalPointsAvailable >= 0 ? "legacy-green" : "legacy-red"}>
            {totalPointsAvailable >= 0 ? `+${totalPointsAvailable}` : totalPointsAvailable}
          </strong>
        </div>
        <div className="legacy-summary-card">
          <span className="legacy-summary-card__label">Legacy Points Spent</span>
          <strong>{totalPointsSpent}</strong>
        </div>
        <div className="legacy-summary-card">
          <span className="legacy-summary-card__label">Legacy Points Earned</span>
          <strong>{totalPointsEarned}</strong>
        </div>
        <div className="legacy-summary-card">
          <span className="legacy-summary-card__label">Entries Completed</span>
          <strong>{completedAchievementCount}</strong>
        </div>
        <div className="legacy-summary-card">
          <span className="legacy-summary-card__label">Honors / Medals</span>
          <strong>{completedHonorCount} / {completedMedalCount}</strong>
        </div>
      </div>

      {legacyLoading || legacyError ? (
        <div className={`legacy-selected-panel__warning${legacyError ? "" : " legacy-selected-panel__warning--ok"}`}>
          {legacyError ?? "Syncing Legacy state..."}
        </div>
      ) : null}

      <div className="legacy-main-grid">
        <div className="legacy-column">
          <ContentPanel title="Achievements Tracker">
            <div className="legacy-toolbar">
              <div className="legacy-kind-filter" aria-label="Achievement type filter">
                <button
                  type="button"
                  className={`legacy-kind-pill${selectedAchievementKind === "All" ? " legacy-kind-pill--active" : ""}`}
                  onClick={() => setSelectedAchievementKind("All")}
                >
                  All
                </button>
                {kindRows.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`legacy-kind-pill${selectedAchievementKind === kind ? " legacy-kind-pill--active" : ""}`}
                    onClick={() => setSelectedAchievementKind(kind)}
                  >
                    {kindLabel(kind)}
                  </button>
                ))}
              </div>
              <div className="legacy-filter-group">
                <button
                  type="button"
                  className={`legacy-chip${selectedAchievementCategory === "All" ? " legacy-chip--active" : ""}`}
                  onClick={() => setSelectedAchievementCategory("All")}
                >
                  All
                </button>
                {categoryRows.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`legacy-chip${selectedAchievementCategory === category ? " legacy-chip--active" : ""}`}
                    onClick={() => setSelectedAchievementCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <label className="legacy-checkbox">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(event) => setHideCompleted(event.target.checked)}
                />
                Hide achieved awards
              </label>
            </div>

            <div className="legacy-achievements-table">
              <div className="legacy-achievements-header">
                <span>Type</span>
                <span>Category</span>
                <span>Entry</span>
                <span>Progress</span>
                <span>Reward</span>
              </div>

              {filteredAchievements.map((achievement) => {
                const completed = achievement.completed || achievement.progress >= achievement.target;
                return (
                  <div
                    key={achievement.id}
                    className={`legacy-achievement-row${completed ? " legacy-achievement-row--complete" : ""}`}
                  >
                    <span className="legacy-achievement-kind">{kindLabel(achievement.kind)}</span>
                    <span>{achievement.category}</span>
                    <span>
                      <strong className="legacy-achievement-name">{achievement.name}</strong>
                      <small>{achievement.description}</small>
                    </span>
                    <span>
                      <AchievementProgress
                        progress={achievement.progress}
                        target={achievement.target}
                      />
                      <small>
                        {achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}
                      </small>
                    </span>
                    <span>
                      {achievement.rewardPoints} LP
                    </span>
                  </div>
                );
              })}
              {!filteredAchievements.length ? <div className="legacy-empty-row">No matching Honors or Medals.</div> : null}
            </div>
          </ContentPanel>
        </div>

        <div className="legacy-column">
          <ContentPanel title="Legacy Tree">
            <div className="legacy-permanent-note">Spending is permanent. Rank 1 costs 1 point, rank 2 costs 2 more, and the costs keep climbing.</div>
            <div className="legacy-filter-group legacy-filter-group--spaced">
              <button
                type="button"
                className={`legacy-chip${selectedLegacyCategory === "All" ? " legacy-chip--active" : ""}`}
                onClick={() => setSelectedLegacyCategory("All")}
              >
                All
              </button>
              {legacyPerkCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`legacy-chip${selectedLegacyCategory === category ? " legacy-chip--active" : ""}`}
                  onClick={() => setSelectedLegacyCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="legacy-merit-grid">
              {filteredPerks.map((perk) => (
                <MeritCard
                  key={perk.id}
                  perk={perk}
                  rank={perkRanks[perk.id] ?? 0}
                  isSelected={selectedPerk?.id === perk.id}
                  onSelect={() => setSelectedPerkId(perk.id)}
                />
              ))}
            </div>

            {selectedPerk ? (
              <div className="legacy-selected-panel">
                <div className="legacy-selected-panel__text">
                  {selectedPerk.effectSummary || `This upgrade will ${selectedPerk.description.toLowerCase()} by ${getPerkEffectText(selectedPerk.baseEffect, selectedPerk.effectUnit, 1)} per rank.`}<br />
                  Current rank is {selectedPerkRank}/{selectedPerk.maxRank}. The next upgrade will cost{" "}
                  {nextRankCost} Legacy Point{nextRankCost === 1 ? "" : "s"}.
                </div>

                {!serverSessionToken ? (
                  <div className="legacy-selected-panel__warning">
                    Log in to spend server-tracked Legacy Points.
                  </div>
                ) : selectedPerkRank >= selectedPerk.maxRank ? (
                  <div className="legacy-selected-panel__warning legacy-selected-panel__warning--ok">
                    This Legacy rank is already maxed out.
                  </div>
                ) : totalPointsAvailable < nextRankCost ? (
                  <div className="legacy-selected-panel__warning">
                    You need {nextRankCost} available Legacy Point{nextRankCost === 1 ? "" : "s"} for this {selectedPerk.name} rank.
                  </div>
                ) : (
                  <div className="legacy-selected-panel__warning legacy-selected-panel__warning--ok">
                    You can afford this permanent rank.
                  </div>
                )}

                <div className="legacy-selected-panel__actions">
                  <button
                    type="button"
                    className="legacy-spend-button"
                    disabled={!canSpend}
                    onClick={handleSpendSelectedPerk}
                  >
                    {spendingPerkId === selectedPerk.id ? "Spending..." : "Spend Point"}
                  </button>
                </div>
              </div>
            ) : null}
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
