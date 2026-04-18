import { AppShell } from "./AppShell";
import { ContentPanel } from "./ContentPanel";

type PlaceholderPageProps = {
  title: string;
  hint?: string;
  description?: string;
  bullets?: string[];
};

export function PlaceholderPage({ title, hint, description, bullets = [] }: PlaceholderPageProps) {
  return (
    <AppShell
      title={title}
      hint={hint ?? "This route is active, stable, and ready for a fuller system pass when that feature moves up the queue."}
    >
      <div className="placeholder-wrap">
        <ContentPanel title={title}>
          <div className="placeholder-box">
            <div className="placeholder-box__title">System staging</div>
            <p>
              {description ??
                "This page stays visible so navigation does not break, but the deeper mechanics are still being assembled."}
            </p>
            {bullets.length ? (
              <ul className="placeholder-list">
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </ContentPanel>
      </div>
    </AppShell>
  );
}
