import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getCityHubContent } from "../data/cityHubData";
import { getCityBlackMarketDetail } from "../data/cityLoopData";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

export default function BlackMarketPage() {
  const { player } = usePlayer();
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const blackMarket = cityHub.services.blackMarket;
  const marketDetail = getCityBlackMarketDetail(travelState.currentCityId);
  const isOpen = blackMarket.status === "open";

  return (
    <AppShell title="Black Market" hint={isOpen ? `${marketDetail.name} in ${cityHub.displayName}.` : `Underworld access in ${cityHub.displayName} is locked.`}>
      <ContentPanel title={isOpen ? marketDetail.name : "Locked Underworld Access"}>
        {isOpen ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">{marketDetail.summary}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {marketDetail.notices.map((notice) => (
                <div key={notice.title} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 4 }}>
                  <strong>{notice.title}</strong>
                  <div style={{ color: "#b7c3cf", fontSize: 13 }}>{notice.detail}</div>
                  <div style={{ color: "#d0ad74", fontSize: 12 }}>Requirement: {notice.requirement}</div>
                </div>
              ))}
            </div>
            <div className="info-row">
              <span className="info-row__label">Progression</span>
              <span className="info-row__value">Street Survival and World Geography improve future under-market outcomes</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">{blackMarket.lockReason ?? "This city's under-market is not open yet."}</p>
            <p className="page-intro__body">{marketDetail.summary}</p>
            {marketDetail.notices.map((notice) => (
              <div key={notice.title} className="info-row">
                <span className="info-row__label">{notice.title}</span>
                <span className="info-row__value">{notice.requirement}</span>
              </div>
            ))}
            <Link to="/city" className="inline-route-link">Return to city hub</Link>
          </div>
        )}
      </ContentPanel>
    </AppShell>
  );
}
