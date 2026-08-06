// Tunable constants for Settings-page account actions. Kept separate from
// env.js (environment-derived config) since these are game-design values,
// not deployment config - safe to tweak without touching env plumbing.

// Change Name: friction currency is gold (universal, continuously earned),
// not Legacy Points (a distinct economy earned via achievements specifically
// for permanent perk ranks - repurposing it here would strand players who've
// already spent theirs on perks).
export const NAME_CHANGE_GOLD_COST = 2500;
export const NAME_CHANGE_COOLDOWN_DAYS = 30;

// Reuses the exact charset/length convention already enforced client-side at
// registration (src/pages/Register.tsx) - prose fantasy names, not Torn's
// alphanumeric+underscore/15-char rule.
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 20;
export const NAME_PATTERN = /^[a-zA-Z\- ']+$/;
