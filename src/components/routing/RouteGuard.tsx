import { Navigate, useLocation } from "react-router-dom";
import { usePlayer } from "../../state/PlayerContext";
import { getTravelProgress, readTravelStateFromPlayer } from "../../lib/travelState";

const BLOCKED_WHILE_HOSPITALIZED = new Set([
  "/education",
  "/adventure",
  "/jobs",
  "/civic-jobs",
  "/salvage-yard",
  "/travel",
  "/city",
  "/market",
  "/black-market",
  "/bank",
  "/academies",
  "/life-paths",
]);

const BLOCKED_WHILE_JAILED = new Set([
  "/education",
  "/adventure",
  "/jobs",
  "/travel",
  "/city",
  "/salvage-yard",
  "/market",
  "/black-market",
  "/bank",
  "/civic-jobs",
  "/academies",
  "/life-paths",
]);

const BLOCKED_WHILE_TRAVELING = new Set([
  "/education",
  "/adventure",
  "/jobs",
  "/arena",
  "/city",
  "/salvage-yard",
  "/market",
  "/black-market",
  "/bank",
  "/civic-jobs",
  "/guilds",
  "/consortiums",
  "/housing",
  "/academies",
  "/life-paths",
]);

export default function RouteGuard({ children }: { children: JSX.Element }) {
  const { player, now, isHospitalized, isJailed } = usePlayer();
  const location = useLocation();
  const isTraveling = getTravelProgress(readTravelStateFromPlayer(player), now).active;

  if (isHospitalized && BLOCKED_WHILE_HOSPITALIZED.has(location.pathname)) {
    return <Navigate to="/hospital" replace state={{ redirectedFrom: location.pathname }} />;
  }

  if (isJailed && BLOCKED_WHILE_JAILED.has(location.pathname)) {
    return <Navigate to="/hospital" replace state={{ redirectedFrom: location.pathname }} />;
  }

  if (isTraveling && BLOCKED_WHILE_TRAVELING.has(location.pathname)) {
    return <Navigate to="/travel" replace state={{ redirectedFrom: location.pathname }} />;
  }

  return children;
}
