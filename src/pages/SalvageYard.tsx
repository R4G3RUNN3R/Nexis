import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";

const SALVAGE_TABLE = [
  { itemId: "scrap_metal", itemName: "Scrap Metal", qty: 2, weight: 28 },
  { itemId: "rough_wood", itemName: "Rough Wood", qty: 2, weight: 24 },
  { itemId: "wild_herb", itemName: "Wild Herb", qty: 2, weight: 20 },
  { itemId: "empty_vials", itemName: "Empty Vials", qty: 2, weight: 16 },
  { itemId: "iron_parts", itemName: "Iron Parts", qty: 1, weight: 7 },
  { itemId: "medicinal_herb", itemName: "Medicinal Herb", qty: 1, weight: 3 },
  { itemId: "lore_fragment", itemName: "Lore Fragment", qty: 1, weight: 1 },
] as const;

function rollSalvage() {
  const totalWeight = SALVAGE_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of SALVAGE_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return SALVAGE_TABLE[0];
}

export default function SalvageYardPage() {
  const { player, spendEnergy, addItem } = usePlayer();
  const [result, setResult] = useState<string>("Nothing searched yet.");

  function handleSearch() {
    if (player.stats.energy < 5) return;
    const found = rollSalvage();
    spendEnergy(5);
    addItem(found.itemId, found.qty);
    setResult(`You spent 5 energy and found ${found.itemName} x${found.qty}.`);
  }

  return (
    <AppShell
      title="Salvage Yard"
      hint="Spend 5 energy digging through the city's discarded junk for minor items and the occasional lucky pull."
    >
      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title="Scavenge">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                Most finds are junk. Occasionally the junk is someone else's problem in a useful shape.
              </div>
              <div className="info-row">
                <span className="info-row__label">Energy Cost</span>
                <span className="info-row__value">5 per search</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">Current Energy</span>
                <span className="info-row__value">{Math.floor(player.stats.energy)} / {player.stats.maxEnergy}</span>
              </div>
              <button type="button" onClick={handleSearch} disabled={player.stats.energy < 5}>
                {player.stats.energy < 5 ? "Need More Energy" : "Search the Yard"}
              </button>
            </div>
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Latest Result">
            <div style={{ color: "#d7dee6" }}>{result}</div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
