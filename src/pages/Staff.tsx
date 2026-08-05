import { useEffect, useState } from "react";
import PublicPageShell from "../components/layout/PublicPageShell";
import { getSiteStaff, type ServerStaffEntry } from "../lib/authApi";

export default function StaffPage() {
  const [staff, setStaff] = useState<ServerStaffEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSiteStaff();
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setStaff(result.staff);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicPageShell
      title="Staff"
      subtitle="The citizens who keep Nexis's shard running: rule enforcement, support, and the systems behind the curtain."
    >
      <section className="public-panel">
        <div className="public-panel__header">Current roster</div>
        <div className="public-panel__body">
          {failed ? (
            <p>Staff roster is unavailable right now. Try again shortly.</p>
          ) : staff === null ? (
            <p>Loading roster.</p>
          ) : staff.length ? (
            <div className="public-credits-grid">
              {staff.map((entry) => (
                <article key={entry.publicId} className="public-credit-card">
                  <div className="public-credit-card__meta">{entry.roleLabel}</div>
                  <h3>{entry.name}</h3>
                  <h4>P{entry.publicId}</h4>
                </article>
              ))}
            </div>
          ) : (
            <p>No staff accounts on record yet.</p>
          )}
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Reporting an issue</div>
        <div className="public-panel__body">
          Rule violations, bugs, or abuse reports go through the <a href="/contact">Contact</a> page. Staff act on reports directly - there is no separate ticket queue yet.
        </div>
      </section>
    </PublicPageShell>
  );
}
