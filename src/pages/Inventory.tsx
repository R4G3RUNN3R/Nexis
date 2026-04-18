import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import "../styles/inventory.css";

const ITEM_CATALOGUE: Record<string, { name: string; category: string; description: string }> = {
  wild_herb: { name: "Wild Herb", category: "Herb", description: "Common flora. Used in basic potion recipes." },
  medicinal_herb: {
    name: "Medicinal Herb",
    category: "Herb",
    description: "Useful for healing compounds. Sought by alchemists.",
  },
  healing_root: { name: "Healing Root", category: "Herb", description: "Rare root with potent restorative properties." },
  rough_wood: { name: "Rough Wood", category: "Material", description: "Unfinished timber. Useful for basic constructs." },
  hardwood: { name: "Hardwood", category: "Material", description: "Dense, quality wood. Valued by carpenters." },
  iron_ore: { name: "Iron Ore", category: "Ore", description: "Raw iron. Requires smelting before use." },
  coal: { name: "Coal", category: "Ore", description: "Fuel source used in forges and furnaces." },
  scrap_metal: { name: "Scrap Metal", category: "Material", description: "Salvaged metalwork. Can be repurposed." },
  leather_strip: { name: "Leather Strip", category: "Material", description: "Cured hide. Used in armour and binding." },
  rope: { name: "Rope", category: "Material", description: "Reliable cordage. Useful in a dozen trades." },
  ancient_fragment: {
    name: "Ancient Fragment",
    category: "Relic",
    description: "Piece of a ruined inscription. Scholars pay well.",
  },
  torn_map: { name: "Tattered Map", category: "Relic", description: "Part of an old map. The rest is somewhere out there." },
  stolen_coin: { name: "Stolen Coin", category: "Valuables", description: "Liberated from an inattentive pocket." },
  rare_gemstone: { name: "Rare Gemstone", category: "Valuables", description: "Uncut gem. Fence it or keep it." },
  forged_document: {
    name: "Forged Document",
    category: "Relic",
    description: "Convincingly fake. Useful for certain arrangements.",
  },
  lockpick: { name: "Lockpick", category: "Tool", description: "A good tool deserves a good cause." },
  rations: { name: "Rations", category: "Consumable", description: "Standard travel food. Better than nothing." },
  worn_boots: { name: "Worn Boots", category: "Equipment", description: "Seen better days. Still keeps the feet dry." },
  stone_block: { name: "Stone Block", category: "Material", description: "Cut stone. Essential for construction." },
  clay: { name: "Clay", category: "Material", description: "Raw clay. Used in ceramics and construction." },
  vial_of_ink: {
    name: "Vial of Ink",
    category: "Consumable",
    description: "High-quality ink. Useful for scribes and forgers alike.",
  },
  wax_seal: { name: "Wax Seal", category: "Tool", description: "Official-looking seal. Almost official." },
};

const CATEGORY_COLOUR: Record<string, string> = {
  Herb: "#4caf50",
  Ore: "#9e9e9e",
  Material: "#8d6e63",
  Relic: "#ab47bc",
  Valuables: "#ffd740",
  Consumable: "#26c6da",
  Tool: "#ff9800",
  Equipment: "#78909c",
};

function getCategoryColour(category: string): string {
  return CATEGORY_COLOUR[category] ?? "#546e7a";
}

export default function InventoryPage() {
  const { player } = usePlayer();
  const inventory = player.inventory ?? {};
  const [activeCategory, setActiveCategory] = useState("All");

  const entries = Object.entries(inventory)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => {
      const info = ITEM_CATALOGUE[itemId] ?? {
        name: itemId.replace(/_/g, " "),
        category: "Unknown",
        description: "An item of uncertain origin.",
      };

      return { itemId, quantity, ...info };
    })
    .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));

  const isEmpty = entries.length === 0;
  const categoryTotals = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.category] = (accumulator[entry.category] ?? 0) + entry.quantity;
    return accumulator;
  }, {});
  const categories = useMemo(
    () => ["All", ...Object.keys(categoryTotals).sort((left, right) => left.localeCompare(right))],
    [categoryTotals],
  );
  const visibleEntries = activeCategory === "All"
    ? entries
    : entries.filter((entry) => entry.category === activeCategory);

  return (
    <AppShell
      title="Inventory"
      hint="Rebuilt as a proper holdings ledger so it feels closer to Torn and less like a warehouse spreadsheet in witness protection."
    >
      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title={`Items (${entries.length} types)`}>
            {isEmpty ? (
              <div className="inv-empty">
                <div className="inv-empty__icon">[ ]</div>
                <div className="inv-empty__title">Your inventory is empty.</div>
                <div className="inv-empty__sub">
                  Complete jobs to gather materials. Beginner adventuring, salvage, and street work will start filling this up.
                </div>
              </div>
            ) : (
              <div className="inv-ledger">
                <div className="inv-ledger__headline">
                  <div className="inv-ledger__title">Nexis Holdings Ledger</div>
                  <div className="inv-ledger__subtitle">
                    Clean stock counts, readable categories, and zero fake use buttons for systems that are not wired yet.
                  </div>
                </div>

                <div className="inv-filter-bar">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`inv-filter-chip${category === activeCategory ? " inv-filter-chip--active" : ""}`}
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                      {category === "All" ? ` (${entries.length})` : ` (${categoryTotals[category] ?? 0})`}
                    </button>
                  ))}
                </div>

                <div className="inv-table">
                  <div className="inv-table__head">
                    <span>Item</span>
                    <span>Category</span>
                    <span>Description</span>
                    <span>Qty</span>
                  </div>
                  {visibleEntries.map(({ itemId, quantity, name, category, description }) => (
                    <div key={itemId} className="inv-table__row">
                      <span className="inv-table__item">
                        <span className="inv-table__item-name">{name}</span>
                        <span className="inv-table__item-id">{itemId}</span>
                      </span>
                      <span className="inv-table__category" style={{ color: getCategoryColour(category) }}>
                        {category}
                      </span>
                      <span className="inv-table__description">{description}</span>
                      <span className="inv-table__qty">x {quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Summary">
            <div className="info-list">
              <div className="info-row">
                <span className="info-row__label">Item types</span>
                <span className="info-row__value">{entries.length}</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">Total items</span>
                <span className="info-row__value">
                  {entries.reduce((sum, entry) => sum + entry.quantity, 0)}
                </span>
              </div>
            </div>

            <div className="inv-categories">
              <div className="inv-categories__title">By category</div>
              {Object.entries(categoryTotals).map(([category, total]) => (
                <div key={category} className="inv-cat-row">
                  <span className="inv-cat-row__label" style={{ color: getCategoryColour(category) }}>
                    {category}
                  </span>
                  <span className="inv-cat-row__count">{total}</span>
                </div>
              ))}
              {isEmpty ? <div className="inv-cat-row inv-cat-row--empty">Nothing yet.</div> : null}
            </div>

            {!isEmpty ? (
              <div className="inv-ledger-note">
                Sell, use, and crafting hooks still depend on the wider item economy. The ledger at least stops pretending otherwise.
              </div>
            ) : null}
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
