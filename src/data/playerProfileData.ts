export type LuckSourceKey =
  | "base"
  | "events"
  | "achievements"
  | "items"
  | "education"
  | "housing";

export type LuckSources = Record<LuckSourceKey, number>;

export type PlayerProfileData = {
  id: string;
  name: string;
  title: string;
  level: number;
  rank: string;
  daysPlayed: number;
  maritalStatus: string;
  faction: string;
  city: string;
  battleStats: {
    strength: number;
    defense: number;
    speed: number;
    dexterity: number;
  };
  workingStats: {
    manualLabor: number;
    intelligence: number;
    endurance: number;
  };
  specialStats: {
    luckSources: LuckSources;
  };
};

export const defaultLuckSources: LuckSources = {
  base: 0,
  events: 0,
  achievements: 0,
  items: 0,
  education: 0,
  housing: 0,
};

export const playerProfile: PlayerProfileData = {
  id: "0001",
  name: "Wanderer",
  title: "Initiate",
  level: 1,
  rank: "Beginner",
  daysPlayed: 0,
  maritalStatus: "Single",
  faction: "Unaffiliated",
  city: "Nexis City",
  battleStats: {
    strength: 0,
    defense: 0,
    speed: 0,
    dexterity: 0,
  },
  workingStats: {
    manualLabor: 0,
    intelligence: 0,
    endurance: 0,
  },
  specialStats: {
    luckSources: defaultLuckSources,
  },
};
