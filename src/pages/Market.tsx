import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_OPTIONS } from "../data/itemsData";
import { buyServerCityMarketItem, getServerCityMarket, type ServerCityEconomyStock, type ServerCityMarket } from "../lib/authApi";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

function getBuyQuantity(itemId: string, quantities: Record<string, number>) {
  return Math.max(1, Math.min(99, Math.floor(Number(quantities[itemId] ?? 1) || 1)));
}

function StockCard({
  entry,
  quantity,
  busy,
  onQuantityChange,
  onBuy,
}: {
  entry: ServerCityEconomyStock;
  quantity: number;
  busy: boolean;
  onQuantityChange: (itemId: string, value: string) => void;
  onBuy: (itemId: string) => void;
}) {
  const item = ITEM_OPTIONS.find((option) => option.itemId === entry.itemId);
  const disabled = busy || !entry.canBuy;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{item?.name ?? entry.itemId}</strong>
        <span>{entry.price.toLocaleString("en-GB")} gold</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.description || item?.description || "Local vendor stock."}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Source: {entry.source} | Tier: {entry.tier}</div>
      {entry.minimumStanding > 0 || entry.requiredCourses.length ? (
        <div style={{ color: "#9fb0bf", fontSize: 12 }}>
          Unlocks: {entry.minimumStanding > 0 ? `${entry.minimumStanding} standing` : "open"}{entry.requiredCourses.length ? ` | ${entry.requiredCourses.join(" | ")}` : ""}
        </div>
      ) : null}
      {entry.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{entry.lockReason}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>
          Quantity
          <input type="number" min={1} max={99} value={quantity} onChange={(event) => onQuantityChange(entry.itemId, event.target.value)} style={{ width: 72 }} />
        </label>
        <button type="button" disabled={disabled} onClick={() => onBuy(entry.itemId)}>
          {busy ? "Buying..." : `Buy ${quantity} (${(entry.price * quantity).toLocaleString("en-GB")} gold)`}
        </button>
      </div>
    </div>
  );
}

export default function MarketPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const [market, setMarket] = useState<ServerCityMarket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMarket() {
      setMessage(null);
      if (authSource !== "server" || !serverSessionToken) {
        setMarket(null);
        setError("Sign in through the live server session to use server-backed city markets.");
        return;
      }
      setLoading(true);
      setError(null);
      const result = await getServerCityMarket(serverSessionToken, cityHub.cityId);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setMarket(null);
        setError(result.error);
        return;
      }
      setMarket(result.market);
    }
    void loadMarket();
    return () => {
      cancelled = true;
    };
  }, [authSource, cityHub.cityId, serverSessionToken]);

  function updateBuyQuantity(itemId: string, rawValue: string) {
    const nextQuantity = Math.max(1, Math.min(99, Math.floor(Number(rawValue) || 1)));
    setBuyQuantities((current) => ({ ...current, [itemId]: nextQuantity }));
  }

  async function buyItem(itemId: string) {
    if (!serverSessionToken) return;
    const quantity = getBuyQuantity(itemId, buyQuantities);
    setBusyItem(itemId);
    setMessage(null);
    setError(null);
    const result = await buyServerCityMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMarket(result.market);
    setMessage(result.message ?? "Purchase completed.");
    await refreshServerState();
  }

  const stock = useMemo(() => market?.stock ?? [], [market]);

  return (
    <AppShell title={market?.name ?? cityHub.services.market.label} hint={`Legal trade and vendor stock in ${cityHub.displayName}.`}>
      <div className="page-intro-grid">
        <ContentPanel title={market?.name ?? cityHub.market.name}>
          <p className="page-intro__lead">{market?.summary ?? cityHub.market.summary}</p>
          <div className="info-row"><span className="info-row__label">Imports</span><span className="info-row__value">{(market?.imports ?? cityHub.market.imports).join(", ")}</span></div>
          <div className="info-row"><span className="info-row__label">Exports</span><span className="info-row__value">{(market?.exports ?? cityHub.market.exports).join(", ")}</span></div>
        </ContentPanel>
        <ContentPanel title="Market Access">
          <p className="page-intro__body">Stock, prices, and standing locks are city-specific and verified by the live server.</p>
          {market?.discountPercent ? <p className="page-intro__body">Civic provisioner discount active: {market.discountPercent}% off legal market prices.</p> : null}
        </ContentPanel>
      </div>

      {loading ? <ContentPanel title="Market Notice"><strong>Loading city stock...</strong></ContentPanel> : null}
      {error ? <ContentPanel title="Market Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Market Notice"><strong>{message}</strong></ContentPanel> : null}

      <ContentPanel title="Vendor Stock">
        <div style={{ display: "grid", gap: 12 }}>
          <div className="info-row"><span className="info-row__label">Available Gold</span><span className="info-row__value">{player.gold.toLocaleString("en-GB")} gold</span></div>
          {!stock.length && !loading ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No live stock is available for this city right now.</div> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {stock.map((entry) => (
              <StockCard
                key={entry.itemId}
                entry={entry}
                quantity={getBuyQuantity(entry.itemId, buyQuantities)}
                busy={busyItem === entry.itemId}
                onQuantityChange={updateBuyQuantity}
                onBuy={buyItem}
              />
            ))}
          </div>
        </div>
      </ContentPanel>
    </AppShell>
  );
}
