import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { cielIntroSteps } from "../../data/cielTutorialData";
import { nowIso, readCielTutorialState, updateCielTutorialState } from "../../lib/cielTutorialState";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";
import "../../styles/ciel.css";

export default function CielIntroPage() {
  const { activeAccount } = useAuth();
  const { player } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const tutorial = readCielTutorialState(player);
  const step = cielIntroSteps[index] ?? cielIntroSteps[0];
  const state = location.state && typeof location.state === "object" ? location.state as { afterTutorial?: unknown } : {};
  const requestedAfterTutorial = typeof state.afterTutorial === "string" && state.afterTutorial.startsWith("/") ? state.afterTutorial : "/home";
  const afterTutorial = requestedAfterTutorial.startsWith("/login") || requestedAfterTutorial.startsWith("/register") ? "/home" : requestedAfterTutorial;
  const spotlightDestination = afterTutorial === "/home" || afterTutorial.startsWith("/home?") ? "/home?ciel=spotlight" : afterTutorial;

  useEffect(() => {
    if (!activeAccount?.email || tutorial.introSeenAt || tutorial.skippedAt || tutorial.introCompletedAt) return;
    updateCielTutorialState(activeAccount.email, { introSeenAt: nowIso() });
  }, [activeAccount?.email, tutorial.introCompletedAt, tutorial.introSeenAt, tutorial.skippedAt]);

  if (!activeAccount?.email) return <Navigate to="/login" replace />;
  if (tutorial.introCompletedAt || tutorial.skippedAt) return <Navigate to="/home" replace />;

  function skipTutorial() {
    if (!activeAccount?.email) return;
    updateCielTutorialState(activeAccount.email, {
      skippedAt: nowIso(),
      spotlightSkippedAt: nowIso(),
      spotlightPending: "false",
      lastStepId: step.id,
    });
    navigate(afterTutorial, { replace: true });
  }

  function nextStep() {
    if (!activeAccount?.email) return;
    if (index < cielIntroSteps.length - 1) {
      setIndex((value) => value + 1);
      return;
    }

    updateCielTutorialState(activeAccount.email, {
      introCompletedAt: nowIso(),
      spotlightPending: "true",
      lastStepId: "home-spotlight-start",
    });
    navigate(spotlightDestination, { replace: true });
  }

  return (
    <main className="ciel-intro-screen" aria-label="CIEL introduction">
      <div className="ciel-intro-grid" aria-hidden="true" />
      <section className="ciel-intro-card">
        <div className="ciel-intro-orb" aria-hidden="true">
          <span className="ciel-orb-shell">
            <span className="ciel-orb-core" />
            <span className="ciel-orb-ring ciel-orb-ring--one" />
            <span className="ciel-orb-ring ciel-orb-ring--two" />
            <span className="ciel-orb-spark ciel-orb-spark--one" />
            <span className="ciel-orb-spark ciel-orb-spark--two" />
          </span>
        </div>
        <div className="ciel-intro-eyebrow">CIEL initiation {index + 1} / {cielIntroSteps.length}</div>
        <h1>{step.title}</h1>
        <p>{step.body}</p>
        <div className="ciel-intro-aside">{step.aside}</div>
        <div className="ciel-intro-progress" aria-label="Tutorial progress">
          {cielIntroSteps.map((entry, stepIndex) => (
            <span key={entry.id} className={stepIndex <= index ? "ciel-intro-progress__dot ciel-intro-progress__dot--active" : "ciel-intro-progress__dot"} />
          ))}
        </div>
        <div className="ciel-intro-actions">
          <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Previous</button>
          <button type="button" className="ciel-intro-actions__primary" onClick={nextStep}>{index === cielIntroSteps.length - 1 ? "Open command surface" : "Next"}</button>
          <button type="button" onClick={skipTutorial}>Skip tutorial</button>
        </div>
      </section>
    </main>
  );
}