import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_OPTIONS } from "../data/itemsData";
import {
  buyServerCityMarketItem,
  getServerCityMarket,
  sellServerCityMarketItem,
  type ServerCityEconomyStock,
  type ServerCityMarket,
  type ServerCitySellOffer,
  type ServerTradeOpportunity,
} from "../lib/authApi";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

type MarketTab = "buy" | "sell";

function getQuantity(itemId: string, quantities: Record<string, number>, max = 99) {
  return Math.max(1, Math.min(max, Math.floor(Number(quantities[itemId] ?? 1) || 1)));
}

function getItemName(itemId: string, item?: { displayName?: string } | null) {
  return item?.displayName ?? ITEM_OPTIONS.find((option) => option.itemId === itemId)?.name ?? itemId;
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
  const localItem = ITEM_OPTIONS.find((option) => option.itemId === entry.itemId);
  const item = entry.item;
  const disabled = busy || !entry.canBuy;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={item} /><strong>{getItemName(entry.itemId, item)}</strong></span>
        <span>{entry.price.toLocaleString("en-GB")} gold</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.description || item?.shortDescription || localItem?.description || "Local vendor stock."}</div>
      {item?.flavorText ? <div style={{ color: "#8293a3", fontSize: 12 }}>{item.flavorText}</div> : null}
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Source: {entry.source} | Tier: {entry.tier} | Rarity: {item?.rarity ?? "common"}</div>
      {item?.effectSummary?.length ? <div style={{ color: "#d8c278", fontSize: 12 }}>{item.effectSummary.slice(0, 3).join(" | ")}</div> : null}
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

function SellCard({
  offer,
  quantity,
  busy,
  onQuantityChange,
  onSell,
}: {
  offer: ServerCitySellOffer;
  quantity: number;
  busy: boolean;
  onQuantityChange: (itemId: string, value: string, max: number) => void;
  onSell: (itemId: string) => void;
}) {
  const disabled = busy || !offer.canSell;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={offer.item} /><strong>{getItemName(offer.itemId, offer.item)}</strong></span>
        <span>{offer.unitPrice.toLocaleString("en-GB")} gold each</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{offer.note ?? offer.item?.shortDescription ?? "Local buyer quote."}</div>
      {offer.item?.flavorText ? <div style={{ color: "#8293a3", fontSize: 12 }}>{offer.item.flavorText}</div> : null}
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Owned: {offer.ownedQuantity} | Source: {offer.sourceCityName ?? "Unknown"} | Category: {offer.category ?? "Trade good"}</div>
      {offer.bestDestination ? (
        <div style={{ color: "#d8c278", fontSize: 12 }}>Best visible buyer: {offer.bestDestination.cityName} at {offer.bestDestination.price.toLocaleString("en-GB")} gold</div>
      ) : null}
      {offer.requiredCourses.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Requires: {offer.requiredCourses.join(" | ")}</div> : null}
      {offer.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{offer.lockReason}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>
          Quantity
          <input type="number" min={1} max={Math.max(1, offer.ownedQuantity)} value={quantity} onChange={(event) => onQuantityChange(offer.itemId, event.target.value, offer.ownedQuantity)} style={{ width: 72 }} />
        </label>
        <button type="button" disabled={disabled} onClick={() => onSell(offer.itemId)}>
          {busy ? "Selling..." : `Sell ${quantity} (${(offer.unitPrice * quantity).toLocaleString("en-GB")} gold)`}
        </button>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: ServerTradeOpportunity }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 10, background: "rgba(7,13,20,0.48)", display: "grid", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={opportunity.item} /><strong>{getItemName(opportunity.itemId, opportunity.item)}</strong></span>
        <span style={{ color: opportunity.expectedMargin > 0 ? "#8ec8a7" : "#d0ad74" }}>+{opportunity.expectedMargin.toLocaleString("en-GB")} gold</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>Buy here for {opportunity.buyPrice} gold, sell in {opportunity.bestSellCityName} for {opportunity.bestSellPrice} gold.</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>{opportunity.note}</div>
      {opportunity.item?.shortDescription ? <div style={{ color: "#8293a3", fontSize: 12 }}>{opportunity.item.shortDescription}</div> : null}
      {opportunity.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{opportunity.lockReason}</div> : null}
    </div>
  );
}

export default function MarketPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const [market, setMarket] = useState<ServerCityMarket | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>("buy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
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

  function updateSellQuantity(itemId: string, rawValue: string, max: number) {
    const nextQuantity = Math.max(1, Math.min(Math.max(1, max), Math.floor(Number(rawValue) || 1)));
    setSellQuantities((current) => ({ ...current, [itemId]: nextQuantity }));
  }

  async function buyItem(itemId: string) {
    if (!serverSessionToken) return;
    const quantity = getQuantity(itemId, buyQuantities);
    setBusyItem(`buy:${itemId}`);
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

  async function sellItem(itemId: string) {
    if (!serverSessionToken || !market) return;
    const offer = market.sellOffers.find((entry) => entry.itemId === itemId);
    const quantity = getQuantity(itemId, sellQuantities, offer?.ownedQuantity ?? 1);
    setBusyItem(`sell:${itemId}`);
    setMessage(null);
    setError(null);
    const result = await sellServerCityMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMarket(result.market);
    setMessage(result.message ?? "Sale completed.");
    await refreshServerState();
  }

  const stock = useMemo(() => market?.stock ?? [], [market]);
  const sellOffers = useMemo(() => market?.sellOffers ?? [], [market]);
  const opportunities = useMemo(() => market?.tradeOpportunities ?? [], [market]);

  return (
    <AppShell title={market?.name ?? cityHub.services.market.label} hint={`Legal trade and vendor stock in ${cityHub.displayName}.`}>
      <div className="page-intro-grid">
        <ContentPanel title={market?.name ?? cityHub.market.name}>
          <p className="page-intro__lead">{market?.summary ?? cityHub.market.summary}</p>
          <div className="info-row"><span className="info-row__label">Imports</span><span className="info-row__value">{(market?.imports ?? cityHub.market.imports).join(", ")}</span></div>
          <div className="info-row"><span className="info-row__label">Exports</span><span className="info-row__value">{(market?.exports ?? cityHub.market.exports).join(", ")}</span></div>
        </ContentPanel>
        <ContentPanel title="Trade Ledger">
          <p className="page-intro__body">Buy prices, sell quotes, and route opportunities are city-specific and server verified.</p>
          <div className="info-row"><span className="info-row__label">Cargo carried</span><span className="info-row__value">{market?.cargoSummary.carriedTradeGoods ?? 0} trade goods</span></div>
          <div className="info-row"><span className="info-row__label">Local liquidation</span><span className="info-row__value">{(market?.cargoSummary.currentCityLiquidationValue ?? 0).toLocaleString("en-GB")} gold</span></div>
          {market?.sellBonusPercent ? <p className="page-intro__body">Education sell bonus active: +{market.sellBonusPercent}%.</p> : null}
          {market?.discountPercent ? <p className="page-intro__body">Civic provisioner discount active: {market.discountPercent}% off legal market prices.</p> : null}
        </ContentPanel>
      </div>

      {loading ? <ContentPanel title="Market Notice"><strong>Loading city stock...</strong></ContentPanel> : null}
      {error ? <ContentPanel title="Market Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Market Notice"><strong>{message}</strong></ContentPanel> : null}

      <ContentPanel title="Trade Opportunities">
        <div style={{ display: "grid", gap: 10 }}>
          {!opportunities.length ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>No profitable route hints are visible from this city right now.</div> : null}
          {opportunities.map((opportunity) => <OpportunityCard key={`${opportunity.itemId}:${opportunity.bestSellCityId}`} opportunity={opportunity} />)}
        </div>
      </ContentPanel>

      <ContentPanel title="Market Board">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setActiveTab("buy")} aria-pressed={activeTab === "buy"}>Buy</button>
            <button type="button" onClick={() => setActiveTab("sell")} aria-pressed={activeTab === "sell"}>Sell</button>
          </div>
          <div className="info-row"><span className="info-row__label">Available Gold</span><span className="info-row__value">{player.gold.toLocaleString("en-GB")} gold</span></div>
          {activeTab === "buy" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {!stock.length && !loading ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No live stock is available for this city right now.</div> : null}
              {stock.map((entry) => (
                <StockCard
                  key={entry.itemId}
                  entry={entry}
                  quantity={getQuantity(entry.itemId, buyQuantities)}
                  busy={busyItem === `buy:${entry.itemId}`}
                  onQuantityChange={updateBuyQuantity}
                  onBuy={buyItem}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {!sellOffers.length ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No carried legal trade goods are being quoted by this city.</div> : null}
              {sellOffers.map((offer) => (
                <SellCard
                  key={offer.itemId}
                  offer={offer}
                  quantity={getQuantity(offer.itemId, sellQuantities, offer.ownedQuantity)}
                  busy={busyItem === `sell:${offer.itemId}`}
                  onQuantityChange={updateSellQuantity}
                  onSell={sellItem}
                />
              ))}
            </div>
          )}
        </div>
      </ContentPanel>
    </AppShell>
  );
}
