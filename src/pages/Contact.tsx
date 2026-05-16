import PublicPageShell from "../components/layout/PublicPageShell";

export default function ContactPage() {
  return (
    <PublicPageShell
      title="Contact"
      subtitle="Support routes, moderation channels, and project communication points for Nexis."
    >
      <section className="public-panel">
        <div className="public-panel__header">Support channels</div>
        <div className="public-panel__body">
          <div className="public-contact-grid">
            <article className="public-contact-card">
              <h3>Account support</h3>
              <p>Use this channel for login trouble, access issues, progression blockers, or account recovery verification.</p>
              <ul className="public-bullet-list">
                <li>Email: support@nexis.nexus</li>
                <li>Include your character name and a brief description of the issue.</li>
              </ul>
            </article>
            <article className="public-contact-card">
              <h3>Rules and reports</h3>
              <p>Use this route for harassment reports, exploit reports, automation concerns, or suspected account abuse.</p>
              <ul className="public-bullet-list">
                <li>Email: reports@nexis.nexus</li>
                <li>Include screenshots, timestamps, and as much detail as possible.</li>
              </ul>
            </article>
            <article className="public-contact-card">
              <h3>Project and community</h3>
              <p>Use this for press, partnership, creator, or community inquiries about the project itself.</p>
              <ul className="public-bullet-list">
                <li>Email: hello@nexis.nexus</li>
                <li>For urgent moderation matters, use the rules and reports channel instead.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Response policy</div>
        <div className="public-panel__body">
          Support requests should contain enough detail to verify the issue without forcing staff to guess. Missing information slows response time. Reports made in good faith are always preferred to exploit silence.
        </div>
      </section>
    </PublicPageShell>
  );
}
