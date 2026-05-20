import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { AcademyDefinition, academyDefinitions, academySystemRules } from "../data/academyData";
import { getCodexEntryIdForLegacyAcademy, getCodexEntryRoute } from "../data/codexData";
import "../styles/academies-ui.css";

const ACADEMY_IMAGES: Record<string, string> = {
  southern: "/images/academies/academy_southern.png",
  eastern: "/images/academies/academy_eastern.png",
  northern: "/images/academies/academy_northern.png",
  western: "/images/academies/academy_western.png",
  professions: "/images/academies/academy_professions.png",
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="academy-meta-row">
      <span className="academy-meta-row__label">{label}</span>
      <strong className="academy-meta-row__value">{value}</strong>
    </div>
  );
}

function groupAcademies() {
  const groups = new Map<string, AcademyDefinition[]>();
  for (const academy of academyDefinitions) {
    const key = academy.region || "Nexis";
    groups.set(key, [...(groups.get(key) ?? []), academy]);
  }
  return Array.from(groups.entries());
}

export default function AcademiesPage() {
  const [selectedId, setSelectedId] = useState(academyDefinitions[0]?.id ?? "southern");
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [openRankIndex, setOpenRankIndex] = useState<number | null>(0);
  const grouped = useMemo(() => groupAcademies(), []);
  const selectedAcademy = useMemo<AcademyDefinition | undefined>(
    () => academyDefinitions.find((academy) => academy.id === selectedId),
    [selectedId],
  );

  return (
    <AppShell title="Academies" hint="Academies are city and region commitments: requirements first, study second, rewards after the work is actually done.">
      <div className="academies-grid">
        <div className="academies-column academies-column--left">
          <ContentPanel title="Academy Rules">
            <ul className="academy-rule-list">
              {academySystemRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </ContentPanel>

          <ContentPanel title="Academy Directory">
            <div className="academy-card-list">
              {grouped.map(([region, academies]) => {
                const open = openRegion === region;
                const completedCount = academies.filter((academy) => academy.id === selectedId).length;
                return (
                  <div key={region} style={{ display: "grid", gap: 8 }}>
                    <button
                      type="button"
                      className={`academy-card${open ? " academy-card--active" : ""}`}
                      onClick={() => setOpenRegion(open ? null : region)}
                    >
                      <div className="academy-card__title">{open ? "Collapse" : "Expand"} {region}</div>
                      <div className="academy-card__subtitle">{academies.length} academies | {completedCount ? "selected here" : "choose to inspect"}</div>
                      <div className="academy-card__theme">Regional academy group</div>
                    </button>
                    {open ? academies.map((academy) => (
                      <button
                        key={academy.id}
                        type="button"
                        className={`academy-card${academy.id === selectedId ? " academy-card--active" : ""}`}
                        onClick={() => setSelectedId(academy.id)}
                      >
                        <div className="academy-card__title">{academy.name}</div>
                        <div className="academy-card__subtitle">{academy.shortName}</div>
                        <div className="academy-card__theme">{academy.theme}</div>
                        <div className="academy-card__location">{academy.locationName}</div>
                      </button>
                    )) : null}
                  </div>
                );
              })}
            </div>
          </ContentPanel>
        </div>

        <div className="academies-column academies-column--center">
          {selectedAcademy ? (
            <>
              <ContentPanel title={selectedAcademy.name}>
                {ACADEMY_IMAGES[selectedAcademy.id] ? (
                  <div className="academy-art-frame">
                    <img src={ACADEMY_IMAGES[selectedAcademy.id]} alt={selectedAcademy.name} className="academy-art-img" />
                  </div>
                ) : null}
                <div className="academy-header-block">
                  <div className="academy-header-block__theme">{selectedAcademy.theme}</div>
                  <p className="academy-header-block__description">{selectedAcademy.theme}. <Link className="inline-route-link" to={getCodexEntryRoute(getCodexEntryIdForLegacyAcademy(selectedAcademy.id))}>Open archive record</Link></p>
                </div>
                <div className="academy-meta-grid">
                  <MetaRow label="Short Name" value={selectedAcademy.shortName} />
                  <MetaRow label="Region" value={selectedAcademy.region} />
                  <MetaRow label="Location" value={selectedAcademy.locationName} />
                  <MetaRow label="Role Identity" value={selectedAcademy.roleIdentity} />
                  <MetaRow label="Academy Type" value={selectedAcademy.academyType} />
                  <MetaRow label="Ranks" value={selectedAcademy.totalRanks} />
                  <MetaRow label="Days Per Rank" value={selectedAcademy.durationPerRankDays} />
                  <MetaRow label="Total Days" value={selectedAcademy.totalDurationDays} />
                </div>
              </ContentPanel>

              <ContentPanel title="Study Requirements">
                <ul className="academy-rule-list">
                  {selectedAcademy.activationRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </ContentPanel>

              <ContentPanel title="Rank Ladder">
                <div className="academy-rank-list">
                  {selectedAcademy.ranks.map((rank, index) => {
                    const open = openRankIndex === index;
                    return (
                      <article key={`${selectedAcademy.id}-${rank.title}-${index}`} className="academy-rank-card">
                        <button type="button" className="academy-rank-card__toggle" onClick={() => setOpenRankIndex(open ? null : index)}>
                          <span>Rank {rank.rank}{rank.branch ? ` | ${rank.branch}` : ""} - {rank.title}</span>
                          <span className={`academy-rank-card__mode academy-rank-card__mode--${rank.rewardMode}`}>{rank.rewardMode}</span>
                        </button>
                        {open ? (
                          <div className="academy-rank-card__body">
                            <p>{rank.description}</p>
                            <div className="academy-rank-card__foot"><span>{rank.durationDays} days</span></div>
                            {rank.dependencies?.length ? (
                              <div className="academy-rank-card__block"><div className="academy-rank-card__label">Dependencies</div><ul>{rank.dependencies.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            ) : null}
                            {rank.notes?.length ? (
                              <div className="academy-rank-card__block"><div className="academy-rank-card__label">Notes</div><ul>{rank.notes.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul></div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </ContentPanel>
            </>
          ) : null}
        </div>

        <div className="academies-column academies-column--right">
          <ContentPanel title="Study Model">
            <div className="academy-summary-block">
              <div className="academy-summary-block__label">Education Runs Separately</div>
              <p>Education handles broad account learning. Academy study handles city-bound specialization. One of each can be active at the same time.</p>
            </div>
            <div className="academy-summary-block">
              <div className="academy-summary-block__label">City Commitment</div>
              <p>Academy progress is tied to its city. If a city-bound study needs your presence, the live city hub will say so directly.</p>
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
