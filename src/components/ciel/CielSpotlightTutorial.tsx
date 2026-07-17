import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cielHomeTourSteps } from "../../data/cielTutorialData";
import { nowIso, readCielTutorialState, shouldRunHomeSpotlight, updateCielTutorialState } from "../../lib/cielTutorialState";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";
import "../../styles/ciel.css";

type Rect = { left: number; top: number; width: number; height: number };

function panelByTitle(title: string) {
  return [...document.querySelectorAll<HTMLElement>(".panel")].find((panel) =>
    panel.querySelector(".panel__header h2")?.textContent?.trim() === title,
  ) ?? null;
}

function resolveTarget(step: (typeof cielHomeTourSteps)[number]) {
  if (step.panelTitle) return panelByTitle(step.panelTitle);
  return step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
}

function rectFromElement(element: HTMLElement | null): Rect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: Math.max(8, rect.left - 6),
    top: Math.max(8, rect.top - 6),
    width: Math.min(window.innerWidth - 16, rect.width + 12),
    height: Math.min(window.innerHeight - 16, rect.height + 12),
  };
}

export default function CielSpotlightTutorial() {
  const { activeAccount } = useAuth();
  const { player } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();
  const [manualDismissed, setManualDismissed] = useState(false);
  const tutorial = readCielTutorialState(player);
  const queryRequested = new URLSearchParams(location.search).get("ciel") === "spotlight";
  const shouldRun = location.pathname === "/home" && !manualDismissed && (shouldRunHomeSpotlight(player) || queryRequested);
  const initialIndex = useMemo(() => {
    if (queryRequested) return 0;
    const lastStep = tutorial.lastStepId ? cielHomeTourSteps.findIndex((step) => step.id === tutorial.lastStepId) : -1;
    return lastStep >= 0 && lastStep < cielHomeTourSteps.length - 1 ? lastStep + 1 : 0;
  }, [queryRequested, tutorial.lastStepId]);
  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const step = cielHomeTourSteps[stepIndex] ?? cielHomeTourSteps[0];

  useEffect(() => {
    if (queryRequested) {
      setManualDismissed(false);
    }
  }, [queryRequested]);

  useEffect(() => {
    if (!shouldRun) return;
    setStepIndex(initialIndex);
  }, [initialIndex, shouldRun]);

  useEffect(() => {
    if (!shouldRun) return undefined;

    function updateTarget() {
      const target = resolveTarget(step);
      target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      window.setTimeout(() => setTargetRect(rectFromElement(resolveTarget(step))), 160);
    }

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [shouldRun, step]);

  if (!shouldRun || !activeAccount?.email) return null;

  function persistStep(nextIndex: number) {
    if (!activeAccount?.email) return;
    const completed = new Set(tutorial.completedStepIds ?? []);
    completed.add(step.id);
    updateCielTutorialState(activeAccount.email, {
      spotlightPending: "true",
      lastStepId: cielHomeTourSteps[nextIndex]?.id ?? step.id,
      completedStepIds: [...completed],
    });
  }

  function previous() {
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function next() {
    if (!activeAccount?.email) return;
    if (stepIndex < cielHomeTourSteps.length - 1) {
      const nextIndex = stepIndex + 1;
      persistStep(nextIndex);
      setStepIndex(nextIndex);
      return;
    }
    updateCielTutorialState(activeAccount.email, {
      spotlightPending: "false",
      spotlightCompletedAt: nowIso(),
      lastStepId: step.id,
      completedStepIds: cielHomeTourSteps.map((entry) => entry.id),
    });
    setManualDismissed(true);
    navigate("/home", { replace: true });
  }

  function skip() {
    if (!activeAccount?.email) return;
    updateCielTutorialState(activeAccount.email, {
      spotlightPending: "false",
      spotlightSkippedAt: nowIso(),
      lastStepId: step.id,
    });
    setManualDismissed(true);
    navigate("/home", { replace: true });
  }

  const bubbleStyle = targetRect
    ? {
        left: Math.min(window.innerWidth - 344, Math.max(16, targetRect.left + targetRect.width + 14)),
        top: Math.min(window.innerHeight - 240, Math.max(16, targetRect.top)),
      }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  const spotlightStyle = targetRect
    ? { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }
    : { left: "50%", top: "50%", width: 280, height: 180, transform: "translate(-50%, -50%)" };

  return (
    <div className="ciel-tour" role="dialog" aria-modal="true" aria-label="CIEL guided tutorial">
      <div className="ciel-tour__spotlight" style={spotlightStyle} aria-hidden="true" />
      <section className="ciel-tour__bubble" style={bubbleStyle}>
        <div className="ciel-tour__eyebrow">CIEL guide {stepIndex + 1} / {cielHomeTourSteps.length}</div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="ciel-tour__actions">
          <button type="button" onClick={previous} disabled={stepIndex === 0}>Previous</button>
          <button type="button" className="ciel-tour__primary" onClick={next}>{stepIndex === cielHomeTourSteps.length - 1 ? "Finish" : "Next"}</button>
          {step.route && step.route !== "/home" ? <Link to={step.route}>{step.cta ?? "Open"}</Link> : null}
          <button type="button" onClick={skip}>Skip tutorial</button>
        </div>
      </section>
    </div>
  );
}