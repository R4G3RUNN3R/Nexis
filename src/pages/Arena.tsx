import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";

export default function ArenaPage() {
  return (
    <AppShell
      title="Arena"
      hint="Arena access is temporarily under maintenance while the training flow is being stabilized. The shell remains active so the page does not fail for normal players."
    >
      <div className="nexis-grid">
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header">
              <h2>Arena Under Maintenance</h2>
            </div>
            <div className="panel__body">
              <p>
                The arena training system is being rebuilt to prevent the black-screen failure that was occurring for live users.
              </p>
              <p>
                Until the full arena flow is restored, players can continue progressing through Adventure, Civic Jobs, Education, Travel, and the City systems.
              </p>
            </div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header">
              <h2>Recommended Alternatives</h2>
            </div>
            <div className="panel__body">
              <div className="info-list">
                <div className="info-row">
                  <span className="info-row__label">Adventure</span>
                  <span className="info-row__value info-row__value--accent"><Link className="inline-route-link" to="/adventure">Open</Link></span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Civic Jobs</span>
                  <span className="info-row__value info-row__value--accent"><Link className="inline-route-link" to="/civic-jobs">Open</Link></span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">City</span>
                  <span className="info-row__value info-row__value--accent"><Link className="inline-route-link" to="/city">Open</Link></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
