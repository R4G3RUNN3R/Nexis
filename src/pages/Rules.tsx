import PublicPageShell from "../components/layout/PublicPageShell";

const gameOffenses = [
  {
    title: "Real money trading",
    body: "Trading Nexis currency, items, accounts, services, or advantages for real-world money, goods, or services is forbidden. Gains made through these deals will be removed and severe bans may follow without warning.",
  },
  {
    title: "Account trading or sharing",
    body: "Your account is yours to operate. Selling it, giving it away, or letting another person play it for you undermines progression integrity and puts the account at risk of suspension or deletion.",
  },
  {
    title: "Exploit abuse",
    body: "If you discover a bug, exploit, or unintended gain loop, report it. Using it repeatedly, teaching it to others, or hiding it for profit is treated as deliberate abuse.",
  },
  {
    title: "Multiple accounts",
    body: "One player, one account. Alternate accounts used to funnel wealth, scout, manipulate markets, or pad progression are prohibited.",
  },
  {
    title: "Automation and scripting abuse",
    body: "Tools that automate gameplay, scrape hidden data, bypass intended inputs, or generate unattended actions are not allowed unless explicitly permitted by the game systems.",
  },
];

const socialRules = [
  "No hate speech, threats, or targeted harassment.",
  "No impersonation of staff, moderators, or other players.",
  "No phishing, account theft, or requests for passwords or security codes.",
  "No spam, flooding, or off-topic advertising in public channels.",
  "Do not post obscene or graphically extreme material in shared spaces.",
  "Respect staff instructions when moderation or safety intervention happens.",
];

export default function RulesPage() {
  return (
    <PublicPageShell
      title="Nexis Rules"
      subtitle="A world built on freedom still needs boundaries. These rules protect progression, player trust, and the long-term health of the shard."
    >
      <section className="public-panel">
        <div className="public-panel__header">Game offenses and punishments</div>
        <div className="public-panel__body">
          <div className="public-card-grid">
            {gameOffenses.map((item) => (
              <article key={item.title} className="public-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Social conduct</div>
        <div className="public-panel__body">
          <ul className="public-rule-list">
            {socialRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Design principle</div>
        <div className="public-panel__body">
          Nexis allows harsh choices inside the game world. It does not allow behavior that damages account integrity, player safety, or the fairness of progression. If a system is locked, the game will tell players why it is locked and what education or requirement unlocks it.
        </div>
      </section>
    </PublicPageShell>
  );
}
