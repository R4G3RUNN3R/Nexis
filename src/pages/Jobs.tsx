// ─────────────────────────────────────────────────────────────────────────────
// Nexis - Jobs Page
// XP model: one shared bar per category.
// Sub-job cards show stats + Attempt only - no per-job XP bar.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { usePlayer } from "../state/PlayerContext";
import {
  useJobs,
  computeSuccessRate,
  type JobOutcomeResult,
  type CategoryProgress,
} from "../state/JobsContext";
import { jobCategories, type JobCategory, type SubJob } from "../data/jobsData";
import "../styles/jobs.css";

type OutcomeEntry = {
  subJobId: string;
  result: JobOutcomeResult;
  timestamp: number;
};

function OutcomePanel({
  entry,
  onDismiss,
}: {
  entry: OutcomeEntry;
  onDismiss: () => void;
}) {
  const { result } = entry;

  const outcomeClass =
    result.outcome === "success"
      ? "jobs-outcome--success"
      : result.outcome === "fail"
      ? "jobs-outcome--fail"
      : "jobs-outcome--crit";

  const title =
    result.outcome === "success"
      ? "Success"
      : result.outcome === "fail"
      ? "Failed"
      : "Critical Fail";

  return (
    <div className={`jobs-outcome ${outcomeClass}`}>
      <div className="jobs-outcome__header">
        <span className="jobs-outcome__title">{title}</span>
        {result.outcome !== "success" && (
          <span className="jobs-outcome__flavor">{result.flavorText}</span>
        )}
        <button
          type="button"
          className="jobs-outcome__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          x
        </button>
      </div>

      <div className="jobs-outcome__body">
        {result.outcome === "success" && (
          <>
            <div className="jobs-outcome__row">
              <span className="jobs-outcome__row-label">Gold earned</span>
              <span className="jobs-outcome__row-value jobs-outcome__row-value--gold">
                +{result.goldEarned} gold
              </span>
            </div>
            <div className="jobs-outcome__row">
              <span className="jobs-outcome__row-label">XP earned</span>
              <span className="jobs-outcome__row-value jobs-outcome__row-value--xp">
                +{result.xpEarned} XP
              </span>
            </div>
            {result.chainCount > 1 && (
              <div className="jobs-outcome__row">
                <span className="jobs-outcome__row-label">Chain streak</span>
                <span className="jobs-outcome__row-value jobs-outcome__row-value--chain">
                  x{result.chainCount} - {Math.min(150, Math.round((1 + result.chainCount * 0.02) * 100))}% gold
                </span>
              </div>
            )}
            {result.itemsDropped.length > 0 && (
              <div
                className="jobs-outcome__row"
                style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
              >
                <span className="jobs-outcome__row-label">Items found</span>
                <div className="jobs-drops">
                  {result.itemsDropped.map((drop) => (
                    <span key={drop.itemId} className="jobs-drop-chip">
                      {drop.itemName} x{drop.qty}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {result.outcome === "fail" && result.xpEarned > 0 && (
          <div className="jobs-outcome__row">
            <span className="jobs-outcome__row-label">XP (partial)</span>
            <span className="jobs-outcome__row-value jobs-outcome__row-value--xp">
              +{result.xpEarned} XP
            </span>
          </div>
        )}

        {result.outcome === "criticalFail" && (
          <div className="jobs-outcome__row">
            <span className="jobs-outcome__row-label">Consequence</span>
            <span className="jobs-outcome__row-value jobs-outcome__row-value--danger">
              {result.consequence === "hospital"
                ? `Hospitalized for ${result.consequenceMinutes} min`
                : result.consequence === "jail"
                ? `Jailed for ${result.consequenceMinutes} min`
                : "None"}
            </span>
          </div>
        )}
      </div>

      {result.categoryLeveledUp && (
        <div className="jobs-levelup-banner">
          Category leveled up! Now level {result.categoryNewLevel}
        </div>
      )}
    </div>
  );
}

function CategoryXpBar({ progress }: { progress: CategoryProgress }) {
  const isMax = progress.level >= 100;
  const pct = isMax
    ? 100
    : Math.round((progress.xpCurrent / progress.xpToNextLevel) * 100);

  return (
    <div className="jobs-cat-xp">
      <div className="jobs-cat-xp__top">
        <span className="jobs-cat-xp__level">Level {progress.level}</span>
        <span className="jobs-cat-xp__numbers">
          {isMax ? "MAX" : `${progress.xpCurrent} / ${progress.xpToNextLevel} XP`}
        </span>
      </div>
      <div className="jobs-cat-xp__track">
        <div className="jobs-cat-xp__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="jobs-cat-xp__sub">
        {progress.totalSuccesses} successful jobs | {progress.totalAttempts} total attempts
      </div>
    </div>
  );
}

function SubJobCard({
  categoryId,
  subJob,
  categoryLevel,
  outcome,
  onAttempt,
  onDismissOutcome,
}: {
  categoryId: string;
  subJob: SubJob;
  categoryLevel: number;
  outcome: OutcomeEntry | null;
  onAttempt: (categoryId: string, subJobId: string) => void;
  onDismissOutcome: (subJobId: string) => void;
}) {
  const jobs = useJobs();
  const { player, isHospitalized, isJailed } = usePlayer();

  const sjStats = jobs.getSubJobStats(categoryId, subJob.id);

  const successRate = computeSuccessRate(
    subJob.baseFailChance,
    subJob.baseCritFailChance,
    categoryLevel,
  );

  const blocked =
    isHospitalized || isJailed || player.stats.stamina < subJob.staminaCost;

  const hasDrops = subJob.itemDrops.length > 0;
  const maxDropChance = hasDrops
    ? Math.round(Math.max(...subJob.itemDrops.map((d) => d.dropChance)) * 100)
    : 0;

  return (
    <div className={`jobs-subjob-card${outcome ? " jobs-subjob-card--attempting" : ""}`}>
      <div className="jobs-subjob-card__top">
        <div className="jobs-subjob-card__info">
          <div className="jobs-subjob-card__name">{subJob.name}</div>
          <div className="jobs-subjob-card__desc">{subJob.description}</div>
        </div>

        <div className="jobs-subjob-card__right">
          <button
            type="button"
            className="jobs-attempt-btn"
            disabled={blocked}
            onClick={() => onAttempt(categoryId, subJob.id)}
          >
            Attempt
          </button>
        </div>
      </div>

      <div className="jobs-subjob-card__stats">
        <span className="jobs-stat-chip jobs-stat-chip--stamina">
          <span className="jobs-stat-chip__label">Stamina:</span> {subJob.staminaCost}
        </span>
        <span className="jobs-stat-chip jobs-stat-chip--success">
          <span className="jobs-stat-chip__label">Success:</span> {successRate}%
        </span>
        <span className="jobs-stat-chip jobs-stat-chip--gold">
          <span className="jobs-stat-chip__label">Gold:</span> {subJob.baseGoldMin}-{subJob.baseGoldMax}
        </span>
        {hasDrops && (
          <span className="jobs-stat-chip jobs-stat-chip--drops">
            <span className="jobs-stat-chip__label">Drops:</span> up to {maxDropChance}%
          </span>
        )}
        {sjStats.chain > 1 && (
          <span className="jobs-stat-chip" style={{ color: "#ffd740" }}>
            Chain x{sjStats.chain}
          </span>
        )}
      </div>

      {outcome && (
        <OutcomePanel
          entry={outcome}
          onDismiss={() => onDismissOutcome(subJob.id)}
        />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  isActive,
  onClick,
}: {
  category: JobCategory;
  isActive: boolean;
  onClick: () => void;
}) {
  const jobs = useJobs();
  const progress = jobs.getCategoryProgress(category.id);

  return (
    <button
      type="button"
      className={`jobs-category-card${isActive ? " jobs-category-card--active" : ""}`}
      onClick={onClick}
    >
      <span className="jobs-category-card__icon">{category.icon}</span>
      <div className="jobs-category-card__body">
        <div className="jobs-category-card__name">{category.name}</div>
        <div className="jobs-category-card__theme">{category.theme}</div>
        <div className="jobs-category-card__meta">
          {category.subJobs.length} available | Lv. {progress.level}
        </div>
      </div>
      {category.isIllegal && (
        <span className="jobs-category-card__badge" title="Illegal activities">!</span>
      )}
    </button>
  );
}

export default function JobsPage() {
  const jobs = useJobs();
  const {
    player,
    isHospitalized,
    hospitalRemainingLabel,
    isJailed,
    jailRemainingLabel,
  } = usePlayer();

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    jobCategories[0]?.id ?? "",
  );
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeEntry>>({});
  const selectedCategory =
    jobCategories.find((c) => c.id === selectedCategoryId) ?? jobCategories[0];

  const categoryProgress = jobs.getCategoryProgress(selectedCategoryId);

  useEffect(() => {
    setOutcomes({});
  }, [selectedCategoryId]);

  const handleAttempt = useCallback(
    (categoryId: string, subJobId: string) => {
      const result = jobs.attemptJob(categoryId, subJobId);
      if (!result) return;

      const entry: OutcomeEntry = { subJobId, result, timestamp: Date.now() };
      setOutcomes({ [subJobId]: entry });
    },
    [jobs],
  );

  const handleDismissOutcome = useCallback((subJobId: string) => {
    setOutcomes((prev) => {
      const next = { ...prev };
      delete next[subJobId];
      return next;
    });
  }, []);

  return (
    <AppShell
      title="Adventure"
      hint="Contracts, expeditions, and active field work. Civic employment now lives in Civic Jobs."
    >
      <div className="jobs-page">
        {isHospitalized && (
          <div className="jobs-status-banner">
            <span className="jobs-status-banner__icon">H</span>
            <div className="jobs-status-banner__info">
              <div className="jobs-status-banner__title">You are hospitalized</div>
              <div className="jobs-status-banner__timer">
                Back in {hospitalRemainingLabel}
              </div>
            </div>
          </div>
        )}
        {isJailed && (
          <div className="jobs-status-banner jobs-status-banner--jail">
            <span className="jobs-status-banner__icon">J</span>
            <div className="jobs-status-banner__info">
              <div className="jobs-status-banner__title">You are in jail</div>
              <div className="jobs-status-banner__timer">
                Released in {jailRemainingLabel}
              </div>
            </div>
          </div>
        )}
        {player.stats.stamina < 3 && !isHospitalized && !isJailed && (
          <div className="jobs-low-stamina">
            Low stamina - jobs cost stamina. It restores over time.
          </div>
        )}

        <div className="jobs-body">
          <div className="jobs-categories">
            {jobCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                isActive={cat.id === selectedCategoryId}
                onClick={() => setSelectedCategoryId(cat.id)}
              />
            ))}
          </div>

          <div className="jobs-main">
            {selectedCategory && (
              <>
                <div className="jobs-category-header">
                  <div className="jobs-category-header__top">
                    <span className="jobs-category-header__icon">
                      {selectedCategory.icon}
                    </span>
                    <div className="jobs-category-header__info">
                      <div className="jobs-category-header__name">
                        {selectedCategory.name}
                      </div>
                      <div className="jobs-category-header__desc">
                        {selectedCategory.description}
                      </div>
                    </div>
                    {selectedCategory.isIllegal && (
                      <span className="jobs-category-header__illegal-tag">Illegal</span>
                    )}
                  </div>

                  <CategoryXpBar progress={categoryProgress} />
                </div>

                <div className="jobs-list">
                  {selectedCategory.subJobs.map((subJob) => (
                    <SubJobCard
                      key={subJob.id}
                      categoryId={selectedCategory.id}
                      subJob={subJob}
                      categoryLevel={categoryProgress.level}
                      outcome={outcomes[subJob.id] ?? null}
                      onAttempt={handleAttempt}
                      onDismissOutcome={handleDismissOutcome}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
