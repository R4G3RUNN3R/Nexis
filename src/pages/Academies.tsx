import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { AcademyDefinition, academyDefinitions, academySystemRules } from "../data/academyData";
import "../styles/academies-ui.css";

// Academy art - public/images/academies/
const ACADEMY_IMAGES: Record<string, string> = {
  southern:    "/images/academies/academy_southern.png",
  eastern:     "/images/academies/academy_eastern.png",
  northern:    "/images/academies/academy_northern.png",
  western:     "/images/academies/academy_western.png",
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

export default function AcademiesPage() {
  const [selectedId, setSelectedId] = useState(academyDefinitions[0]?.id ?? "southern");

  const selectedAcademy = useMemo<AcademyDefinition | undefined>(
    () => academyDefinitions.find((academy) => academy.id === selectedId),
    [selectedId]
  );

  return (
    <AppShell
      title="Academies"
      hint="Full academy structure is now in code. Perk payloads and live logic come after the structure is locked."
    >
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
              {academyDefinitions.map((academy) => (
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
              ))}
            </div>
          </ContentPanel>
        </div>

        <div className="academies-column academies-column--center">
          {selectedAcademy ? (
            <>
              <ContentPanel title={selectedAcademy.name}>
                {ACADEMY_IMAGES[selectedAcademy.id] && (
                  <div className="academy-art-frame">
                    <img
                      src={ACADEMY_IMAGES[selectedAcademy.id]}
                      alt={selectedAcademy.name}
                      className="academy-art-img"
                    />
                  </div>
                )}
                <div className="academy-header-block">
                  <div className="academy-header-block__theme">{selectedAcademy.theme}</div>
                  <p className="academy-header-block__description">{selectedAcademy.description}</p>
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

              <ContentPanel title="Activation & Progression Notes">
                <ul className="academy-rule-list">
                  {selectedAcademy.activationRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </ContentPanel>

              <ContentPanel title="Rank Ladder">
                <div className="academy-rank-list">
                  {selectedAcademy.ranks.map((rank, index) => (
                    <article key={`${selectedAcademy.id}-${rank.title}-${index}`} className="academy-rank-card">
                      <div className="academy-rank-card__top">
                        <span className="academy-rank-card__rank">
                          Rank {rank.rank}
                          {rank.branch ? ` | ${rank.branch}` : ""}
                        </span>
                        <span className={`academy-rank-card__mode academy-rank-card__mode--${rank.rewardMode}`}>
                          {rank.rewardMode}
                        </span>
                      </div>

                      <h3>{rank.title}</h3>
                      <p>{rank.description}</p>

                      <div className="academy-rank-card__foot">
                        <span>{rank.durationDays} days</span>
                      </div>

                      {rank.dependencies?.length ? (
                        <div className="academy-rank-card__block">
                          <div className="academy-rank-card__label">Dependencies</div>
                          <ul>
                            {rank.dependencies.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {rank.notes?.length ? (
                        <div className="academy-rank-card__block">
                          <div className="academy-rank-card__label">Notes</div>
                          <ul>
                            {rank.notes.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </ContentPanel>
            </>
          ) : null}
        </div>

        <div className="academies-column academies-column--right">
          <ContentPanel title="Design Summary">
            <div className="academy-summary-block">
              <div className="academy-summary-block__label">Standard Academies</div>
              <p>
                Southern, Eastern, Northern, and Western are long-form specialization academies.
                A player may learn all of them, but only one may be active at a time.
              </p>
            </div>

            <div className="academy-summary-block">
              <div className="academy-summary-block__label">Nexis Academy</div>
              <p>
                The Nexis City profession school is not part of the one-active switching system.
                Its learned professions remain always active and are meant to support trade,
                crafting, and long-term player interdependence.
              </p>
            </div>

            <div className="academy-summary-block">
              <div className="academy-summary-block__label">Travel Dependency</div>
              <p>
                Travel will later enforce physical academy location for switching.
                This page only locks the academy names, structures, and rank ladders for now.
              </p>
            </div>
          </ContentPanel>

          <ContentPanel title="Implementation Order">
            <ol className="academy-ordered-list">
              <li>Lock academy definitions and IDs.</li>
              <li>Decide the actual perk payloads for each rank.</li>
              <li>Add player academy state and progress tracking.</li>
              <li>Wire timers and completion logic.</li>
              <li>Wire active academy switching requirements.</li>
              <li>Connect academy effects into combat, crafting, hospital, and city systems.</li>
            </ol>
          </ContentPanel>

          <ContentPanel title="Current Goal">
            <p className="academy-goal-note">
              This is the full academy design layer in code so it can be pasted into the current framework
              without disturbing the rest of the UI. Logic comes next.
            </p>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
