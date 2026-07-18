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

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

function titleFromPath(pathname: string): string {
  if (pathname.startsWith("/profile/")) return "Profile";
  if (pathname.startsWith("/guilds/")) return "Guilds";
  if (pathname.startsWith("/consortiums/")) return "Consortiums";
  return pathname.replace(/^\//, "").replace(/-/g, " ") || "Home";
}

function buildPageExplanation(pageTitle?: string): string {
  const title = (pageTitle ?? "").toLowerCase();

  if (title.includes("home")) {
    return "Home. Where everything starts and most people stay too long. Your stats regen here same as everywhere else — Nexis doesn't pause because you're reading the dashboard. Check your Energy, Health, Stamina, Comfort. When they're not full, you're not optimal. Not that anyone is.";
  }

  if (title.includes("inventory")) {
    return "Inventory is where equipment, clothing, consumables, materials, recipes, manuals, and marketable goods stop being theory. Equipped and worn rows are highlighted. Expand an item before you do anything dramatic with it.";
  }

  if (title.includes("education")) {
    return "Education in Nexis is not optional. It unlocks systems, gates progression, and separates those who persist from those who don't. Courses run in real time. You don't get to pause them. Hospital doesn't stop them either, which is one of the few courtesies this world extends.";
  }

  if (title.includes("jobs")) {
    return "Adventure work covers contracts, expeditions, hidden-site runs, and fights that make your gear choices matter. Risk, damage type, rewards, and readiness all matter. Shocking, I know.";
  }

  if (title.includes("hospital")) {
    return "You're here, which means something went wrong. Hospital locks you out of most active content — jobs, travel, the market. Education continues, which is the one silver lining. Recovery is automatic when the timer expires. Emergency discharge is available if you'd rather be functional now than patient later.";
  }

  if (title.includes("travel")) {
    return "Travel owns movement. Nexis City, Blackharbor, Silverbough, Ironhall, and Highcourt each have their own routes, risks, academies, markets, and board notices. World Map is for atlas and discovery; Travel is where you actually depart.";
  }

  if (title.includes("housing")) {
    return "Where you live affects your Comfort regen. A shack keeps you alive. A manor keeps you comfortable. Upgrades compound the effect. Gold is the only barrier. Spend it well, or don't — Comfort recovers slowly either way.";
  }

  if (title.includes("academy") || title.includes("academies")) {
    return "Academy Study is separate from Education. Education unlocks civic, trade, travel, and covert systems; Academy Study develops city-linked specializations. You may run both at once. Try not to confuse the two just because both involve reading.";
  }

  if (title.includes("guild")) {
    return "Guilds are faction operations: members, armory, expeditions, dungeon runs, and shared legacy. Consortiums are companies: treasury, logistics, trade, espionage, and route work. Similar buttons, different ambitions.";
  }

  if (title.includes("consortium")) {
    return "Consortiums are companies: treasury, employees, logistics, trade routes, sabotage, and profit. Their one-shots pay the company legacy and treasury, not your personal Chronicle. Capitalism, but with more daggers.";
  }

  if (title.includes("one-shot")) {
    return "Nexis One-Shots are fixed-choice DMOS-backed chronicles. Personal runs record to your Chronicle. Guild and Consortium runs consume one token per participant and record to the organization legacy.";
  }

  if (title.includes("world map")) {
    return "World Map is the atlas and excursion layer. Search the grid, inspect distance, travel out, spend time on-site, then return. Recipes, fragments, materials, gold, and discovery records can all come from that loop.";
  }

  if (title.includes("codex")) {
    return "Codex holds long-form records, atlas notes, discoveries, manuals, and reference material. Action pages stay short because someone had to protect you from encyclopedia furniture.";
  }

  if (title.includes("wiki")) {
    return "Wiki is the practical manual for Nexis systems: progression, gates, travel, items, organizations, and what all these charmingly dense panels are trying to tell you.";
  }

  if (title.includes("legacy") || title.includes("achievement")) {
    return "Achievements award Legacy Points once. The Legacy tree spends those points permanently. No free refund button, because consequences are one of the core game loops.";
  }

  if (title.includes("profile")) {
    return "Your profile is a record. What you've done, how long you've been doing it, and what it's built. It doesn't judge. I do that.";
  }

  if (title.includes("city board")) {
    return "The City Board is the public layer of Nexis society — announcements, events, shared notices. Think of it as the wall everyone reads but few contribute to meaningfully.";
  }

  if (title.includes("life path")) {
    return "Life Paths are active identity tracks. They point you toward roles like Rogue, Scholar, Mercantile operator, civic servant, or combat specialist, then connect that identity to actions and records.";
  }

  if (title.includes("market")) {
    return "Markets convert inventory into leverage. City markets care about local demand, the player market cares about listings and buyers, and the black market cares whether you learned enough Street Survival to be worth the risk.";
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
    return "Gold comes from jobs, contracts, market sales, one-shots, and organization activity. Spend it on equipment, property, study, trade, and the occasional decision that looks wise only in retrospect.";
  }

  // Education
  if (text.includes("education") || text.includes("course") || text.includes("study")) {
    return "Education runs in real time. Pick a course, wait for it to finish, don't quit — quitting resets it. Hospital doesn't interrupt it. That's by design. Learn while you recover. It's more productive than just lying there.";
  }

  // Jobs
  if (text.includes("job") || text.includes("work")) {
    return "Adventure jobs and expeditions build XP, records, item flow, and achievements. Some are simple work. Some are fights. Some are mistakes with better branding.";
  }

  if (text.includes("chain")) {
    return "Consecutive successes build a chain. Each link adds a small gold multiplier. Break the chain — fail or crit-fail — and it resets. Simple enough, painful when it matters.";
  }

  if (text.includes("critical fail") || text.includes("crit fail") || text.includes("crit")) {
    return "Critical failures can hospitalize or jail you depending on the job. The chances drop as your category level rises. Below level 10, the training wheels are on — crit rates are artificially low. After that, you're on your own.";
  }

  // Travel / cities
  if (text.includes("travel") || text.includes("city") || text.includes("cities")) {
    return "Five cities anchor the realm: Nexis City, Blackharbor, Silverbough, Ironhall, and Highcourt. Travel takes time, can trigger discoveries, and supports route and cargo context. Plan ahead, or donate your afternoon to poor logistics.";
  }

  if (text.includes("academy") || text.includes("academics")) {
    return "City academies develop specialized study lines, while Education runs as the broader account backbone. The two systems can run together. That is intentional, not a scheduling accident.";
  }

  // Inventory
  if (text.includes("inventory") || text.includes("item") || text.includes("material") || text.includes("drop")) {
    return "Items come from contracts, excursions, discoveries, crafting, markets, one-shots, and rewards. Recipes and fragments matter. Expand item rows before selling or destroying anything rare, unless regret is your preferred tutorial.";
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

  if (text.includes("home tutorial")) {
    return "Open Home with the tutorial marker: /home?ciel=spotlight. I will highlight the command surface again, because repetition is cheaper than confusion.";
  }

  // What to do / next steps
  if (text.includes("what should i do") || text.includes("what next") || text.includes("where to start") || text.includes("first")) {
    return "Start with readiness: spend energy and stamina, keep Health safe, begin Education, choose or review a Life Path, then run contracts or excursions that match your gear. If you have Legacy Points, spend them carefully. Permanent means permanent, astonishingly.";
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
  const navigate = useNavigate();
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
    () => buildPageExplanation(options.pageTitle ?? titleFromPath(pathname)),
    [options.pageTitle, pathname]
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

    const shouldLaunchHomeTutorial = clean.toLowerCase().includes("home tutorial");

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
    if (shouldLaunchHomeTutorial) {
      window.setTimeout(() => navigate("/home?ciel=spotlight"), 60);
    }
  };

  useEffect(() => {
    function handleCielEvent(event: Event) {
      const detail = (event as CustomEvent<{ type?: string; payload?: unknown }>).detail;
      const payload = detail && typeof detail.payload === "object" && detail.payload !== null ? detail.payload as Record<string, unknown> : {};
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      const question = typeof payload.question === "string" ? payload.question.trim() : "";

      if (detail?.type === "home-spotlight") {
        const next: CielMessage = {
          id: `ciel-event-${Date.now()}`,
          role: "ciel",
          text: text || "Tutorial mode active. I will highlight the useful pieces first, because apparently dashboards do not explain themselves yet.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, next]);
        setIsOpen(true);
        return;
      }

      if (question) {
        sendPlayerMessage(question);
      }
    }

    window.addEventListener("ciel:ask", handleCielEvent as EventListener);
    return () => window.removeEventListener("ciel:ask", handleCielEvent as EventListener);
  }, [options.pageTitle]);

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
