// ─────────────────────────────────────────────────────────────────────────────
// Nexis - Jobs Page
// XP model: one shared bar per category.
// Sub-job cards show stats + Attempt only - no per-job XP bar.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ITEM_CATALOGUE } from "../data/itemsData";
import { ItemIcon } from "../components/items/ItemIcon";
import { getServerAdventureBoard, startServerAdventure, type ServerAdventureBoard, type ServerAdventureEntry } from "../lib/authApi";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
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

const ITEM_ACQUISITION_PATHS: Record<string, Array<{ label: string; to: string; detail: string }>> = {
  herbalist_gloves: [{ label: "Market", to: "/market", detail: "starter field tools" }],
  wood_axe: [{ label: "Market", to: "/market", detail: "tool vendors" }],
  miners_pick: [{ label: "Market", to: "/market", detail: "mining tools" }],
  hunters_bow: [{ label: "Market", to: "/market", detail: "hunting gear" }],
  lantern: [{ label: "Market", to: "/market", detail: "travel and ruins gear" }],
  rope: [{ label: "Market", to: "/market", detail: "common travel stock" }],
  lockpick_set: [{ label: "Market", to: "/market", detail: "restricted tool stock where available" }],
};

function getAcquisitionPaths(itemId: string) {
  return ITEM_ACQUISITION_PATHS[itemId] ?? [{ label: "Market", to: "/market", detail: "check legal city stock first" }];
}

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
  const { player } = usePlayer();

  const sjStats = jobs.getSubJobStats(categoryId, subJob.id);
  const attemptStatus = jobs.canAttemptJob(categoryId, subJob.id);

  const successRate = computeSuccessRate(
    subJob.baseFailChance,
    subJob.baseCritFailChance,
    categoryLevel,
  );

  const blocked = !attemptStatus.allowed;

  const hasDrops = subJob.itemDrops.length > 0;
  const maxDropChance = hasDrops
    ? Math.round(Math.max(...subJob.itemDrops.map((d) => d.dropChance)) * 100)
    : 0;
  const requiredItems = subJob.requiredItems ?? [];
  const criticalRisk = Math.round(subJob.baseCritFailChance * 100);

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
        {requiredItems.length > 0 && (
          <span className="jobs-stat-chip jobs-stat-chip--drops">
            <span className="jobs-stat-chip__label">Required:</span> {requiredItems.length} item{requiredItems.length === 1 ? "" : "s"}
          </span>
        )}
        <span
          className="jobs-stat-chip jobs-stat-chip--danger"
          title="Critical failures can send you to hospital or jail depending on the job."
        >
          <span className="jobs-stat-chip__label">Critical Risk:</span> {criticalRisk}%
        </span>
        {sjStats.chain > 1 && (
          <span className="jobs-stat-chip" style={{ color: "#ffd740" }}>
            Chain x{sjStats.chain}
          </span>
        )}
      </div>

      {requiredItems.length > 0 && (
        <div className="jobs-subjob-card__stats">
          {requiredItems.map((requirement) => {
            const owned = Number(player.inventory?.[requirement.itemId] ?? 0);
            const itemName = ITEM_CATALOGUE[requirement.itemId]?.name ?? requirement.itemId;
            const missing = owned < requirement.quantity;
            return (
              <span
                key={`${subJob.id}-${requirement.itemId}`}
                className="jobs-stat-chip"
                style={{ color: missing ? "#ff8d8d" : "#7ed6dd" }}
              >
                <span className="jobs-stat-chip__label">Need:</span> {itemName} {owned} / {requirement.quantity}
              </span>
            );
          })}
        </div>
      )}

      {attemptStatus.missingItems.length > 0 ? (
        <div className="jobs-low-stamina" style={{ marginTop: 8 }}>
          <strong>Missing supplies:</strong>{" "}
          {attemptStatus.missingItems.map((missingItem) => (
            <span key={`${subJob.id}-path-${missingItem.itemId}`} style={{ display: "block", marginTop: 4 }}>
              {missingItem.itemName}: {getAcquisitionPaths(missingItem.itemId).map((path, index) => (
                <span key={`${missingItem.itemId}-${path.to}-${path.label}`}>
                  {index > 0 ? " or " : ""}
                  <Link to={path.to}>{path.label}</Link> <span>({path.detail})</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      ) : null}

      {blocked && attemptStatus.reason ? (
        <div className="jobs-low-stamina" style={{ marginTop: 12 }}>
          {attemptStatus.reason}
        </div>
      ) : null}

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


function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(recordOf) : [];
}

function AdventureResultPanel({ result, onDismiss }: { result: Record<string, unknown> | null; onDismiss: () => void }) {
  if (!result) return null;
  const combat = recordOf(result.combat);
  const reward = recordOf(result.reward);
  const log = arrayOfRecords(combat.log).slice(0, 5);
  return (
    <div className="jobs-outcome jobs-outcome--success adventure-result">
      <div className="jobs-outcome__header">
        <span className="jobs-outcome__title">Adventure Result</span>
        <span className="jobs-outcome__flavor">{String(result.message ?? combat.outcome ?? "Resolved")}</span>
        <button type="button" className="jobs-outcome__dismiss" onClick={onDismiss} aria-label="Dismiss">x</button>
      </div>
      <div className="jobs-outcome__body">
        <div className="jobs-outcome__row"><span className="jobs-outcome__row-label">Outcome</span><span className="jobs-outcome__row-value">{String(combat.outcome ?? "unknown")}</span></div>
        <div className="jobs-outcome__row"><span className="jobs-outcome__row-label">Energy / XP</span><span className="jobs-outcome__row-value">-{String(combat.energySpent ?? 0)} energy | +{String(combat.combatXpGained ?? 0)} combat XP | +{String(combat.skillXpGained ?? 0)} skill XP</span></div>
        {Array.isArray(reward.items) ? <div className="jobs-outcome__row"><span className="jobs-outcome__row-label">Rewards</span><span className="jobs-outcome__row-value">{reward.items.length} item bundle(s)</span></div> : null}
        {log.length ? <div className="adventure-combat-log">{log.map((entry, index) => <div key={`${String(entry.turn ?? index)}-${index}`}>{String(entry.message ?? "Combat event resolved.")}</div>)}</div> : null}
      </div>
    </div>
  );
}

function AdventureEntryCard({
  entry,
  busy,
  combatItemId,
  combatItems,
  onCombatItemChange,
  onStart,
}: {
  entry: ServerAdventureEntry;
  busy: boolean;
  combatItemId: string;
  combatItems: Array<{ itemId: string; name: string; quantity: number }>;
  onCombatItemChange: (adventureId: string, itemId: string) => void;
  onStart: (adventureId: string) => void;
}) {
  return (
    <article className={`adventure-card${entry.available ? "" : " adventure-card--locked"}`}>
      <div className="adventure-card__top">
        <div>
          <div className="adventure-card__kicker">{entry.categoryLabel} | {entry.cityName}</div>
          <h3>{entry.title}</h3>
          <p>{entry.summary}</p>
        </div>
        <button type="button" disabled={!entry.available || busy} onClick={() => onStart(entry.id)}>{busy ? "Resolving..." : "Start"}</button>
      </div>
      <div className="adventure-card__chips">
        <span>Risk: {entry.riskBand}</span>
        <span>Threat: {entry.threatType}</span>
        <span>Reward: {entry.rewardCategory}</span>
      </div>
      <div className="adventure-card__hint">Prep: {entry.recommendedPrep.join(" | ")}</div>
      <div className="adventure-card__hint">Gear read: {entry.gearHint}</div>
      {entry.hiddenSite ? <div className="adventure-card__hint">Hidden site: {entry.hiddenSite.name} ({entry.hiddenSite.status})</div> : null}
      {entry.lockReason ? <div className="jobs-low-stamina">{entry.lockReason}</div> : null}
      <div className="adventure-card__rewards">
        {entry.rewardItems.slice(0, 4).map((reward) => <span key={`${entry.id}-${reward.itemId}`}><ItemIcon item={reward.item} /> {reward.label} x{reward.quantity}</span>)}
      </div>
      <div className="adventure-card__footer">
        <label>Combat item
          <select value={combatItemId} onChange={(event) => onCombatItemChange(entry.id, event.target.value)}>
            <option value="">None</option>
            {combatItems.map((item) => <option key={`${entry.id}-${item.itemId}`} value={item.itemId}>{item.name} x{item.quantity}</option>)}
          </select>
        </label>
        <span>Sources: {entry.sourcePaths.map((path) => path.label).join(" | ")}</span>
      </div>
    </article>
  );
}

function ServerAdventureBoard({
  board,
  selectedCategory,
  onSelectCategory,
  busyAdventureId,
  combatSelections,
  combatItems,
  onCombatItemChange,
  onStart,
}: {
  board: ServerAdventureBoard;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  busyAdventureId: string | null;
  combatSelections: Record<string, string>;
  combatItems: Array<{ itemId: string; name: string; quantity: number }>;
  onCombatItemChange: (adventureId: string, itemId: string) => void;
  onStart: (adventureId: string) => void;
}) {
  const entries = board.entries.filter((entry) => selectedCategory === "all" || entry.category === selectedCategory);
  return (
    <ContentPanel title="Expedition Desk">
      <div className="adventure-board">
        <div className="jobs-overview__brief">{board.rhythm}</div>
        <div className="adventure-tabs">
          <button type="button" onClick={() => onSelectCategory("all")} aria-pressed={selectedCategory === "all"}>All ({board.entries.length})</button>
          {board.categories.map((category) => <button key={category.id} type="button" onClick={() => onSelectCategory(category.id)} aria-pressed={selectedCategory === category.id}>{category.label} ({category.availableCount}/{category.count})</button>)}
        </div>
        <div className="adventure-list">
          {entries.map((entry) => <AdventureEntryCard key={entry.id} entry={entry} busy={busyAdventureId === entry.id} combatItemId={combatSelections[entry.id] ?? ""} combatItems={combatItems} onCombatItemChange={onCombatItemChange} onStart={onStart} />)}
        </div>
      </div>
    </ContentPanel>
  );
}

export default function JobsPage() {
  const jobs = useJobs();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
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

  const [adventureBoard, setAdventureBoard] = useState<ServerAdventureBoard | null>(null);
  const [adventureCategory, setAdventureCategory] = useState("all");
  const [busyAdventureId, setBusyAdventureId] = useState<string | null>(null);
  const [adventureMessage, setAdventureMessage] = useState<string | null>(null);
  const [adventureError, setAdventureError] = useState<string | null>(null);
  const [adventureResult, setAdventureResult] = useState<Record<string, unknown> | null>(null);
  const [combatSelections, setCombatSelections] = useState<Record<string, string>>({});
  const selectedCategory =
    jobCategories.find((c) => c.id === selectedCategoryId) ?? jobCategories[0];

  const categoryProgress = jobs.getCategoryProgress(selectedCategoryId);
  const totalOperations = selectedCategory?.subJobs.length ?? 0;
  const totalCategories = jobCategories.length;
  const lowestStaminaCost = selectedCategory
    ? Math.min(...selectedCategory.subJobs.map((job) => job.staminaCost))
    : 0;

  useEffect(() => {
    setOutcomes({});
  }, [selectedCategoryId]);

  const combatItems = Object.entries(player.inventory ?? {})
    .filter(([itemId, quantity]) => Number(quantity) > 0 && ["field_bandage", "minor_healing_draught", "major_healing_draught", "smoke_pellet", "ward_chalk", "bitter_antidote", "quickstep_tonic", "ironhide_tonic"].includes(itemId))
    .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity), name: ITEM_CATALOGUE[itemId]?.name ?? itemId }));

  useEffect(() => {
    let cancelled = false;
    async function loadAdventureBoard() {
      if (authSource !== "server" || !serverSessionToken) { setAdventureBoard(null); return; }
      const result = await getServerAdventureBoard(serverSessionToken);
      if (cancelled) return;
      if (result.ok) setAdventureBoard(result.board);
      else setAdventureError(result.error);
    }
    void loadAdventureBoard();
    return () => { cancelled = true; };
  }, [authSource, serverSessionToken, player.current?.currentCityId]);

  const handleStartAdventure = useCallback(async (adventureId: string) => {
    if (!serverSessionToken) return;
    setBusyAdventureId(adventureId);
    setAdventureMessage(null);
    setAdventureError(null);
    const result = await startServerAdventure(serverSessionToken, adventureId, { combatItemId: combatSelections[adventureId] || null });
    setBusyAdventureId(null);
    if (!result.ok) { setAdventureError(result.error); return; }
    setAdventureBoard(result.board);
    setAdventureMessage(result.message ?? "Adventure resolved.");
    setAdventureResult(result as unknown as Record<string, unknown>);
    await refreshServerState();
  }, [combatSelections, refreshServerState, serverSessionToken]);

  const handleCombatItemChange = useCallback((adventureId: string, itemId: string) => {
    setCombatSelections((current) => ({ ...current, [adventureId]: itemId }));
  }, []);

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
      title="Adventuring"
      hint="Expeditions, elite hunts, hidden-site runs, and street operations. Gear choice, damage types, and consumables now matter."
    >
      <div className="jobs-page">
        <ContentPanel title="Operations Board">
          <div className="jobs-overview">
            <div className="jobs-overview__item">
              <span className="jobs-overview__label">Current Category</span>
              <strong className="jobs-overview__value">{selectedCategory?.name ?? "None"}</strong>
            </div>
            <div className="jobs-overview__item">
              <span className="jobs-overview__label">Categories</span>
              <strong className="jobs-overview__value">{totalCategories}</strong>
            </div>
            <div className="jobs-overview__item">
              <span className="jobs-overview__label">Operations</span>
              <strong className="jobs-overview__value">{totalOperations}</strong>
            </div>
            <div className="jobs-overview__item">
              <span className="jobs-overview__label">Lowest Stamina Cost</span>
              <strong className="jobs-overview__value">{lowestStaminaCost}</strong>
            </div>
          </div>
          {selectedCategory ? (
            <div className="jobs-overview__brief">
              {selectedCategory.description} {selectedCategory.isIllegal ? "Illegal work draws guards and jail time, because the city remains annoyingly consistent about crime." : "Legal work keeps the gold honest, or at least honest-looking."} Beginner Adventurer now includes Gather Herbs as a no-gear starter action; tool-gated jobs list where to get missing supplies.
            </div>
          ) : null}
        </ContentPanel>

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
                      <div className="jobs-category-header__submeta">
                        {selectedCategory.theme} | {selectedCategory.subJobs.length} operations | starting cost {lowestStaminaCost} stamina
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
