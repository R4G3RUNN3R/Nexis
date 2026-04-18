export type Meter = {
  current: number;
  max: number;
};

export const activeAccount = {
  id: 0,
  name: "Wanderer",
  gold: 0,
  points: 0,
  level: 1,
  rank: "Unknown",
  ageDays: 0,
  maritalStatus: "Single",
  education: 0,
  manualLabor: 10,
  intelligence: 10,
  endurance: 10,
  strength: 10,
  dexterity: 10,
  defense: 10,
  speed: 10,
  energy: { current: 100, max: 100 } satisfies Meter,
  stamina: { current: 10, max: 10 } satisfies Meter,
  comfort: { current: 100, max: 100 } satisfies Meter,
  life: { current: 100, max: 100 } satisfies Meter,
};

export const playerFlags = {
  blackMarketUnlocked: false,
};

export function formatAccountMoney(value: number) {
  return `${value.toLocaleString("en-GB")}g`;
}
