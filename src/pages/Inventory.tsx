import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ITEM_CATALOGUE } from "../data/itemsData";
import { usePlayer } from "../state/PlayerContext";
import "../styles/inventory.css";

const CATEGORY_COLOUR: Record<string, string> = {
  Herb: "#4caf50",
  Ore: "#9e9e9e",
  Material: "#8d6e63",
  Relic: "#ab47bc",
  Valuables: "#ffd740",
  Consumable: "#26c6da",
  Tool: "#ff9800",
  Equipment: "#78909c",
  Weapon: "#d98672",
  Armor: "#c6cfd5",
  Shield: "#dfd4a4",
  Alchemy: "#9fd39b",
  Agriculture: "#c4c97c",
  Textile: "#d2b0e1",
  Luxury: "#f1c6a4",
  Document: "#d7cfb0",
  "Refined Material": "#8fb2bf",
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
        name: "Uncatalogued Item",
        category: "Uncatalogued",
        description: "A holding recorded by the ledger but not yet catalogued for public display.",
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
      hint="Your held items, materials, tools, and relics are grouped into readable categories with live quantities."
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
                    Clean stock counts, readable categories, and a ledger that only shows actions currently available.
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

            <div className="inv-ledger-note">
              Item actions appear only when they are live for that item. Buy supplies in the Market; earn materials through Adventuring, Civic Jobs, and city activity; use or crafting controls will appear here when a held item supports them.
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
