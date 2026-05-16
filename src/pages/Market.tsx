import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ITEM_OPTIONS } from "../data/itemsData";
import { worldCities } from "../data/worldMapData";
import { getActiveCivicJobPassives, normalizeCivicEmploymentState } from "../lib/civicJobsState";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

const MARKET_STOCK = [
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

export default function MarketPage() {
  const { player, spendGold, addItem } = usePlayer();
  const [message, setMessage] = useState<string | null>(null);
  const travelState = readTravelStateFromPlayer(player);
  const currentCity = worldCities.find((city) => city.id === travelState.currentCityId) ?? worldCities[0];
  const grocerDiscount = getActiveCivicJobPassives(normalizeCivicEmploymentState(player.current.civicEmployment)).market_discount ?? 0;
  const stock = useMemo(
    () =>
      MARKET_STOCK.map((entry) => ({
        ...entry,
        adjustedPrice: Math.max(1, Math.round(entry.price * (1 - grocerDiscount / 100))),
        item: ITEM_OPTIONS.find((item) => item.itemId === entry.itemId),
      })),
    [grocerDiscount],
  );

  function buyItem(itemId: string, price: number) {
    if (!spendGold(price)) {
      setMessage("Not enough gold. The market remains stubbornly attached to payment.");
      return;
    }
    addItem(itemId, 1);
    setMessage(`Purchased ${ITEM_OPTIONS.find((item) => item.itemId === itemId)?.name ?? "item"} for ${price} gold.`);
  }

  return (
    <AppShell title="Market" hint={`Legal trade and vendor stock in ${currentCity.name}. Regional goods will expand as routes and market identity deepen.`}>
      <div className="page-intro-grid">
        <ContentPanel title="Market Hall">
          <p className="page-intro__lead">The market hall lists legal goods, adventure tools, and current local pricing.</p>
          <p className="page-intro__body">
            Browse legal goods, stock up on adventure tools, and watch regional trade identity grow around your current city.
          </p>
        </ContentPanel>
        <ContentPanel title="Quartermaster Gossip">
          <p className="page-intro__body">
            Required-item adventures mean you can no longer rob a ruin with bare hands and optimism. Civilization remains difficult like that.
          </p>
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
                <div>
                  <button type="button" onClick={() => buyItem(entry.itemId, entry.adjustedPrice)}>
                    Buy Item
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
