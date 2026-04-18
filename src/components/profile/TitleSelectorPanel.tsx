import React from "react";
import { type PlayerTitleStats } from "../../data/titleData";
import {
  activateTitle,
  clearActiveTitle,
  getActiveTitle,
  resolveTitleStates,
  type PlayerTitleProfile,
} from "../../lib/titleLogic";

interface TitleSelectorPanelProps {
  stats: PlayerTitleStats;
  profile: PlayerTitleProfile;
  onChange: (nextProfile: PlayerTitleProfile) => void;
}

export function TitleSelectorPanel({ stats, profile, onChange }: TitleSelectorPanelProps) {
  const resolved = resolveTitleStates(stats, profile);
  const active = getActiveTitle(profile);

  return (
    <section className="content-panel">
      <header className="content-panel__header">
        <h3>Titles</h3>
        <span>{active ? `Active: ${active.name}` : "No active title"}</span>
      </header>

      <div className="content-panel__body" style={{ display: "grid", gap: 12 }}>
        {active ? (
          <div className="profile-title-banner" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 12 }}>
            <strong>{active.name}</strong>
            <p style={{ margin: "6px 0 10px", opacity: 0.82 }}>{active.flavor}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {active.bonuses.map((bonus) => (
                <li key={`${active.id}-${bonus.description}`}>{bonus.description}</li>
              ))}
            </ul>
            <button style={{ marginTop: 10 }} onClick={() => onChange(clearActiveTitle(profile))}>
              Clear Active Title
            </button>
          </div>
        ) : null}

        {resolved.map(({ title, unlocked, progressPercent, progressValue }) => {
          const isActive = profile.activeTitleId === title.id;
          return (
            <article
              key={title.id}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: 12,
                background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <strong>{title.name}</strong>
                  <div style={{ fontSize: 12, opacity: 0.76 }}>{title.requirement.description}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{unlocked ? "Unlocked" : `${progressPercent}%`}</div>
              </div>

              <p style={{ margin: "8px 0", opacity: 0.82 }}>{title.flavor}</p>
              <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
                {title.bonuses.map((bonus) => (
                  <li key={`${title.id}-${bonus.description}`}>{bonus.description}</li>
                ))}
              </ul>

              {!unlocked ? (
                <div style={{ fontSize: 12, opacity: 0.74 }}>
                  Progress: {progressValue}/{title.requirement.threshold}
                </div>
              ) : (
                <button disabled={isActive} onClick={() => onChange(activateTitle(profile, title.id))}>
                  {isActive ? "Active" : "Set Active Title"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default TitleSelectorPanel;
