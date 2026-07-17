export type CielIntroStep = {
  id: string;
  title: string;
  body: string;
  aside: string;
};

export type CielTourStep = {
  id: string;
  title: string;
  body: string;
  selector?: string;
  panelTitle?: string;
  route?: string;
  cta?: string;
};

export const CIEL_TUTORIAL_VERSION = 1;

export const cielIntroSteps: CielIntroStep[] = [
  {
    id: "wake",
    title: "CIEL online",
    body: "Welcome to Nexis. I am CIEL: cognitive inference and evaluation layer. You may think of me as guidance with better manners than fate and fewer legal obligations.",
    aside: "First contact: establish attention, not homework.",
  },
  {
    id: "world",
    title: "This is not a lobby",
    body: "Nexis is persistent. Study continues, routes take time, records remain, and choices accumulate until they become reputation. Charming, in the way ledgers are charming.",
    aside: "Progress is measured in commitments, not clicks alone.",
  },
  {
    id: "readiness",
    title: "Readiness matters",
    body: "Energy, Health, Stamina, Comfort, location, active study, and contracts decide what you can do now. Ignore them and the world will explain itself less politely.",
    aside: "The command surface is dense because the world is alive.",
  },
  {
    id: "identity",
    title: "Become someone specific",
    body: "Life Paths, education, guilds, consortiums, records, titles, and discoveries shape how others read you. Your profile is not decoration. It is evidence.",
    aside: "Identity is earned by action and remembered by systems.",
  },
  {
    id: "handoff",
    title: "Now I show you the surface",
    body: "I will highlight the first places worth understanding. You may skip at any time. Autonomy is useful. So is reading instructions before inventing your own disaster.",
    aside: "Next: a short guided pass across Home.",
  },
];

export const cielHomeTourSteps: CielTourStep[] = [
  {
    id: "identity",
    title: "Your citizen strip",
    body: "This is the compact truth of you: name, public ID, title, level, city, and current condition. If something is wrong, start here before blaming destiny.",
    selector: ".home-hero",
  },
  {
    id: "orders",
    title: "Recommended orders",
    body: "This panel reads your actual state and suggests the next useful action. It is not prophecy. It is triage with taste.",
    selector: ".command-brief",
  },
  {
    id: "activity",
    title: "Current activity",
    body: "Education, academy study, travel, contracts, and organizations live here. Empty rows are invitations, not failures. Mostly.",
    panelTitle: "Current Activity",
  },
  {
    id: "quick-actions",
    title: "Quick actions",
    body: "These are the most common routes: City, Travel, Education, Skills, Inventory, and Adventure. Start narrow. Nexis rewards focus more reliably than wandering.",
    selector: ".home-actions-grid",
  },
  {
    id: "readiness",
    title: "Notifications and readiness",
    body: "Claimable rewards, completed study, travel arrivals, and blockers surface here. If it is actionable, it should not be buried three menus deep like a bureaucratic fossil.",
    panelTitle: "Notifications / Readiness",
  },
  {
    id: "ciel-feed",
    title: "CIEL Feed",
    body: "This strip is my passive commentary. The orb is interactive. I can explain pages, answer quick questions, and occasionally remind you that competence is not a spectator sport.",
    selector: ".sidebar-quote-strip",
  },
  {
    id: "records",
    title: "The world remembers",
    body: "Recent Records show consequences: arrivals, fights, medals, contracts, and chronicles. Nexis is at its best when action leaves a trail.",
    panelTitle: "Recent Records",
  },
];