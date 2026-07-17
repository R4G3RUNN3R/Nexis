import { Link } from "react-router-dom";
import type { PlayerCommandBrief } from "../../lib/playerGuideApi";

function statusLabel(status: string) {
  if (status === "complete") return "Done";
  if (status === "current") return "Active";
  if (status === "locked") return "Locked";
  return "Open";
}

export function CommandBrief({ brief }: { brief: PlayerCommandBrief | null }) {
  if (!brief) return null;

  return (
    <section className="command-brief" aria-label="Recommended orders">
      <div className="command-brief__lead">
        <div>
          <div className="command-brief__eyebrow">Recommended orders</div>
          <h2>{brief.primaryAction.label}</h2>
          <p>{brief.primaryAction.reason}</p>
          <span>{brief.phase} | {brief.summary}</span>
        </div>
        <Link className="command-brief__primary" to={brief.primaryAction.route}>
          {brief.primaryAction.cta}
        </Link>
      </div>

      <div className="command-brief__actions">
        {brief.nextActions.slice(0, 4).map((action) => (
          <Link key={action.id} to={action.route} className="command-brief__action">
            <strong>{action.label}</strong>
            <span>{action.reason}</span>
          </Link>
        ))}
      </div>

      <div className="command-brief__steps">
        {brief.firstSteps.map((step) => (
          <Link key={step.id} to={step.route} className={`command-brief__step command-brief__step--${step.status}`} title={step.detail}>
            <span>{statusLabel(step.status)}</span>
            <strong>{step.label}</strong>
          </Link>
        ))}
      </div>

      {brief.blockers.length ? (
        <div className="command-brief__blockers">
          {brief.blockers.map((blocker) => (
            <span key={blocker.id}>{blocker.label}: {blocker.detail}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
