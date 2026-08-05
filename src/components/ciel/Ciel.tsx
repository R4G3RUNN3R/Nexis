import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import CielOrb from "./CielOrb";
import CielDialogue from "./CielDialogue";
import { useCiel } from "../../hooks/useCiel";
import "../../styles/ciel.css";

const PAGE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/profile": "Profile",
  "/inventory": "Inventory",
  "/crafting": "Crafting",
  "/education": "Education",
  "/skills": "Skills",
  "/adventure": "Adventure",
  "/one-shots": "One-Shots",
  "/life-paths": "Life Paths",
  "/city": "City",
  "/city-board": "City Board",
  "/travel": "Travel",
  "/world-map": "World Map",
  "/codex": "Codex",
  "/wiki": "Wiki",
  "/achievements": "Legacy",
  "/guilds": "Guilds",
  "/consortiums": "Consortiums",
  "/market": "Market",
  "/black-market": "Black Market",
  "/hospital": "Hospital",
};

function pageTitleFromPath(pathname: string) {
  if (pathname.startsWith("/profile/")) return "Profile";
  if (pathname.startsWith("/guilds/")) return "Guilds";
  if (pathname.startsWith("/consortiums/")) return "Consortiums";
  return (PAGE_TITLES[pathname] ?? pathname.replace(/^\//, "").replace(/-/g, " ")) || "Home";
}

// CIEL is docked to a fixed viewport corner (see .ciel-orb-anchor /
// .ciel-dialogue in ciel.css) instead of being freely draggable, so it can
// never end up parked on top of page content.
export default function Ciel() {
  const location = useLocation();
  const pageTitle = useMemo(() => pageTitleFromPath(location.pathname), [location.pathname]);

  const {
    pathname,
    open,
    latestMessage,
    messages,
    openCiel,
    closeCiel,
    clearMessages,
    ask,
  } = useCiel({ pageTitle });

  return (
    <>
      <CielOrb
        open={open}
        onClick={open ? closeCiel : openCiel}
        title="CIEL - Cognitive inference and evaluation layer"
      />

      <CielDialogue
        open={open}
        pathname={pathname}
        latestMessage={latestMessage}
        messages={messages}
        onClose={closeCiel}
        onClear={clearMessages}
        onAsk={(question) => ask(question)}
      />
    </>
  );
}
