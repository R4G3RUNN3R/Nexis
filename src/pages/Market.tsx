import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_OPTIONS } from "../data/itemsData";
import {
  buyServerCityMarketItem,
  buyServerMarketplaceListing,
  cancelServerMarketplaceListing,
  createServerMarketplaceListing,
  getServerCityMarket,
  getServerMarketplace,
  sellServerCityMarketItem,
  type ServerCityEconomyStock,
  type ServerCityMarket,
  type ServerCitySellOffer,
  type ServerInventoryEntry,
  type ServerMarketplaceListing,
  type ServerMarketplacePayload,
  type ServerTradeOpportunity,
} from "../lib/authApi";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

type MarketTab = "buy" | "sell" | "marketplace";

function getQuantity(itemId: string, quantities: Record<string, number>, max = 99) {
  return Math.max(1, Math.min(max, Math.floor(Number(quantities[itemId] ?? 1) || 1)));
}

function getItemName(itemId: string, item?: { displayName?: string } | null) {
  return item?.displayName ?? ITEM_OPTIONS.find((option) => option.itemId === itemId)?.name ?? itemId;
}

function DemandStrip({ market }: { market: ServerCityMarket | null }) {
  const demand = market?.demand;
  if (!demand) return null;
  return (
    <ContentPanel title="City Demand">
      <div className="info-list">
        <div className="info-row"><span className="info-row__label">Demand</span><span className="info-row__value">{demand.headline ?? demand.highDemand?.join(", ") ?? "Baseline goods"}</span></div>
        <div className="info-row"><span className="info-row__label">Shortages</span><span className="info-row__value">{demand.shortages?.join(", ") || demand.surplus?.join(", ") || "None posted"}</span></div>
        <div className="info-row"><span className="info-row__label">Tags</span><span className="info-row__value">{demand.tags?.join(" | ") || "General"}</span></div>
        <div style={{ color: "#9fb0bf", fontSize: 12 }}>{demand.note ?? "Local buyers publish only the useful bits. Miraculous restraint."}</div>
      </div>
    </ContentPanel>
  );
}

function StockCard({ entry, quantity, busy, onQuantityChange, onBuy }: { entry: ServerCityEconomyStock; quantity: number; busy: boolean; onQuantityChange: (itemId: string, value: string) => void; onBuy: (itemId: string) => void }) {
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
      {entry.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{entry.lockReason}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>Quantity<input type="number" min={1} max={99} value={quantity} onChange={(event) => onQuantityChange(entry.itemId, event.target.value)} style={{ width: 72 }} /></label>
        <button type="button" disabled={disabled} onClick={() => onBuy(entry.itemId)}>{busy ? "Buying..." : `Buy ${quantity} (${(entry.price * quantity).toLocaleString("en-GB")} gold)`}</button>
      </div>
    </div>
  );
}

function SellCard({ offer, quantity, busy, onQuantityChange, onSell }: { offer: ServerCitySellOffer; quantity: number; busy: boolean; onQuantityChange: (itemId: string, value: string, max: number) => void; onSell: (itemId: string) => void }) {
  const disabled = busy || !offer.canSell;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={offer.item} /><strong>{getItemName(offer.itemId, offer.item)}</strong></span>
        <span>{offer.unitPrice.toLocaleString("en-GB")} gold each</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{offer.note ?? offer.item?.shortDescription ?? "Local buyer quote."}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Owned: {offer.ownedQuantity} | Source: {offer.sourceCityName ?? "Unknown"} | Category: {offer.category ?? "Trade good"}</div>
      {offer.bestDestination ? <div style={{ color: "#d8c278", fontSize: 12 }}>Best visible buyer: {offer.bestDestination.cityName} at {offer.bestDestination.price.toLocaleString("en-GB")} gold</div> : null}
      {offer.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{offer.lockReason}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>Quantity<input type="number" min={1} max={Math.max(1, offer.ownedQuantity)} value={quantity} onChange={(event) => onQuantityChange(offer.itemId, event.target.value, offer.ownedQuantity)} style={{ width: 72 }} /></label>
        <button type="button" disabled={disabled} onClick={() => onSell(offer.itemId)}>{busy ? "Selling..." : `Sell ${quantity} (${(offer.unitPrice * quantity).toLocaleString("en-GB")} gold)`}</button>
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
    </div>
  );
}

function ListingCard({ listing, busy, onBuy, onCancel }: { listing: ServerMarketplaceListing; busy: boolean; onBuy: (listingId: string) => void; onCancel: (listingId: string) => void }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={listing.item} /><strong>{getItemName(listing.itemId, listing.item)}</strong></span>
        <span>{listing.totalPrice.toLocaleString("en-GB")} gold</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{listing.item?.shortDescription ?? "Citizen-posted market lot."}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Qty {listing.quantity} | {listing.unitPrice.toLocaleString("en-GB")} each | {listing.cityName} | Seller P{listing.seller.publicId} | {listing.status}</div>
      {listing.demandHeadline ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{listing.demandHeadline}</div> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {listing.isOwnListing ? <button type="button" disabled={busy} onClick={() => onCancel(listing.id)}>{busy ? "Cancelling..." : "Cancel listing"}</button> : <button type="button" disabled={busy} onClick={() => onBuy(listing.id)}>{busy ? "Buying..." : "Buy listing"}</button>}
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
  const [marketplace, setMarketplace] = useState<ServerMarketplacePayload | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>("buy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [listingItemId, setListingItemId] = useState("");
  const [listingQuantity, setListingQuantity] = useState(1);
  const [listingPrice, setListingPrice] = useState(25);
  const [listingFilter, setListingFilter] = useState("all");
  const [listingRarity, setListingRarity] = useState("all");
  const [listingType, setListingType] = useState("all");
  const [listingSource, setListingSource] = useState("all");
  const [listingSort, setListingSort] = useState("price_asc");
  const [listingStatus, setListingStatus] = useState("active");

  async function loadMarketplace() {
    if (authSource !== "server" || !serverSessionToken) { setMarketplace(null); return; }
    const result = await getServerMarketplace(serverSessionToken, { category: listingFilter === "all" ? undefined : listingFilter, rarity: listingRarity === "all" ? undefined : listingRarity, type: listingType === "all" ? undefined : listingType, sourceCity: listingSource === "all" ? undefined : listingSource, sort: listingSort, status: listingStatus });
    if (result.ok) setMarketplace(result.marketplace);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadMarket() {
      setMessage(null);
      if (authSource !== "server" || !serverSessionToken) {
        setMarket(null);
        setMarketplace(null);
        setError("Sign in through the live server session to use server-backed city markets.");
        return;
      }
      setLoading(true);
      setError(null);
      const [marketResult, marketplaceResult] = await Promise.all([getServerCityMarket(serverSessionToken, cityHub.cityId), getServerMarketplace(serverSessionToken, { category: listingFilter === "all" ? undefined : listingFilter, rarity: listingRarity === "all" ? undefined : listingRarity, type: listingType === "all" ? undefined : listingType, sourceCity: listingSource === "all" ? undefined : listingSource, sort: listingSort, status: listingStatus })]);
      if (cancelled) return;
      setLoading(false);
      if (!marketResult.ok) { setMarket(null); setError(marketResult.error); } else setMarket(marketResult.market);
      if (marketplaceResult.ok) setMarketplace(marketplaceResult.marketplace);
    }
    void loadMarket();
    return () => { cancelled = true; };
  }, [authSource, cityHub.cityId, listingFilter, listingRarity, listingType, listingSource, listingSort, listingStatus, serverSessionToken]);

  function updateBuyQuantity(itemId: string, rawValue: string) { setBuyQuantities((current) => ({ ...current, [itemId]: Math.max(1, Math.min(99, Math.floor(Number(rawValue) || 1))) })); }
  function updateSellQuantity(itemId: string, rawValue: string, max: number) { setSellQuantities((current) => ({ ...current, [itemId]: Math.max(1, Math.min(Math.max(1, max), Math.floor(Number(rawValue) || 1))) })); }

  async function buyItem(itemId: string) {
    if (!serverSessionToken) return;
    const quantity = getQuantity(itemId, buyQuantities);
    setBusyItem(`buy:${itemId}`); setMessage(null); setError(null);
    const result = await buyServerCityMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) { setError(result.error); return; }
    setMarket(result.market); setMessage(result.message ?? "Purchase completed."); await refreshServerState();
  }

  async function sellItem(itemId: string) {
    if (!serverSessionToken || !market) return;
    const offer = market.sellOffers.find((entry) => entry.itemId === itemId);
    const quantity = getQuantity(itemId, sellQuantities, offer?.ownedQuantity ?? 1);
    setBusyItem(`sell:${itemId}`); setMessage(null); setError(null);
    const result = await sellServerCityMarketItem(serverSessionToken, cityHub.cityId, itemId, quantity);
    setBusyItem(null);
    if (!result.ok) { setError(result.error); return; }
    setMarket(result.market); setMessage(result.message ?? "Sale completed."); await refreshServerState();
  }

  async function createListing() {
    if (!serverSessionToken || !listingItemId) { setError("Choose an item before listing it."); return; }
    setBusyItem("marketplace:create"); setMessage(null); setError(null);
    const result = await createServerMarketplaceListing(serverSessionToken, { itemId: listingItemId, quantity: listingQuantity, unitPrice: listingPrice, cityId: cityHub.cityId });
    setBusyItem(null);
    if (!result.ok) { setError(result.error); return; }
    setMarketplace(result.marketplace); setMessage(result.message ?? "Listing posted."); await refreshServerState();
  }

  async function buyListing(listingId: string) {
    if (!serverSessionToken) return;
    setBusyItem(`listing:${listingId}`); setMessage(null); setError(null);
    const result = await buyServerMarketplaceListing(serverSessionToken, listingId);
    setBusyItem(null);
    if (!result.ok) { setError(result.error); return; }
    setMarketplace(result.marketplace); setMessage(result.message ?? "Listing purchased."); await refreshServerState();
  }

  async function cancelListing(listingId: string) {
    if (!serverSessionToken) return;
    setBusyItem(`listing:${listingId}`); setMessage(null); setError(null);
    const result = await cancelServerMarketplaceListing(serverSessionToken, listingId);
    setBusyItem(null);
    if (!result.ok) { setError(result.error); return; }
    setMarketplace(result.marketplace); setMessage(result.message ?? "Listing cancelled."); await refreshServerState();
  }

  const stock = useMemo(() => market?.stock ?? [], [market]);
  const sellOffers = useMemo(() => market?.sellOffers ?? [], [market]);
  const opportunities = useMemo(() => market?.tradeOpportunities ?? [], [market]);
  const inventory = useMemo(() => (marketplace?.inventory ?? []).filter((entry: ServerInventoryEntry) => entry.quantity > 0), [marketplace]);
  const listings = marketplace?.listings ?? [];
  const ownListings = marketplace?.ownListings ?? [];
  const recentActivity = marketplace?.recentActivity ?? [];
  const priceGuide = marketplace?.priceGuide ?? [];

  return (
    <AppShell title={market?.name ?? cityHub.services.market.label} hint={`Legal trade, route demand, and citizen listings in ${cityHub.displayName}.`}>
      <div className="page-intro-grid">
        <ContentPanel title={market?.name ?? cityHub.market.name}>
          <p className="page-intro__lead">{market?.summary ?? cityHub.market.summary}</p>
          <div className="info-row"><span className="info-row__label">Imports</span><span className="info-row__value">{(market?.imports ?? cityHub.market.imports).join(", ")}</span></div>
          <div className="info-row"><span className="info-row__label">Exports</span><span className="info-row__value">{(market?.exports ?? cityHub.market.exports).join(", ")}</span></div>
        </ContentPanel>
        <ContentPanel title="Trade Ledger">
          <p className="page-intro__body">Buy prices, sell quotes, player listings, and route opportunities are server verified.</p>
          <div className="info-row"><span className="info-row__label">Cargo carried</span><span className="info-row__value">{market?.cargoSummary.carriedTradeGoods ?? 0} trade goods</span></div>
          <div className="info-row"><span className="info-row__label">Local liquidation</span><span className="info-row__value">{(market?.cargoSummary.currentCityLiquidationValue ?? 0).toLocaleString("en-GB")} gold</span></div>
          {market?.sellBonusPercent ? <p className="page-intro__body">Education sell bonus active: +{market.sellBonusPercent}%.</p> : null}
        </ContentPanel>
      </div>

      {loading ? <ContentPanel title="Market Notice"><strong>Loading city stock...</strong></ContentPanel> : null}
      {error ? <ContentPanel title="Market Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Market Notice"><strong>{message}</strong></ContentPanel> : null}

      <DemandStrip market={market} />

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
            <button type="button" onClick={() => setActiveTab("marketplace")} aria-pressed={activeTab === "marketplace"}>Player Listings</button>
          </div>
          <div className="info-row"><span className="info-row__label">Available Gold</span><span className="info-row__value">{player.gold.toLocaleString("en-GB")} gold</span></div>
          {activeTab === "buy" ? <div style={{ display: "grid", gap: 10 }}>{!stock.length && !loading ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No live stock is available for this city right now.</div> : null}{stock.map((entry) => <StockCard key={entry.itemId} entry={entry} quantity={getQuantity(entry.itemId, buyQuantities)} busy={busyItem === `buy:${entry.itemId}`} onQuantityChange={updateBuyQuantity} onBuy={buyItem} />)}</div> : null}
          {activeTab === "sell" ? <div style={{ display: "grid", gap: 10 }}>{!sellOffers.length ? <div style={{ color: "#d0ad74", fontSize: 13 }}>No carried legal trade goods are being quoted by this city.</div> : null}{sellOffers.map((offer) => <SellCard key={offer.itemId} offer={offer} quantity={getQuantity(offer.itemId, sellQuantities, offer.ownedQuantity)} busy={busyItem === `sell:${offer.itemId}`} onQuantityChange={updateSellQuantity} onSell={sellItem} />)}</div> : null}
          {activeTab === "marketplace" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(7,13,20,0.48)", display: "grid", gap: 10 }}>
                <strong>Create fixed-price listing</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={listingItemId} onChange={(event) => setListingItemId(event.target.value)}>
                    <option value="">Choose carried item</option>
                    {inventory.map((entry) => <option key={entry.itemId} value={entry.itemId}>{getItemName(entry.itemId, entry.item)} x{entry.quantity}</option>)}
                  </select>
                  <input type="number" min={1} max={99} value={listingQuantity} onChange={(event) => setListingQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} style={{ width: 72 }} />
                  <input type="number" min={1} value={listingPrice} onChange={(event) => setListingPrice(Math.max(1, Number(event.target.value) || 1))} style={{ width: 92 }} />
                  <button type="button" disabled={busyItem === "marketplace:create" || !listingItemId} onClick={createListing}>{busyItem === "marketplace:create" ? "Posting..." : "Post listing"}</button>
                </div>
                {!inventory.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>No eligible carried items available to list.</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: "#9fb0bf", fontSize: 12 }}>Filters</span>
                <select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)}>
                  <option value="all">All categories</option>
                  <option value="equipment">Equipment</option>
                  <option value="consumable">Consumables</option>
                  <option value="clothing">Clothing</option>
                  <option value="material">Materials</option>
                  <option value="trade_good">Trade goods</option>
                </select>
                <select value={listingType} onChange={(event) => setListingType(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="gear">Gear</option>
                  <option value="clothing">Clothing</option>
                  <option value="consumable">Consumables</option>
                  <option value="material">Materials</option>
                </select>
                <select value={listingRarity} onChange={(event) => setListingRarity(event.target.value)}>
                  <option value="all">All rarity</option>
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="legendary">Legendary</option>
                </select>
                <select value={listingSource} onChange={(event) => setListingSource(event.target.value)}>
                  <option value="all">All sources</option>
                  <option value="nexis">Nexis City</option>
                  <option value="blackharbor">Blackharbor</option>
                  <option value="silverbough">Silverbough</option>
                  <option value="ironhall">Ironhall</option>
                  <option value="highcourt">Highcourt</option>
                  <option value="neutral">Neutral</option>
                </select>
                <select value={listingStatus} onChange={(event) => setListingStatus(event.target.value)}>
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
                <select value={listingSort} onChange={(event) => setListingSort(event.target.value)}>
                  <option value="price_asc">Price low-high</option>
                  <option value="price_desc">Price high-low</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="rarity">Rarity</option>
                </select>
                <button type="button" onClick={loadMarketplace}>Refresh</button>
              </div>
              {priceGuide.length ? <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 10, background: "rgba(7,13,20,0.38)", display: "grid", gap: 6 }}><strong>Price guide</strong><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{priceGuide.slice(0, 6).map((guide) => <span key={guide.itemId} style={{ color: "#b7c3cf", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "3px 6px" }}>{getItemName(guide.itemId, guide.item)} avg {guide.averageUnitPrice.toLocaleString("en-GB")}g ({guide.totalQuantity} listed)</span>)}</div></div> : null}
              <div style={{ color: "#9fb0bf", fontSize: 12 }}>Own active listings: {ownListings.filter((listing) => listing.status === "active").length} | Recent closed: {recentActivity.length}</div>
              {!listings.length ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>No citizen listings match this filter.</div> : null}
              {listings.map((listing) => <ListingCard key={listing.id} listing={listing} busy={busyItem === `listing:${listing.id}`} onBuy={buyListing} onCancel={cancelListing} />)}
            </div>
          ) : null}
        </div>
      </ContentPanel>
    </AppShell>
  );
}
