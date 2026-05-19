import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import { ITEM_CATALOGUE } from "../data/itemsData";
import {
  equipServerItem,
  equipServerLoadout,
  getServerItemInventory,
  getServerLoadouts,
  saveServerLoadout,
  unequipServerItem,
  useServerItem,
  type ServerEquipmentSlot,
  type ServerInventoryEntry,
  type ServerItemSummary,
  type ServerLoadout,
} from "../lib/authApi";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import "../styles/inventory.css";

const CATEGORY_COLOUR: Record<string, string> = {
  Academy: "#d7cfb0",
  "Black Market": "#b58bd9",
  Consumable: "#26c6da",
  Equipment: "#c6cfd5",
  Loot: "#d98672",
  Material: "#8d9a72",
  Tool: "#ffb45c",
  "Trade Good": "#ffd06f",
  Uncatalogued: "#7e8a96",
};

function getCategoryColour(category: string): string {
  return CATEGORY_COLOUR[category] ?? "#8fa0ad";
}

function fallbackSummary(itemId: string): ServerItemSummary {
  const local = ITEM_CATALOGUE[itemId];
  const displayName = local?.name ?? itemId.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: itemId,
    displayName,
    category: local?.category ?? "Uncatalogued",
    subtype: local?.category ?? "Uncatalogued",
    rarity: "common",
    equipSlot: null,
    allowedSlots: [],
    stackLimit: 99,
    valueBuy: 0,
    valueSell: 0,
    cityBias: "neutral",
    sourceCity: "neutral",
    statModifiers: {},
    combatModifiers: {},
    useEffects: [],
    requirements: {},
    lockReasonText: null,
    shortDescription: local?.description ?? "This item is recorded locally while the server catalogue is unavailable.",
    flavorText: "Server item metadata will appear when the live session is connected.",
    sourceTags: [],
    academyTags: [],
    iconKey: `${itemId}_icon`,
    iconUrl: "/item-icons/item.svg",
    iconBrief: "Pending server icon metadata.",
    iconPalette: ["#8fa0ad", "#202a33", "#d7cfb0"],
    iconSilhouette: "ledger-object",
    iconRarityFrame: "plain-iron",
    effectSummary: [],
  };
}

function ItemMeta({ item }: { item: ServerItemSummary }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{item.shortDescription}</div>
      <div style={{ color: "#8293a3", fontSize: 12 }}>{item.flavorText}</div>
      {item.effectSummary.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.effectSummary.slice(0, 4).map((effect) => (
            <span key={effect} style={{ border: "1px solid rgba(255,255,255,0.08)", padding: "2px 6px", color: "#d8c278", fontSize: 12 }}>
              {effect}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ color: "#748494", fontSize: 11 }}>
        {item.sourceCity !== "neutral" ? `Source: ${item.sourceCity}` : "General stock"} | {item.iconRarityFrame}
      </div>
    </div>
  );
}

function EquipmentSlotCard({ slot, busy, onUnequip }: { slot: ServerEquipmentSlot; busy: boolean; onUnequip: (slot: string) => void }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,13,18,0.58)", padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ textTransform: "capitalize" }}>{slot.slot.replace(/[0-9]/g, " $&")}</strong>
        {slot.item ? <span style={{ color: getCategoryColour(slot.item.category), fontSize: 12 }}>{slot.item.rarity}</span> : <span style={{ color: "#748494", fontSize: 12 }}>Empty</span>}
      </div>
      {slot.item ? (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={slot.item} /><span>{slot.item.displayName}</span></div>
          <ItemMeta item={slot.item} />
          <button type="button" disabled={busy} onClick={() => onUnequip(slot.slot)}>
            {busy ? "Updating..." : "Unequip"}
          </button>
        </>
      ) : (
        <div style={{ color: "#8293a3", fontSize: 13 }}>No item equipped in this slot.</div>
      )}
    </div>
  );
}

function InventoryRow({
  entry,
  busy,
  onEquip,
  onUse,
}: {
  entry: ServerInventoryEntry;
  busy: boolean;
  onEquip: (item: ServerItemSummary) => void;
  onUse: (item: ServerItemSummary) => void;
}) {
  const item = entry.item ?? fallbackSummary(entry.itemId);
  const equippable = item.allowedSlots.length > 0;
  const usable = item.useEffects.length > 0;
  return (
    <div className="inv-table__row" style={{ alignItems: "start" }}>
      <span className="inv-table__item" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ItemIcon item={item} />
        <span style={{ display: "grid", gap: 2 }}>
          <span className="inv-table__item-name">{item.displayName}</span>
          <span style={{ color: "#748494", fontSize: 11 }}>{item.rarity} | {item.subtype}</span>
        </span>
      </span>
      <span className="inv-table__category" style={{ color: getCategoryColour(item.category) }}>{item.category}</span>
      <span className="inv-table__description"><ItemMeta item={item} /></span>
      <span className="inv-table__qty" style={{ display: "grid", gap: 6 }}>
        x {entry.quantity}
        {equippable ? <button type="button" disabled={busy} onClick={() => onEquip(item)}>{busy ? "Updating..." : "Equip"}</button> : null}
        {usable ? <button type="button" disabled={busy} onClick={() => onUse(item)}>{busy ? "Using..." : "Use"}</button> : null}
      </span>
    </div>
  );
}

export default function InventoryPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [serverEntries, setServerEntries] = useState<ServerInventoryEntry[] | null>(null);
  const [equipment, setEquipment] = useState<ServerEquipmentSlot[]>([]);
  const [equipmentTotals, setEquipmentTotals] = useState<Record<string, Record<string, number>>>({});
  const [loadouts, setLoadouts] = useState<ServerLoadout[]>([]);
  const [loadoutLabels, setLoadoutLabels] = useState<Record<string, string>>({});
  const [catalogueCount, setCatalogueCount] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInventory() {
      if (authSource !== "server" || !serverSessionToken) {
        setServerEntries(null);
        setEquipment([]);
        setLoadouts([]);
        setCatalogueCount(null);
        return;
      }
      setError(null);
      const [result, loadoutResult] = await Promise.all([getServerItemInventory(serverSessionToken), getServerLoadouts(serverSessionToken)]);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setServerEntries(null);
        return;
      }
      setServerEntries(result.inventory);
      setEquipment(result.equipment);
      setEquipmentTotals(result.equipmentTotals);
      setCatalogueCount(result.catalogueCount);
      if (loadoutResult.ok) {
        setLoadouts(loadoutResult.loadouts);
        setLoadoutLabels(Object.fromEntries(loadoutResult.loadouts.map((loadout) => [loadout.slot, loadout.label])));
      }
    }
    void loadInventory();
    return () => {
      cancelled = true;
    };
  }, [authSource, serverSessionToken]);

  const entries = useMemo<ServerInventoryEntry[]>(() => {
    if (serverEntries) return serverEntries;
    return Object.entries(player.inventory ?? {})
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity, item: fallbackSummary(itemId) }))
      .sort((left, right) => (left.item?.category ?? "").localeCompare(right.item?.category ?? "") || (left.item?.displayName ?? left.itemId).localeCompare(right.item?.displayName ?? right.itemId));
  }, [player.inventory, serverEntries]);

  const categoryTotals = entries.reduce<Record<string, number>>((accumulator, entry) => {
    const category = entry.item?.category ?? "Uncatalogued";
    accumulator[category] = (accumulator[category] ?? 0) + entry.quantity;
    return accumulator;
  }, {});
  const categories = useMemo(() => ["All", ...Object.keys(categoryTotals).sort((left, right) => left.localeCompare(right))], [categoryTotals]);
  const visibleEntries = activeCategory === "All" ? entries : entries.filter((entry) => (entry.item?.category ?? "Uncatalogued") === activeCategory);
  const isEmpty = entries.length === 0;

  async function runInventoryAction(actionKey: string, action: () => Promise<void>) {
    setBusyAction(actionKey);
    setMessage(null);
    setError(null);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshFromResult(result: Awaited<ReturnType<typeof getServerItemInventory>>) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setServerEntries(result.inventory);
    setEquipment(result.equipment);
    setEquipmentTotals(result.equipmentTotals);
    setCatalogueCount(result.catalogueCount);
    setMessage(result.message ?? "Inventory updated.");
    await refreshServerState();
  }

  function equipItem(item: ServerItemSummary) {
    if (!serverSessionToken) return;
    void runInventoryAction(`equip:${item.id}`, async () => {
      await refreshFromResult(await equipServerItem(serverSessionToken, item.id, item.allowedSlots[0] ?? null));
    });
  }

  function unequipSlot(slot: string) {
    if (!serverSessionToken) return;
    void runInventoryAction(`unequip:${slot}`, async () => {
      await refreshFromResult(await unequipServerItem(serverSessionToken, slot));
    });
  }

  function useItem(item: ServerItemSummary) {
    if (!serverSessionToken) return;
    void runInventoryAction(`use:${item.id}`, async () => {
      await refreshFromResult(await useServerItem(serverSessionToken, item.id, 1));
    });
  }

  function saveLoadout(slot: string) {
    if (!serverSessionToken) return;
    void runInventoryAction(`save-loadout:${slot}`, async () => {
      const result = await saveServerLoadout(serverSessionToken, slot, loadoutLabels[slot] ?? null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLoadouts(result.loadouts);
      setLoadoutLabels(Object.fromEntries(result.loadouts.map((loadout) => [loadout.slot, loadout.label])));
      setMessage(result.message ?? "Loadout saved.");
      await refreshServerState();
    });
  }

  function equipLoadout(slot: string) {
    if (!serverSessionToken) return;
    void runInventoryAction(`equip-loadout:${slot}`, async () => {
      const result = await equipServerLoadout(serverSessionToken, slot);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLoadouts(result.loadouts);
      const inventoryResult = await getServerItemInventory(serverSessionToken);
      await refreshFromResult(inventoryResult);
      setMessage(result.message ?? "Loadout equipped.");
    });
  }

  return (
    <AppShell title="Inventory" hint="Server-backed items, equipment, consumables, market goods, loot, and academy rewards.">
      {error ? <ContentPanel title="Inventory Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Inventory Notice"><strong>{message}</strong></ContentPanel> : null}
      {authSource !== "server" ? (
        <ContentPanel title="Local Ledger"><strong>Live equipment actions require a server session.</strong></ContentPanel>
      ) : null}

      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title={`Items (${entries.length} types)`}>
            {isEmpty ? (
              <div className="inv-empty">
                <div className="inv-empty__icon">[ ]</div>
                <div className="inv-empty__title">Your inventory is empty.</div>
                <div className="inv-empty__sub">Buy supplies, complete contracts, win fights, or finish academy stages to start filling this ledger.</div>
              </div>
            ) : (
              <div className="inv-ledger">
                <div className="inv-ledger__headline">
                  <div className="inv-ledger__title">Nexis Holdings Ledger</div>
                  <div className="inv-ledger__subtitle">Items now carry rarity, effects, sources, and icon-ready metadata instead of pretending every object is a sad spreadsheet cell.</div>
                </div>
                <div className="inv-filter-bar">
                  {categories.map((category) => (
                    <button key={category} type="button" className={`inv-filter-chip${category === activeCategory ? " inv-filter-chip--active" : ""}`} onClick={() => setActiveCategory(category)}>
                      {category}{category === "All" ? ` (${entries.length})` : ` (${categoryTotals[category] ?? 0})`}
                    </button>
                  ))}
                </div>
                <div className="inv-table">
                  <div className="inv-table__head"><span>Item</span><span>Category</span><span>Details</span><span>Qty / Action</span></div>
                  {visibleEntries.map((entry) => <InventoryRow key={entry.itemId} entry={entry} busy={Boolean(busyAction)} onEquip={equipItem} onUse={useItem} />)}
                </div>
              </div>
            )}
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Equipped Gear">
            <div style={{ display: "grid", gap: 10 }}>
              {equipment.length ? equipment.map((slot) => <EquipmentSlotCard key={slot.slot} slot={slot} busy={busyAction === `unequip:${slot.slot}`} onUnequip={unequipSlot} />) : <div className="inv-cat-row inv-cat-row--empty">Server loadout will appear here after login.</div>}
            </div>
          </ContentPanel>

          <ContentPanel title="Loadout Presets">
            <div style={{ display: "grid", gap: 10 }}>
              {loadouts.length ? loadouts.map((loadout) => (
                <div key={loadout.slot} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,13,18,0.58)", padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>Slot {loadout.slot}</strong>
                    <span style={{ color: loadout.active ? "#8ec8a7" : "#748494", fontSize: 12 }}>{loadout.active ? "Active" : loadout.savedAt ? "Saved" : "Empty"}</span>
                  </div>
                  <input
                    value={loadoutLabels[loadout.slot] ?? loadout.label}
                    onChange={(event) => setLoadoutLabels((current) => ({ ...current, [loadout.slot]: event.target.value }))}
                    aria-label={`Loadout ${loadout.slot} label`}
                    style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#f2f2f2", padding: "7px 8px" }}
                  />
                  <div style={{ color: "#9fb0bf", fontSize: 12 }}>
                    {loadout.equipment.filter((entry) => entry.item).slice(0, 4).map((entry) => `${entry.slot}: ${entry.item?.displayName}`).join(" | ") || "No gear saved yet."}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => saveLoadout(loadout.slot)}>{busyAction === `save-loadout:${loadout.slot}` ? "Saving..." : "Save Current"}</button>
                    <button type="button" disabled={Boolean(busyAction) || !loadout.savedAt} onClick={() => equipLoadout(loadout.slot)}>{busyAction === `equip-loadout:${loadout.slot}` ? "Equipping..." : "Equip Preset"}</button>
                  </div>
                </div>
              )) : <div className="inv-cat-row inv-cat-row--empty">Loadout presets require a live server session.</div>}
            </div>
          </ContentPanel>

          <ContentPanel title="Summary">
            <div className="info-list">
              <div className="info-row"><span className="info-row__label">Item types</span><span className="info-row__value">{entries.length}</span></div>
              <div className="info-row"><span className="info-row__label">Total items</span><span className="info-row__value">{entries.reduce((sum, entry) => sum + entry.quantity, 0)}</span></div>
              {catalogueCount !== null ? <div className="info-row"><span className="info-row__label">Server catalogue</span><span className="info-row__value">{catalogueCount} authored items</span></div> : null}
            </div>
            <div className="inv-categories">
              <div className="inv-categories__title">By category</div>
              {Object.entries(categoryTotals).map(([category, total]) => <div key={category} className="inv-cat-row"><span className="inv-cat-row__label" style={{ color: getCategoryColour(category) }}>{category}</span><span className="inv-cat-row__count">{total}</span></div>)}
              {isEmpty ? <div className="inv-cat-row inv-cat-row--empty">Nothing yet.</div> : null}
            </div>
            <div className="inv-ledger-note">Equipment totals: {Object.entries(equipmentTotals).flatMap(([group, values]) => Object.entries(values ?? {}).map(([key, value]) => `${key} ${Number(value) >= 0 ? "+" : ""}${value} (${group})`)).slice(0, 8).join(" | ") || "No equipped bonuses yet."}</div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
