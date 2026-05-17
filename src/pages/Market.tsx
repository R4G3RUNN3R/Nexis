import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_OPTIONS } from "../data/itemsData";
import { getActiveCivicJobPassives, normalizeCivicEmploymentState } from "../lib/civicJobsState";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

const BASE_MARKET_STOCK = [
  { itemId: "rations", price: 35 },
  { itemId: "rope", price: 55 },
  { itemId: "wild_herb", price: 25 },
  { itemId: "medicinal_herb", price: 65 },
  { itemId: "lockpick", price: 125 },
  { itemId: "vial_of_ink", price: 45 },
  { itemId: "leather_strip", price: 40 },
  { itemId: "iron_ore", price: 95 },
  { itemId: "herbalist_gloves", price: 85 },
  { itemId: "wood_axe", price: 140 },
  { itemId: "miners_pick", price: 175 },
  { itemId: "hunters_bow", price: 210 },
  { itemId: "lantern", price: 95 },
  { itemId: "shovel", price: 80 },
  { itemId: "lockpick_set", price: 260 },
  { itemId: "forged_seal_kit", price: 240 },
  { itemId: "courier_satchel", price: 120 },
  { itemId: "travel_cloak", price: 180 },
  { itemId: "enchanted_parchment", price: 160 },
  { itemId: "forged_document", price: 220 },
  { itemId: "smithing_hammer", price: 190 },
];

const CITY_FEATURED_STOCK: Record<string, Array<{ itemId: string; price: number }>> = {
  west: [
    { itemId: "healing_tonic", price: 145 },
    { itemId: "restorative_elixir", price: 360 },
    { itemId: "travel_cloak", price: 170 },
    { itemId: "lockpick_set", price: 250 },
    { itemId: "courier_satchel", price: 115 },
  ],
  north: [
    { itemId: "rare_herb", price: 150 },
    { itemId: "healing_root", price: 190 },
    { itemId: "enchanted_parchment", price: 150 },
    { itemId: "magic_tome", price: 410 },
    { itemId: "herbalist_gloves", price: 80 },
  ],
  east: [
    { itemId: "coal", price: 60 },
    { itemId: "iron_ingot", price: 160 },
    { itemId: "smithing_hammer", price: 180 },
    { itemId: "steel_ingot", price: 280 },
    { itemId: "iron_rivets", price: 90 },
  ],
  south: [
    { itemId: "vial_of_ink", price: 42 },
    { itemId: "wax_seal", price: 70 },
    { itemId: "forged_seal_kit", price: 230 },
    { itemId: "courier_satchel", price: 125 },
    { itemId: "prestige_goods", price: 500 },
  ],
};

function getLocalStock(cityId: string) {
  const featured = CITY_FEATURED_STOCK[cityId] ?? [];
  const featuredIds = new Set(featured.map((entry) => entry.itemId));
  return [...featured, ...BASE_MARKET_STOCK.filter((entry) => !featuredIds.has(entry.itemId))];
}

export default function MarketPage() {
  const { player, spendGold, addItem } = usePlayer();
  const [message, setMessage] = useState<string | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const travelState = readTravelStateFromPlayer(player);
  const cityHub = getCityHubContent(travelState.currentCityId);
  const grocerDiscount = getActiveCivicJobPassives(normalizeCivicEmploymentState(player.current.civicEmployment)).market_discount ?? 0;
  const stock = useMemo(
    () =>
      getLocalStock(cityHub.cityId).map((entry) => ({
        ...entry,
        adjustedPrice: Math.max(1, Math.round(entry.price * (1 - grocerDiscount / 100))),
        item: ITEM_OPTIONS.find((item) => item.itemId === entry.itemId),
      })),
    [cityHub.cityId, grocerDiscount],
  );

  function getBuyQuantity(itemId: string) {
    return Math.max(1, Math.min(99, Math.floor(Number(buyQuantities[itemId] ?? 1) || 1)));
  }

  function updateBuyQuantity(itemId: string, rawValue: string) {
    const nextQuantity = Math.max(1, Math.min(99, Math.floor(Number(rawValue) || 1)));
    setBuyQuantities((current) => ({ ...current, [itemId]: nextQuantity }));
  }

  function buyItem(itemId: string, price: number) {
    const quantity = getBuyQuantity(itemId);
    const totalPrice = price * quantity;
    if (!spendGold(totalPrice)) {
      setMessage(`Not enough gold for ${quantity} item${quantity === 1 ? "" : "s"}. Total needed: ${totalPrice} gold.`);
      return;
    }
    addItem(itemId, quantity);
    const itemName = ITEM_OPTIONS.find((item) => item.itemId === itemId)?.name ?? "item";
    setMessage(`Purchased ${itemName} x${quantity} for ${totalPrice} gold.`);
  }

  return (
    <AppShell title={cityHub.services.market.label} hint={`Legal trade and vendor stock in ${cityHub.displayName}.`}>
      <div className="page-intro-grid">
        <ContentPanel title={cityHub.market.name}>
          <p className="page-intro__lead">{cityHub.market.summary}</p>
          <div className="info-row">
            <span className="info-row__label">Imports</span>
            <span className="info-row__value">{cityHub.market.imports.join(", ")}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">Exports</span>
            <span className="info-row__value">{cityHub.market.exports.join(", ")}</span>
          </div>
        </ContentPanel>
        <ContentPanel title="Regional Stock Identity">
          <p className="page-intro__body">Featured goods: {cityHub.market.featuredGoods.join(", ")}.</p>
          <p className="page-intro__body">The first rows below are city-weighted stock; common legal goods remain available after them.</p>
        </ContentPanel>
      </div>

      {message ? (
        <ContentPanel title="Market Notice">
          <strong>{message}</strong>
        </ContentPanel>
      ) : null}

      <ContentPanel title="Vendor Stock">
        <div style={{ display: "grid", gap: 12 }}>
          <div className="info-row">
            <span className="info-row__label">Available Gold</span>
            <span className="info-row__value">{player.gold.toLocaleString("en-GB")} gold</span>
          </div>
          {grocerDiscount > 0 ? (
            <div className="info-row">
              <span className="info-row__label">Grocer Special</span>
              <span className="info-row__value">Bulk Buyer active ({grocerDiscount}% off legal market prices)</span>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {stock.map((entry) => (
              <div
                key={entry.itemId}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: 12,
                  background: "rgba(10,14,19,0.62)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{entry.item?.name ?? "Uncatalogued Stock"}</strong>
                  <span>
                    {entry.adjustedPrice} gold
                    {entry.adjustedPrice !== entry.price ? ` (down from ${entry.price})` : ""}
                  </span>
                </div>
                <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.item?.description ?? "Vendor stock item."}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#b7c3cf", fontSize: 13 }}>
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={getBuyQuantity(entry.itemId)}
                      onChange={(event) => updateBuyQuantity(entry.itemId, event.target.value)}
                      style={{ width: 72 }}
                    />
                  </label>
                  <button type="button" onClick={() => buyItem(entry.itemId, entry.adjustedPrice)}>
                    Buy {getBuyQuantity(entry.itemId)} ({(entry.adjustedPrice * getBuyQuantity(entry.itemId)).toLocaleString("en-GB")} gold)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ContentPanel>
    </AppShell>
  );
}
