import { useMemo, useState } from "react";
import "../styles/character-profile.css";

type CharacterStat = {
  label: string;
  value: string;
};

type CharacterAchievement = {
  id: string;
  name: string;
  category: string;
  progress: string;
  description: string;
};

type LegacyEntry = {
  id: string;
  title: string;
  text: string;
  date: string;
};

type ActivityEntry = {
  id: string;
  text: string;
  timeAgo: string;
};

type EquipmentItem = {
  slot: string;
  name: string;
};

type CharacterProfile = {
  id: string;
  name: string;
  title: string;
  level: number;
  rank: string;
  age: string;
  role: string;
  faction: string;
  job: string;
  property: string;
  life: string;
  avatarUrl: string;
  workingStats: CharacterStat[];
  battleStats: CharacterStat[];
  generalStats: CharacterStat[];
  achievements: CharacterAchievement[];
  legacyEntries: LegacyEntry[];
  activityFeed: ActivityEntry[];
  equipment: EquipmentItem[];
  inventorySummary: string[];
  propertySummary: string[];
};

const mockCharacter: CharacterProfile = {
  id: "CHR-0001",
  name: "Hennet Uthellien",
  title: "The Absolute",
  level: 30,
  rank: "Veteran Trader",
  age: "8 months 18 days",
  role: "Civilian",
  faction: "Shadow Mercantile",
  job: "Education",
  property: "Private Estate",
  life: "1,375 / 1,375",
  avatarUrl: "https://images.unsplash.com/photo-1611601322175-ef8ec8c85f01?auto=format&fit=crop&w=900&q=80",
  workingStats: [
    { label: "Manual Labor", value: "3,813" },
    { label: "Intelligence", value: "1,098" },
    { label: "Endurance", value: "2,982" }
  ],
  battleStats: [
    { label: "Strength", value: "72,400" },
    { label: "Speed", value: "68,950" },
    { label: "Dexterity", value: "77,120" },
    { label: "Defense", value: "70,115" }
  ],
  generalStats: [
    { label: "Net Worth", value: "$408M" },
    { label: "Education Bonus", value: "+10%" },
    { label: "Job Income Bonus", value: "+3%" },
    { label: "Travel Efficiency", value: "+5%" }
  ],
  achievements: [
    {
      id: "ach-1",
      name: "Scholar",
      category: "Education",
      progress: "12 / 25",
      description: "Complete 25 education courses."
    },
    {
      id: "ach-2",
      name: "Wayfinder",
      category: "Travel",
      progress: "8 / 20",
      description: "Complete 20 long-distance journeys."
    },
    {
      id: "ach-3",
      name: "Shadow Contact",
      category: "Underworld",
      progress: "Locked",
      description: "Complete Streetcraft and qualify for Western Academy Shadowcraft specialization."
    },
    {
      id: "ach-4",
      name: "Consortium Founder",
      category: "Economy",
      progress: "Locked",
      description: "Complete Civic Fundamentals and create a consortium."
    }
  ],
  legacyEntries: [
    {
      id: "leg-1",
      title: "The Ruins of Val'Thar",
      date: "14 Ember Cycle",
      text:
        "A routine journey became something stranger when forgotten stonework surfaced beneath the trade road. Hennet recovered fractured relics and left with more questions than answers."
    },
    {
      id: "leg-2",
      title: "The Scholar's Oath",
      date: "19 Ember Cycle",
      text:
        "Basic Literacy was completed without ceremony, yet the effect on all future study was immediate. The account of that day marks the first true shaping of the character's legacy."
    }
  ],
  activityFeed: [
    { id: "act-1", text: "Completed Basic Literacy.", timeAgo: "1d" },
    { id: "act-2", text: "Started Practical Arithmetic.", timeAgo: "3h" },
    { id: "act-3", text: "Collected 1,250 gold from Education job.", timeAgo: "6h" },
    { id: "act-4", text: "Found a weathered relic fragment while travelling.", timeAgo: "1d" }
  ],
  equipment: [
    { slot: "Weapon", name: "Ravenclaw Longsword" },
    { slot: "Armor", name: "Shadowwoven Coat" },
    { slot: "Accessory", name: "Tear of the Gods" }
  ],
  inventorySummary: [
    "3 healing tonics",
    "1 relic fragment",
    "14 trade goods",
    "2 travel permits"
  ],
  propertySummary: [
    "Estate upkeep: 9,500 gold",
    "Storage capacity: 240 slots",
    "Staff rooms: 6",
    "Passive training bonus: +2%"
  ]
};

type PanelSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function PanelSection({ title, defaultOpen = true, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="character-panel">
      <button
        type="button"
        className="character-panel__header"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="character-panel__toggle">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="character-panel__body">{children}</div> : null}
    </section>
  );
}

function StatTable({ stats }: { stats: CharacterStat[] }) {
  return (
    <div className="stat-table">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-row">
          <span className="stat-row__label">{stat.label}</span>
          <strong className="stat-row__value">{stat.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function CharacterProfilePage() {
  const character = useMemo(() => mockCharacter, []);

  return (
    <div className="character-profile-page">
      <header className="character-hero">
        <div className="character-hero__identity">
          <div className="character-hero__status-dot" />
          <div>
            <h1>{character.name}</h1>
            <div className="character-hero__meta">
              <span>{character.id}</span>
              <span>{character.title}</span>
              <span>Level {character.level}</span>
              <span>{character.rank}</span>
            </div>
          </div>
        </div>

        <div className="character-hero__quickstats">
          <div className="quickstat">
            <span className="quickstat__label">Net Worth</span>
            <strong>{character.generalStats[0]?.value}</strong>
          </div>
          <div className="quickstat">
            <span className="quickstat__label">Life</span>
            <strong>{character.life}</strong>
          </div>
          <div className="quickstat">
            <span className="quickstat__label">Age</span>
            <strong>{character.age}</strong>
          </div>
        </div>
      </header>

      <div className="character-layout">
        <div className="character-column">
          <PanelSection title="User Information">
            <div className="identity-card">
              <img src={character.avatarUrl} alt={character.name} className="identity-card__avatar" />
              <div className="identity-card__details">
                <div className="identity-card__level">
                  <span>Level</span>
                  <strong>{character.level}</strong>
                </div>
                <div className="identity-card__rank">
                  <span>Rank</span>
                  <strong>{character.rank}</strong>
                </div>
                <div className="identity-card__age">
                  <span>Age</span>
                  <strong>{character.age}</strong>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Basic Information">
            <div className="stat-table">
              <div className="stat-row"><span className="stat-row__label">Name</span><strong className="stat-row__value">{character.name}</strong></div>
              <div className="stat-row"><span className="stat-row__label">Role</span><strong className="stat-row__value">{character.role}</strong></div>
              <div className="stat-row"><span className="stat-row__label">Faction</span><strong className="stat-row__value">{character.faction}</strong></div>
              <div className="stat-row"><span className="stat-row__label">Job</span><strong className="stat-row__value">{character.job}</strong></div>
              <div className="stat-row"><span className="stat-row__label">Property</span><strong className="stat-row__value">{character.property}</strong></div>
              <div className="stat-row"><span className="stat-row__label">Life</span><strong className="stat-row__value">{character.life}</strong></div>
            </div>
          </PanelSection>

          <PanelSection title="General Stats">
            <StatTable stats={character.generalStats} />
          </PanelSection>
        </div>

        <div className="character-column">
          <PanelSection title="Working Stats">
            <StatTable stats={character.workingStats} />
          </PanelSection>

          <PanelSection title="Battle Stats">
            <StatTable stats={character.battleStats} />
          </PanelSection>

          <PanelSection title="Legacy System">
            <div className="legacy-list">
              {character.legacyEntries.map((entry) => (
                <article key={entry.id} className="legacy-entry">
                  <div className="legacy-entry__date">{entry.date}</div>
                  <h3>{entry.title}</h3>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          </PanelSection>

          <PanelSection title="Achievements">
            <div className="achievement-list">
              {character.achievements.map((achievement) => (
                <article key={achievement.id} className="achievement-card">
                  <div className="achievement-card__top">
                    <span className="achievement-card__category">{achievement.category}</span>
                    <span className="achievement-card__progress">{achievement.progress}</span>
                  </div>
                  <h3>{achievement.name}</h3>
                  <p>{achievement.description}</p>
                </article>
              ))}
            </div>
          </PanelSection>
        </div>

        <div className="character-column">
          <PanelSection title="Activity Feed">
            <div className="activity-list">
              {character.activityFeed.map((entry) => (
                <div key={entry.id} className="activity-item">
                  <span className="activity-item__time">{entry.timeAgo}</span>
                  <span className="activity-item__text">{entry.text}</span>
                </div>
              ))}
            </div>
          </PanelSection>

          <PanelSection title="Equipment">
            <div className="compact-list">
              {character.equipment.map((item) => (
                <div key={item.slot} className="compact-list__row">
                  <span>{item.slot}</span>
                  <strong>{item.name}</strong>
                </div>
              ))}
            </div>
          </PanelSection>

          <PanelSection title="Inventory Snapshot">
            <ul className="bullet-list">
              {character.inventorySummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </PanelSection>

          <PanelSection title="Property Information">
            <ul className="bullet-list">
              {character.propertySummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </PanelSection>
        </div>
      </div>
    </div>
  );
}
