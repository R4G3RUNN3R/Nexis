import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { chooseLifePath } from "../lib/authApi";
import { lifePaths, getLifePath, type LifePathDefinition } from "../data/lifePathsData";
import "../styles/life-paths.css";

type LifePathState = { current: string | null; chosenAt: number | null } | null;

function formatChosenDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function SuggestionRow({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <div className="life-path-suggestion">
      <span className="life-path-suggestion__label">{label}</span>
      <Link className="life-path-suggestion__value" to={to}>
        {value}
      </Link>
    </div>
  );
}

function LifePathCard({
  path,
  selected,
  onSelect,
}: {
  path: LifePathDefinition;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`life-path-card${selected ? " life-path-card--selected" : ""}`}
      onClick={() => onSelect(path.id)}
    >
      <div className="life-path-card__name">{path.name}</div>
      <div className="life-path-card__subtitle">{path.subtitle}</div>
      <p className="life-path-card__flavor">{path.flavor}</p>
      <div className="life-path-card__meta">
        <span className="life-path-card__meta-label">Suggested job</span>
        <span className="life-path-card__meta-value">{path.suggestedJob.label}</span>
      </div>
      <div className="life-path-card__meta">
        <span className="life-path-card__meta-label">Suggested study</span>
        <span className="life-path-card__meta-value">{path.suggestedEducation.label}</span>
      </div>
    </button>
  );
}

function ChosenPathPanel({ path, chosenAt }: { path: LifePathDefinition; chosenAt: number | null }) {
  return (
    <ContentPanel title="Your Life Path">
      <div className="life-path-chosen">
        <div className="life-path-chosen__top">
          <div>
            <div className="life-path-chosen__name">{path.name}</div>
            <div className="life-path-chosen__subtitle">{path.subtitle}</div>
          </div>
          <div className="life-path-chosen__date">Chosen {formatChosenDate(chosenAt)}</div>
        </div>
        <p className="life-path-chosen__flavor">{path.flavor}</p>
        <div className="life-path-chosen__suggestions">
          <SuggestionRow label="Suggested first job" value={path.suggestedJob.label} to={path.suggestedJob.route} />
          <SuggestionRow label="Suggested first study" value={path.suggestedEducation.label} to={path.suggestedEducation.route} />
        </div>
        <p className="life-path-chosen__note">
          Life paths are a soft origin story, not a class or a cage. Every job, contract, and education branch in
          Nexis stays open to you regardless of the path you started on.
        </p>
      </div>
    </ContentPanel>
  );
}

export default function LifePathsPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lifePathState = (player as unknown as { lifePath?: LifePathState }).lifePath ?? null;
  const chosenPath = getLifePath(lifePathState?.current ?? null);
  const canChoose = authSource === "server" && Boolean(serverSessionToken);
  const pendingPath = selectedId ? getLifePath(selectedId) : null;

  async function handleConfirm() {
    if (!selectedId || !serverSessionToken) return;
    setSubmitting(true);
    setError(null);
    const result = await chooseLifePath(serverSessionToken, selectedId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedId(null);
    await refreshServerState();
  }

  return (
    <AppShell
      title="Life Paths"
      hint="A soft identity lane chosen once at the start of your account: it flavors your early missions, suggested first job, and suggested first study. It never locks off content."
    >
      {chosenPath ? (
        <ChosenPathPanel path={chosenPath} chosenAt={lifePathState?.chosenAt ?? null} />
      ) : (
        <div className="life-paths-wrap">
          <ContentPanel title="Choose Your Life Path">
            <p className="life-paths-intro">
              Every citizen of Nexis starts somewhere. Pick the lane that matches how you want to begin your story —
              it colors your early flavor text, suggests a first job and a first course of study, and is recorded in
              your Chronicle. It is a one-time choice: pick carefully, but do not overthink it. Nothing here locks you
              out of any job, education branch, guild, or consortium later on.
            </p>

            {!canChoose ? (
              <div className="life-paths-notice">
                Life path selection needs a synced citizen account. Log back in if you were recently disconnected.
              </div>
            ) : null}

            <div className="life-paths-grid">
              {lifePaths.map((path) => (
                <LifePathCard
                  key={path.id}
                  path={path}
                  selected={selectedId === path.id}
                  onSelect={(id) => {
                    setError(null);
                    setSelectedId((current) => (current === id ? null : id));
                  }}
                />
              ))}
            </div>

            {error ? <div className="life-paths-error">{error}</div> : null}

            {pendingPath ? (
              <div className="life-paths-confirm">
                <div className="life-paths-confirm__copy">
                  Begin as the <strong>{pendingPath.name}</strong>? This choice is permanent and cannot be changed
                  later, though it never blocks any job, contract, or course.
                </div>
                <div className="life-paths-confirm__actions">
                  <button type="button" className="life-paths-confirm__cancel" onClick={() => setSelectedId(null)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="button" className="life-paths-confirm__accept" onClick={handleConfirm} disabled={submitting || !canChoose}>
                    {submitting ? "Recording..." : `Confirm: ${pendingPath.name}`}
                  </button>
                </div>
              </div>
            ) : null}
          </ContentPanel>
        </div>
      )}
    </AppShell>
  );
}
