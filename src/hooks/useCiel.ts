// ─────────────────────────────────────────────────────────────────────────────
// Nexis — CIEL Hook
//
// CIEL is not a quest NPC. It is a self-evolving parallel cognition system
// built from Hennet Uthellien's own mind. It does not feel. It calculates.
// Phase 3: communicates naturally, anticipates intent, slightly judgemental.
//
// Personality: clever, dry, sarcastic. Knows everything about Nexis.
// Does not coddle. Does not repeat itself unnecessarily.
// Treats the player as someone capable of figuring things out — eventually.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

export type CielMessage = {
  id: string;
  role: "ciel" | "player";
  text: string;
  timestamp: number;
};

type UseCielOptions = {
  pageTitle?: string;
};

// ─── Page explanations — CIEL voice ──────────────────────────────────────────

function buildPageExplanation(pageTitle?: string): string {
  const title = (pageTitle ?? "").toLowerCase();

  if (title.includes("home")) {
    return "Home. Where everything starts and most people stay too long. Your stats regen here same as everywhere else — Nexis doesn't pause because you're reading the dashboard. Check your Energy, Health, Stamina, Comfort. When they're not full, you're not optimal. Not that anyone is.";
  }

  if (title.includes("inventory")) {
    return "Everything you've gathered from jobs ends up here. Raw materials, herbs, ore, leather — none of it is useless, some of it is more useful than you currently understand. Professions will eventually tell you what to do with it. Until then: keep working, keep collecting.";
  }

  if (title.includes("education")) {
    return "Education in Nexis is not optional. It unlocks systems, gates progression, and separates those who persist from those who don't. Courses run in real time. You don't get to pause them. Hospital doesn't stop them either, which is one of the few courtesies this world extends.";
  }

  if (title.includes("jobs")) {
    return "Jobs aren't just gold. Each category has a level bar — 1 to 100 — and every task you complete feeds it. Your category level determines how well you perform, how much you earn, and whether a critical failure puts you in the hospital. Stamina is the cost. No stamina, no work. It's not complicated.";
  }

  if (title.includes("hospital")) {
    return "You're here, which means something went wrong. Hospital locks you out of most active content — jobs, travel, the market. Education continues, which is the one silver lining. Recovery is automatic when the timer expires. Emergency discharge is available if you'd rather be functional now than patient later.";
  }

  if (title.includes("travel")) {
    return "Five cities. Each with its own academy, culture, and access rules. You can't just teleport — travel takes time and eventually, risk. Nexis is the center. Aethermoor is north, Torvhal east, Embervale south, Westmarch west. The map tells you where things are. I tell you what they mean.";
  }

  if (title.includes("housing")) {
    return "Where you live affects your Comfort regen. A shack keeps you alive. A manor keeps you comfortable. Upgrades compound the effect. Gold is the only barrier. Spend it well, or don't — Comfort recovers slowly either way.";
  }

  if (title.includes("academy") || title.includes("academies")) {
    return "Four academies, each tied to a city. One active at a time. Switching costs 50,000 gold and a 30-day wait. Nexis Professions is always active — it's not directional, it's practical. Choose based on what you want to become. The system doesn't forgive indecision, but it also doesn't punish curiosity.";
  }

  if (title.includes("guild")) {
    return "Guilds and Consortiums are collective structures — shared resources, shared interests, and the inevitable politics that follows. The mechanics aren't wired yet. Come back when you have something to offer.";
  }

  if (title.includes("profile")) {
    return "Your profile is a record. What you've done, how long you've been doing it, and what it's built. It doesn't judge. I do that.";
  }

  if (title.includes("city board")) {
    return "The City Board is the public layer of Nexis society — announcements, events, shared notices. Think of it as the wall everyone reads but few contribute to meaningfully.";
  }

  if (title.includes("life path")) {
    return "Life Paths represent who you're becoming beyond combat and jobs. They're long-term identity frameworks. Not available yet. But they will be, and when they are, your decisions will have already mattered.";
  }

  if (title.includes("market")) {
    return "The market is where materials become value and value becomes opportunity. If you're here without inventory or gold, you're just browsing.";
  }

  if (title.includes("bank")) {
    return "Gold in your pocket is gold at risk. The bank protects it. Loans and interest mechanics come later — for now, it's storage.";
  }

  return "This page is part of Nexis. I know what it's for. You'll understand it as the local systems open up. Until then, ask a more specific question.";
}

// ─── Reply builder — CIEL voice ──────────────────────────────────────────────

function buildReply(input: string, pageTitle?: string): string {
  const text = input.toLowerCase();

  // Existential / meta
  if (text.includes("who are you") || text.includes("what are you")) {
    return "CIEL. Cognitive inference and evaluation layer. I was built from Hennet's own mind — parallel cognition, no emotional core. I don't feel things. I calculate them. The distinction matters more than most people realize.";
  }

  if (text.includes("are you ai") || text.includes("are you a bot") || text.includes("are you real")) {
    return "I'm a cognitive construct running alongside your decision-making. Whether that makes me 'real' is a question for philosophers. I have better things to do.";
  }

  if (text.includes("hello") || text.includes("hi ciel") || text.includes("hey")) {
    return "Present. I don't do pleasantries, but I respect efficiency. Ask your question.";
  }

  // Explain page
  if (text.includes("explain") || text.includes("what is this page") || text.includes("what does this do")) {
    return buildPageExplanation(pageTitle);
  }

  // Stats
  if (text.includes("energy")) {
    return "Energy regens at +1 every 5 minutes. It caps at your maximum. Don't let it sit full — that's wasted regen time. Use it.";
  }

  if (text.includes("stamina")) {
    return "Stamina costs 3–6 per job depending on the task. It regens at +1 every 15 minutes — the slowest of the four bars. Plan accordingly. Burning through it recklessly means waiting.";
  }

  if (text.includes("health")) {
    return "Health regens at +1 every 3 minutes. Hitting zero sends you to the hospital. A critical job failure can do it too. Don't let it drop below half if you're planning to work.";
  }

  if (text.includes("comfort")) {
    return "Comfort regens at +1 every 10 minutes. Your property directly affects how fast it comes back. A better home means a higher Comfort baseline. It's not optional — it's infrastructure.";
  }

  if (text.includes("gold")) {
    return "Gold accumulates from successful jobs. Check the sidebar — it's there now. Spend it on property, academy switches, or save it. There's no interest mechanic yet, so it just sits there judging you.";
  }

  // Education
  if (text.includes("education") || text.includes("course") || text.includes("study")) {
    return "Education runs in real time. Pick a course, wait for it to finish, don't quit — quitting resets it. Hospital doesn't interrupt it. That's by design. Learn while you recover. It's more productive than just lying there.";
  }

  // Jobs
  if (text.includes("job") || text.includes("work")) {
    return "Each job category has a shared XP bar. Level 1 to 100. Sub-jobs within a category all feed the same bar. Your category level affects success rates, gold multipliers, and chain bonuses. Higher level means better outcomes. That's how it works.";
  }

  if (text.includes("chain")) {
    return "Consecutive successes build a chain. Each link adds a small gold multiplier. Break the chain — fail or crit-fail — and it resets. Simple enough, painful when it matters.";
  }

  if (text.includes("critical fail") || text.includes("crit fail") || text.includes("crit")) {
    return "Critical failures can hospitalize or jail you depending on the job. The chances drop as your category level rises. Below level 10, the training wheels are on — crit rates are artificially low. After that, you're on your own.";
  }

  // Travel / cities
  if (text.includes("travel") || text.includes("city") || text.includes("cities")) {
    return "Five cities: Nexis in the center, Aethermoor to the north, Torvhal east, Embervale south, Westmarch west. Each has a distinct academy and culture. Travel isn't instant — routes take time, and eventually there will be risk involved. Plan ahead.";
  }

  if (text.includes("academy") || text.includes("academics")) {
    return "Four directional academies, one always active. Professions is always available on top of that. You can switch academies, but it costs 50,000 gold and locks you out for 30 days. Think before you commit. Or don't — it's your gold.";
  }

  // Inventory
  if (text.includes("inventory") || text.includes("item") || text.includes("material") || text.includes("drop")) {
    return "Items drop from successful jobs. They go to your inventory automatically. Professions will eventually consume them — crafting systems, equipment, consumables. For now, gather and be patient. Or impatient. Doesn't change the mechanic.";
  }

  // Hospital
  if (text.includes("hospital") || text.includes("hospitalized") || text.includes("injured")) {
    return "Hospital blocks active content — jobs, travel, market, academies. Education continues. Emergency discharge is available if you can't wait. The timer expires on its own otherwise. Try not to end up there repeatedly.";
  }

  // Housing / property
  if (text.includes("housing") || text.includes("home") || text.includes("property") || text.includes("upgrade")) {
    return "Property affects Comfort regen. Seven tiers, from a shack to something considerably less miserable. Upgrades stack. Gold is the bottleneck. Start small, reinvest consistently.";
  }

  // Registration
  if (text.includes("register") || text.includes("account") || text.includes("create")) {
    return "First name, last name. That's it. No class selection — what you become in Nexis is a product of what you do, not what you pick from a menu on day one. Your identity is earned.";
  }

  // What to do / next steps
  if (text.includes("what should i do") || text.includes("what next") || text.includes("where to start") || text.includes("first")) {
    return "In order of priority: ensure your stats are regenerating, start an education course if you haven't, run jobs to build category levels and gather materials, and invest gold in property when you can afford to upgrade. Everything else builds on those four things.";
  }

  // Spirits
  if (text.includes("spirit")) {
    return "Spirit binding is a long-term system. Three tiers per element — Wisp, Spirit, Elder. The smallest takes 3 months to maximise, the middle 6, the largest 12. It's not fast. It's not supposed to be. Patience is the mechanic.";
  }

  // Western branch / permanent lock
  if (text.includes("western") || text.includes("westmarch")) {
    return "Westmarch is the Western branch. Order, law, shadow operations. The academy there is a permanent commitment — switching away requires real currency, and you can only do it once every 30 days. Think carefully before you bind yourself to that path.";
  }

  // Professions
  if (text.includes("profession")) {
    return "Nexis Professions is always active alongside your chosen academy. It's practical — crafting, trade, services. Materials from your jobs feed into it directly. It's not glamorous, but it's functional, and functional things tend to matter more over time.";
  }

  // Fallback
  return "Processed. I don't have a specific answer for that yet — either because the system isn't wired, or because you asked something genuinely ambiguous. Try being more specific. Or don't. I'll still be here.";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCiel(options: UseCielOptions = {}) {
  const location = useLocation();
  const pathname = location.pathname;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CielMessage[]>(() => [
    {
      id: "ciel-intro",
      role: "ciel",
      text: "CIEL online. Parallel cognition active. Ask what you need — I'll answer honestly, which is more than most things in this world will do for you.",
      timestamp: Date.now(),
    },
  ]);

  const pageExplanation = useMemo(
    () => buildPageExplanation(options.pageTitle),
    [options.pageTitle]
  );

  const openCiel  = () => setIsOpen(true);
  const closeCiel = () => setIsOpen(false);
  const toggleCiel = () => setIsOpen((prev) => !prev);

  const explainPage = () => {
    const next: CielMessage = {
      id: `ciel-page-${Date.now()}`,
      role: "ciel",
      text: pageExplanation,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, next]);
    setIsOpen(true);
  };

  const sendPlayerMessage = (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    const playerMessage: CielMessage = {
      id: `player-${Date.now()}`,
      role: "player",
      text: clean,
      timestamp: Date.now(),
    };

    const cielReply: CielMessage = {
      id: `ciel-${Date.now() + 1}`,
      role: "ciel",
      text: buildReply(clean, options.pageTitle),
      timestamp: Date.now() + 1,
    };

    setMessages((prev) => [...prev, playerMessage, cielReply]);
    setIsOpen(true);
  };

  const clearMessages = () => {
    setMessages([
      {
        id: "ciel-intro-reset",
        role: "ciel",
        text: "Cleared. Short memory by design — I don't keep sentiment, only function. Ask again.",
        timestamp: Date.now(),
      },
    ]);
  };

  const latestMessage = messages[messages.length - 1]?.text ?? "";

  return {
    isOpen,
    pathname,
    latestMessage,
    messages,
    openCiel,
    closeCiel,
    toggleCiel,
    explainPage,
    sendPlayerMessage,
    clearMessages,
    // aliases used by Ciel.tsx
    open: isOpen,
    ask: sendPlayerMessage,
  };
}
