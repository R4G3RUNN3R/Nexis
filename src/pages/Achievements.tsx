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

function isAchieved(achievement: DisplayAchievement) {
  return achievement.completed || achievement.progress >= achievement.target;
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
      <small className="legacy-progress__meta">
        {progress.toLocaleString()} / {target.toLocaleString()}
        <span className="legacy-progress__pct">{pct}%</span>
      </small>
    </div>
  );
}

function RankPips({ rank, maxRank }: { rank: number; maxRank: number }) {
  return (
    <span className="legacy-pips" aria-label={`Rank ${rank} of ${maxRank}`}>
      {Array.from({ length: maxRank }).map((_, index) => (
        <span
          key={index}
          className={`legacy-pips__pip${index < rank ? " legacy-pips__pip--filled" : ""}`}
        />
      ))}
    </span>
  );
}

type PerkAffordState = "maxed" | "affordable" | "locked";

function getPerkAffordState(
  rank: number,
  maxRank: number,
  availablePoints: number,
): PerkAffordState {
  if (rank >= maxRank) return "maxed";
  return availablePoints >= getLegacyRankCost(rank + 1) ? "affordable" : "locked";
}

function MeritCard({
  perk,
  rank,
  isSelected,
  affordState,
  onSelect,
}: {
  perk: LegacyPerk;
  rank: number;
  isSelected: boolean;
  affordState: PerkAffordState;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`merit-card merit-card--${affordState}${isSelected ? " merit-card--active" : ""}`}
      onClick={onSelect}
      title={`${perk.name} — ${perk.effectSummary}`}
    >
      <span className="merit-card__icon">{perk.icon}</span>
      <span className="merit-card__body">
        <span className="merit-card__top">
          <span className="merit-card__name">{perk.name}</span>
          <span className="merit-card__rank">
            {affordState === "maxed" ? "MAX" : `${rank}/${perk.maxRank}`}
          </span>
        </span>
        <span className="merit-card__effect">{perk.effectSummary}</span>
        <RankPips rank={rank} maxRank={perk.maxRank} />
      </span>
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
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
      const matchesVisibility = hideCompleted ? !isAchieved(achievement) : true;
      return matchesKind && matchesCategory && matchesVisibility;
    });
  }, [achievementRows, selectedAchievementCategory, selectedAchievementKind, hideCompleted]);

  const groupedAchievements = useMemo(() => {
    const groups = new Map<string, DisplayAchievement[]>();
    for (const achievement of filteredAchievements) {
      const bucket = groups.get(achievement.category);
      if (bucket) {
        bucket.push(achievement);
      } else {
        groups.set(achievement.category, [achievement]);
      }
    }
    const ordered: Array<{ category: string; rows: DisplayAchievement[] }> = [];
    for (const category of categoryRows) {
      const rows = groups.get(category);
      if (rows) {
        ordered.push({ category, rows });
        groups.delete(category);
      }
    }
    for (const [category, rows] of groups) {
      ordered.push({ category, rows });
    }
    return ordered;
  }, [filteredAchievements, categoryRows]);

  const categoryStats = useMemo(() => {
    const stats = new Map<string, { total: number; achieved: number }>();
    for (const achievement of achievementRows) {
      if (
        selectedAchievementKind !== "All" &&
        (achievement.kind ?? "honor") !== selectedAchievementKind
      ) {
        continue;
      }
      const entry = stats.get(achievement.category) ?? { total: 0, achieved: 0 };
      entry.total += 1;
      if (isAchieved(achievement)) entry.achieved += 1;
      stats.set(achievement.category, entry);
    }
    return stats;
  }, [achievementRows, selectedAchievementKind]);

  const fallbackEarned = achievementRows
    .filter(isAchieved)
    .reduce((sum, achievement) => sum + achievement.rewardPoints, 0);
  const fallbackSpent = Object.entries(perkRanks).reduce((sum, [, rank]) => {
    let local = 0;
    for (let i = 1; i <= rank; i += 1) local += i;
    return sum + local;
  }, 0);
  const totalPointsEarned = legacyPoints?.totalEarned ?? fallbackEarned;
  const totalPointsSpent = legacyPoints?.totalSpent ?? fallbackSpent;
  const totalPointsAvailable = legacyPoints?.available ?? Math.max(0, fallbackEarned - fallbackSpent);
  const completedRows = achievementRows.filter(isAchieved);
  const completedAchievementCount = completedRows.length;
  const completedHonorCount = completedRows.filter((achievement) => (achievement.kind ?? "honor") === "honor").length;
  const completedMedalCount = completedRows.filter((achievement) => achievement.kind === "medal").length;

  const groupedPerks = useMemo(() => {
    return legacyPerkCategories
      .filter((category) => selectedLegacyCategory === "All" || category === selectedLegacyCategory)
      .map((category) => ({
        category,
        perks: legacyPerks.filter((perk) => perk.category === category),
      }))
      .filter((group) => group.perks.length > 0);
  }, [selectedLegacyCategory]);

  const selectedPerk =
    legacyPerks.find((perk) => perk.id === selectedPerkId) ?? legacyPerks[0];

  const selectedPerkRank = selectedPerk ? perkRanks[selectedPerk.id] ?? 0 : 0;
  const selectedPerkMaxed = selectedPerk ? selectedPerkRank >= selectedPerk.maxRank : false;
  const nextRank = selectedPerk ? Math.min(selectedPerk.maxRank, selectedPerkRank + 1) : 0;
  const nextRankCost = selectedPerk ? getLegacyRankCost(nextRank) : 0;
  const canSpend =
    Boolean(serverSessionToken) &&
    !legacyLoading &&
    !spendingPerkId &&
    selectedPerkRank < (selectedPerk?.maxRank ?? 0) &&
    totalPointsAvailable >= nextRankCost;

  function toggleCategory(category: string) {
    setCollapsedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

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

  let spendStatus: { tone: "ok" | "warn" | "muted"; text: string };
  if (!serverSessionToken) {
    spendStatus = { tone: "warn", text: "Log in to spend server-tracked Legacy Points." };
  } else if (selectedPerkMaxed) {
    spendStatus = { tone: "muted", text: "All ranks secured. This Legacy is maxed out." };
  } else if (totalPointsAvailable < nextRankCost) {
    spendStatus = {
      tone: "warn",
      text: `Need ${nextRankCost} LP for rank ${nextRank} — you have ${totalPointsAvailable}.`,
    };
  } else {
    spendStatus = { tone: "ok", text: "Affordable. Spending is permanent." };
  }

  return (
    <AppShell
      title="Achievements & Legacy"
      hint="Achievements grant server-tracked Legacy Points. Legacy ranks cost 1 point for rank 1, 2 for rank 2, and so on."
    >
      {legacyLoading || legacyError ? (
        <div className={`legacy-banner${legacyError ? "" : " legacy-banner--ok"}`}>
          {legacyError ?? "Syncing Legacy state..."}
        </div>
      ) : null}

      <div className="legacy-main-grid">
        <div className="legacy-column">
          <ContentPanel title="Achievements Tracker">
            <div className="legacy-summary-strip">
              <span className="legacy-summary-item">
                <span className="legacy-summary-item__label">Available</span>
                <strong className={totalPointsAvailable > 0 ? "legacy-green" : totalPointsAvailable < 0 ? "legacy-red" : ""}>
                  {totalPointsAvailable > 0 ? `+${totalPointsAvailable}` : totalPointsAvailable} LP
                </strong>
              </span>
              <span className="legacy-summary-item">
                <span className="legacy-summary-item__label">Spent</span>
                <strong>{totalPointsSpent}</strong>
              </span>
              <span className="legacy-summary-item">
                <span className="legacy-summary-item__label">Earned</span>
                <strong>{totalPointsEarned}</strong>
              </span>
              <span className="legacy-summary-item">
                <span className="legacy-summary-item__label">Entries</span>
                <strong>
                  {completedAchievementCount}
                  <small> / {achievementRows.length}</small>
                </strong>
              </span>
              <span className="legacy-summary-item">
                <span className="legacy-summary-item__label">Honors / Medals</span>
                <strong>
                  {completedHonorCount} / {completedMedalCount}
                </strong>
              </span>
            </div>

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

              <select
                className="legacy-category-select"
                aria-label="Achievement category filter"
                value={selectedAchievementCategory}
                onChange={(event) => setSelectedAchievementCategory(event.target.value)}
              >
                <option value="All">All categories</option>
                {categoryRows.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="legacy-checkbox">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(event) => setHideCompleted(event.target.checked)}
                />
                Hide achieved
              </label>
            </div>

            <div className="legacy-achievements-list">
              {groupedAchievements.map(({ category, rows }) => {
                const stats = categoryStats.get(category);
                const collapsed = collapsedCategories.has(category);
                return (
                  <div key={category} className="legacy-section">
                    <button
                      type="button"
                      className="legacy-section__header"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={!collapsed}
                    >
                      <span className={`legacy-section__chevron${collapsed ? " legacy-section__chevron--closed" : ""}`} />
                      <span className="legacy-section__name">{category}</span>
                      <span className="legacy-section__count">
                        {stats ? `${stats.achieved}/${stats.total} achieved` : `${rows.length}`}
                      </span>
                    </button>

                    {!collapsed
                      ? rows.map((achievement) => {
                          const completed = isAchieved(achievement);
                          return (
                            <div
                              key={achievement.id}
                              className={`legacy-achievement-row${completed ? " legacy-achievement-row--complete" : ""}`}
                            >
                              <span
                                className={`legacy-achievement-kind${achievement.kind === "medal" ? " legacy-achievement-kind--medal" : ""}`}
                              >
                                {kindLabel(achievement.kind)}
                              </span>
                              <span className="legacy-achievement-entry">
                                <strong className="legacy-achievement-name">{achievement.name}</strong>
                                <small>{achievement.description}</small>
                              </span>
                              <AchievementProgress
                                progress={achievement.progress}
                                target={achievement.target}
                              />
                              <span
                                className={`legacy-achievement-reward${completed ? " legacy-achievement-reward--earned" : ""}`}
                                title={`Reward: ${achievement.rewardPoints} Legacy Point${achievement.rewardPoints === 1 ? "" : "s"}`}
                              >
                                {completed ? "✓ " : ""}+{achievement.rewardPoints} LP
                              </span>
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })}
              {!filteredAchievements.length ? (
                <div className="legacy-empty-row">No matching Honors or Medals.</div>
              ) : null}
            </div>
          </ContentPanel>
        </div>

        <div className="legacy-column">
          <ContentPanel title="Legacy Tree">
            <div className="legacy-filter-group">
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

            {selectedPerk ? (
              <div className="legacy-detail">
                <div className="legacy-detail__head">
                  <span className="legacy-detail__icon">{selectedPerk.icon}</span>
                  <span className="legacy-detail__title">
                    <h3>{selectedPerk.name}</h3>
                    <span className="legacy-detail__category">{selectedPerk.category}</span>
                  </span>
                  <span className="legacy-detail__rank">
                    <strong>
                      {selectedPerkRank}
                      <small>/{selectedPerk.maxRank}</small>
                    </strong>
                    <span>rank</span>
                  </span>
                </div>

                <p className="legacy-detail__effect">
                  <strong>{selectedPerk.effectSummary || `${getPerkEffectText(selectedPerk.baseEffect, selectedPerk.effectUnit, 1)} per rank.`}</strong>{" "}
                  {selectedPerk.description}
                </p>

                <div className="legacy-detail__spend">
                  <RankPips rank={selectedPerkRank} maxRank={selectedPerk.maxRank} />
                  <span className="legacy-detail__cost">
                    {selectedPerkMaxed ? (
                      <>All {selectedPerk.maxRank} ranks secured</>
                    ) : (
                      <>
                        Rank {nextRank} costs <b>{nextRankCost} LP</b> · you have <b>{totalPointsAvailable} LP</b>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className="legacy-spend-button"
                    disabled={!canSpend}
                    onClick={handleSpendSelectedPerk}
                  >
                    {spendingPerkId === selectedPerk.id ? "Spending..." : "Spend Point"}
                  </button>
                </div>

                <div className={`legacy-detail__status legacy-detail__status--${spendStatus.tone}`}>
                  {spendStatus.text}
                </div>
              </div>
            ) : null}

            <div className="legacy-tree-scroll">
              {groupedPerks.map(({ category, perks }) => {
                const spentRanks = perks.reduce((sum, perk) => sum + (perkRanks[perk.id] ?? 0), 0);
                const maxRanks = perks.reduce((sum, perk) => sum + perk.maxRank, 0);
                return (
                  <div key={category} className="legacy-tree-section">
                    <div className="legacy-tree-section__header">
                      <span className="legacy-tree-section__name">{category}</span>
                      <span className="legacy-tree-section__meta">
                        {spentRanks}/{maxRanks} ranks
                      </span>
                    </div>
                    <div className="legacy-merit-grid">
                      {perks.map((perk) => (
                        <MeritCard
                          key={perk.id}
                          perk={perk}
                          rank={perkRanks[perk.id] ?? 0}
                          isSelected={selectedPerk?.id === perk.id}
                          affordState={getPerkAffordState(
                            perkRanks[perk.id] ?? 0,
                            perk.maxRank,
                            totalPointsAvailable,
                          )}
                          onSelect={() => setSelectedPerkId(perk.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="legacy-permanent-note">
              Spending is permanent. Rank 1 costs 1 point, rank 2 costs 2 more, and the costs keep climbing.
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
