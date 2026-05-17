import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getCityHubContent } from "../data/cityHubData";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

export default function BlackMarketPage() {
  const { player } = usePlayer();
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const blackMarket = cityHub.services.blackMarket;
  const isOpen = blackMarket.status === "open";

  return (
    <AppShell title="Black Market" hint={isOpen ? `Underdock trade pressure in ${cityHub.displayName}.` : `Underworld access in ${cityHub.displayName} is locked.`}>
      <ContentPanel title={isOpen ? `${cityHub.displayName} Undermarket` : "Locked Underworld Access"}>
        {isOpen ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">Blackharbor's underdock brokers move potion imports, sealed cargo, and risky whispers.</p>
            <p className="page-intro__body">
              Only broker notices and risk identity are open right now. Deeper smuggling contracts require later Street Survival progress and route contacts.
            </p>
            <div className="info-row">
              <span className="info-row__label">Pressure</span>
              <span className="info-row__value">Smuggling, cargo escorts, and potion imports</span>
            </div>
            <div className="info-row">
              <span className="info-row__label">Progression</span>
              <span className="info-row__value">Street Survival and World Geography will deepen this route later</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">{blackMarket.lockReason ?? "This city's under-market is not open yet."}</p>
            <p className="page-intro__body">Travel to Blackharbor for the first live under-market surface, or progress through shady education paths as they unlock.</p>
            <Link to="/city" className="inline-route-link">Return to city hub</Link>
          </div>
        )}
      </ContentPanel>
    </AppShell>
  );
}
