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
      hint={hint ?? "This destination is reserved, but its deeper mechanics are not open yet."}
    >
      <div className="placeholder-wrap">
        <ContentPanel title={title}>
          <div className="placeholder-box">
            <div className="placeholder-box__title">Coming Soon</div>
            <p>
              {description ??
                "This destination is visible in the city, but its deeper mechanics are not open yet."}
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
