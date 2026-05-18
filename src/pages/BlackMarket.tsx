import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_OPTIONS } from "../data/itemsData";
import {
  buyServerBlackMarketItem,
  getServerBlackMarket,
  sellServerBlackMarketItem,
  type ServerCityBlackMarket,
  type ServerCityEconomyStock,
  type ServerCitySellOffer,
} from "../lib/authApi";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

function getQuantity(itemId: string, quantities: Record<string, number>, max = 99) {
  return Math.max(1, Math.min(max, Math.floor(Number(quantities[itemId] ?? 1) || 1)));
}

function getItemName(itemId: string, item?: { displayName?: string } | null) {
  return item?.displayName ?? ITEM_OPTIONS.find((option) => option.itemId === itemId)?.name ?? itemId;
}

function UnderMarketStockCard({
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
  const disabled = busy || !entry.canBuy;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{getItemName(entry.itemId, entry.item)}</strong>
        <span>{entry.price.toLocaleString("en-GB")} gold</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.description || entry.item?.shortDescription}</div>
      {entry.item?.flavorText ? <div style={{ color: "#8293a3", fontSize: 12 }}>{entry.item.flavorText}</div> : null}
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Source: {entry.source} | Tier: {entry.tier} | Rarity: {entry.item?.rarity ?? "common"}</div>
      {entry.item?.effectSummary?.length ? <div style={{ color: "#d8c278", fontSize: 12 }}>{entry.item.effectSummary.slice(0, 3).join(" | ")}</div> : null}
      {entry.item?.iconKey ? <div style={{ color: "#748494", fontSize: 11 }}>Icon: {entry.item.iconKey} | {entry.item.iconSilhouette}</div> : null}
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

function UnderMarketSellCard({
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
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{getItemName(offer.itemId, offer.item)}</strong>
        <span>{offer.unitPrice.toLocaleString("en-GB")} gold each</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{offer.note ?? offer.item?.shortDescription ?? "Fence quote."}</div>
      {offer.item?.flavorText ? <div style={{ color: "#8293a3", fontSize: 12 }}>{offer.item.flavorText}</div> : null}
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Owned: {offer.ownedQuantity} | Standing required: {offer.minimumStanding ?? 0}</div>
      {offer.requiredCourses.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Requires: {offer.requiredCourses.join(" | ")}</div> : null}
      {offer.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{offer.lockReason}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>
          Quantity
          <input type="number" min={1} max={Math.max(1, offer.ownedQuantity)} value={quantity} onChange={(event) => onQuantityChange(offer.itemId, event.target.value, offer.ownedQuantity)} style={{ width: 72 }} />
        </label>
        <button type="button" disabled={disabled} onClick={() => onSell(offer.itemId)}>
          {busy ? "Fencing..." : `Fence ${quantity} (${(offer.unitPrice * quantity).toLocaleString("en-GB")} gold)`}
        </button>
      </div>
    </div>
  );
}

export default function BlackMarketPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const [blackMarket, setBlackMarket] = useState<ServerCityBlackMarket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBlackMarket() {
      setMessage(null);
      if (authSource !== "server" || !serverSessionToken) {
        setBlackMarket(null);
        setError("Sign in through the live server session to inspect under-market access.");
        return;
      }
      setLoading(true);
      setError(null);
      const result = await getServerBlackMarket(serverSessionToken, cityHub.cityId);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setBlackMarket(null);
        setError(result.error);
        return;
      }
      setBlackMarket(result.blackMarket);
    }
    void loadBlackMarket();
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
    const result = await buyServerBlackMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBlackMarket(result.blackMarket);
    setMessage(result.message ?? "Under-market purchase completed.");
    await refreshServerState();
  }

  async function sellItem(itemId: string) {
    if (!serverSessionToken || !blackMarket) return;
    const offer = blackMarket.sellOffers.find((entry) => entry.itemId === itemId);
    const quantity = getQuantity(itemId, sellQuantities, offer?.ownedQuantity ?? 1);
    setBusyItem(`sell:${itemId}`);
    setMessage(null);
    setError(null);
    const result = await sellServerBlackMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBlackMarket(result.blackMarket);
    setMessage(result.message ?? "Under-market sale completed.");
    await refreshServerState();
  }

  const isOpen = Boolean(blackMarket?.canOpen);

  return (
    <AppShell title="Black Market" hint={isOpen ? `${blackMarket?.name} in ${cityHub.displayName}.` : `Underworld access in ${cityHub.displayName} is locked or limited.`}>
      {loading ? <ContentPanel title="Under-Market Notice"><strong>Checking local under-market...</strong></ContentPanel> : null}
      {error ? <ContentPanel title="Under-Market Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Under-Market Notice"><strong>{message}</strong></ContentPanel> : null}

      <ContentPanel title={isOpen ? blackMarket?.name ?? "Under-Market" : "Locked Underworld Access"}>
        {blackMarket ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">{blackMarket.summary}</p>
            <div className="info-row"><span className="info-row__label">Standing required</span><span className="info-row__value">{blackMarket.minimumStanding}</span></div>
            <div className="info-row"><span className="info-row__label">Required courses</span><span className="info-row__value">{blackMarket.requiredCourses.length ? blackMarket.requiredCourses.join(", ") : "None"}</span></div>
            {!blackMarket.canOpen ? <div style={{ color: "#d0ad74", fontSize: 13 }}>{blackMarket.lockReason}</div> : null}
            {blackMarket.canOpen ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>Access open. Buying and fencing remain city-local and server verified.</div> : null}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="page-intro__lead">{cityHub.services.blackMarket.lockReason ?? "This city's under-market is not open yet."}</p>
            <Link to="/city" className="inline-route-link">Return to city hub</Link>
          </div>
        )}
      </ContentPanel>

      {blackMarket ? (
        <div className="page-intro-grid">
          <ContentPanel title="Under-Market Stock">
            <div style={{ display: "grid", gap: 10 }}>
              <div className="info-row"><span className="info-row__label">Available Gold</span><span className="info-row__value">{player.gold.toLocaleString("en-GB")} gold</span></div>
              {blackMarket.stock.map((entry) => (
                <UnderMarketStockCard
                  key={entry.itemId}
                  entry={entry}
                  quantity={getQuantity(entry.itemId, buyQuantities)}
                  busy={busyItem === `buy:${entry.itemId}`}
                  onQuantityChange={updateBuyQuantity}
                  onBuy={buyItem}
                />
              ))}
            </div>
          </ContentPanel>
          <ContentPanel title="Fence Offers">
            <div style={{ display: "grid", gap: 10 }}>
              {!blackMarket.sellOffers.length ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No carried goods match this city's under-market buyers.</div> : null}
              {blackMarket.sellOffers.map((offer) => (
                <UnderMarketSellCard
                  key={offer.itemId}
                  offer={offer}
                  quantity={getQuantity(offer.itemId, sellQuantities, offer.ownedQuantity)}
                  busy={busyItem === `sell:${offer.itemId}`}
                  onQuantityChange={updateSellQuantity}
                  onSell={sellItem}
                />
              ))}
            </div>
          </ContentPanel>
        </div>
      ) : null}
    </AppShell>
  );
}
