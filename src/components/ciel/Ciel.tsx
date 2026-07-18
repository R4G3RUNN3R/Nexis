import { useMemo, useState } from "react";
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

export default function Ciel() {
  const location = useLocation();
  const pageTitle = useMemo(() => pageTitleFromPath(location.pathname), [location.pathname]);
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 96 : 1200,
    y: typeof window !== "undefined" ? window.innerHeight - 120 : 700,
  });

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
        position={position}
        onMove={setPosition}
        onClick={open ? closeCiel : openCiel}
        title="CIEL - Cognitive inference and evaluation layer"
      />

      <CielDialogue
        open={open}
        position={position}
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
