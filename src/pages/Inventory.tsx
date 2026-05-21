import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import { ITEM_CATALOGUE } from "../data/itemsData";
import {
  createServerMarketplaceListing,
  destroyServerItem,
  equipServerItem,
  equipServerLoadout,
  getServerItemInventory,
  getServerLoadouts,
  getServerMarketplace,
  removeWornServerItem,
  saveServerLoadout,
  sendServerItem,
  unequipServerItem,
  useServerItem,
  wearServerItem,
  type ServerEquipmentSlot,
  type ServerInventoryEntry,
  type ServerItemSummary,
  type ServerLoadout,
  type ServerMarketplaceListing,
  type ServerVisualEquipmentSlot,
} from "../lib/authApi";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import "../styles/inventory.css";

const CATEGORY_COLOUR: Record<string, string> = {
  Academy: "#d7cfb0",
  "Black Market": "#b58bd9",
  Clothing: "#d8a762",
  Consumable: "#26c6da",
  Equipment: "#c6cfd5",
  Loot: "#d98672",
  Material: "#8d9a72",
  Tool: "#ffb45c",
  "Trade Good": "#ffd06f",
  Uncatalogued: "#7e8a96",
};

type RowState = "inventory" | "equipped" | "worn";
type FormMode = "send" | "market" | null;

type LedgerRow = ServerInventoryEntry & {
  rowKey: string;
  state: RowState;
  slot?: string | null;
  listedQuantity?: number;
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
    itemRole: "utility",
    equipSlot: null,
    allowedSlots: [],
    visualSlot: null,
    allowedVisualSlots: [],
    visualOnly: false,
    stackLimit: 99,
    valueBuy: 0,
    valueSell: 0,
    cityBias: "neutral",
    sourceCity: "neutral",
    statModifiers: {},
    combatModifiers: {},
    weaponStats: null,
    armorStats: null,
    setId: null,
    armorSet: null,
    useEffects: [],
    requirements: {},
    lockReasonText: null,
    shortDescription: local?.description ?? "This legacy item is recorded in the local catalogue.",
    flavorText: "Registered in the Nexis ledger with standard source marks.",
    sourceTags: [],
    academyTags: [],
    marketEligible: true,
    iconKey: `${itemId}_icon`,
    iconUrl: "/item-icons/item.svg",
    iconBrief: "Legacy inventory icon.",
    iconPalette: ["#8fa0ad", "#202a33", "#d7cfb0"],
    iconSilhouette: "ledger-object",
    iconRarityFrame: "plain-iron",
    effectSummary: [],
  };
}

function formatSlot(slot: string | null | undefined): string {
  return String(slot ?? "").replace(/[0-9]/g, " $&").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function itemTypeLabel(item: ServerItemSummary): string {
  if (item.weaponStats) return `Weapon | ${item.weaponStats.damageType}`;
  if (item.armorStats) return `Armor | ${formatSlot(item.armorStats.weightClass)}`;
  if (item.allowedVisualSlots?.length) return "Visual clothing";
  if (item.useEffects.length) return "Consumable";
  return item.subtype || item.category;
}

function rarityIsSensitive(item: ServerItemSummary): boolean {
  return ["rare", "epic", "legendary", "legacy"].includes(String(item.rarity).toLowerCase()) || item.sourceTags.includes("manual") || item.sourceTags.includes("special");
}

function IconGlyph({ name }: { name: "plus" | "minus" | "check" | "send" | "market" | "trash" }) {
  const paths: Record<typeof name, string> = {
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    check: "M4 12l5 5L20 6",
    send: "M3 11l18-8-8 18-2-7-8-3zm8 3l4-6",
    market: "M4 7h16l-2 13H6L4 7zm3 0l2-4h6l2 4M8 11h8",
    trash: "M5 7h14M9 7V5h6v2m-8 0l1 13h8l1-13",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inv-action-icon">
      <path d={paths[name]} />
    </svg>
  );
}

function ActionButton({ label, icon, disabled, onClick }: { label: string; icon: Parameters<typeof IconGlyph>[0]["name"]; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="inv-action" title={label} aria-label={label} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <IconGlyph name={icon} />
    </button>
  );
}

function ItemEffectChips({ item }: { item: ServerItemSummary }) {
  const chips = item.effectSummary.length ? item.effectSummary : [itemTypeLabel(item)];
  return <div className="inv-effect-chips">{chips.slice(0, 8).map((effect) => <span key={effect}>{effect}</span>)}</div>;
}

function InventoryDetail({ row, formMode, sendTarget, sendQuantity, marketQuantity, marketPrice, onFormMode, setSendTarget, setSendQuantity, setMarketQuantity, setMarketPrice, onSend, onMarket }: {
  row: LedgerRow;
  formMode: FormMode;
  sendTarget: string;
  sendQuantity: number;
  marketQuantity: number;
  marketPrice: number;
  onFormMode: (mode: FormMode) => void;
  setSendTarget: (value: string) => void;
  setSendQuantity: (value: number) => void;
  setMarketQuantity: (value: number) => void;
  setMarketPrice: (value: number) => void;
  onSend: () => void;
  onMarket: () => void;
}) {
  const item = row.item ?? fallbackSummary(row.itemId);
  const equippedText = row.state === "equipped" ? `Equipped in ${formatSlot(row.slot)}` : row.state === "worn" ? `Worn in ${formatSlot(row.slot)}` : "Carried";
  return (
    <div className="inv-row-detail" onClick={(event) => event.stopPropagation()}>
      <div className="inv-detail-main">
        <ItemIcon item={item} size={58} />
        <div>
          <div className="inv-detail-title">{item.displayName}</div>
          <div className="inv-detail-sub">{item.rarity} | {item.category} | {itemTypeLabel(item)} | {equippedText}</div>
          <p>{item.shortDescription}</p>
          {item.flavorText ? <p className="inv-flavor">{item.flavorText}</p> : null}
        </div>
      </div>
      <ItemEffectChips item={item} />
      <div className="inv-detail-grid">
        {item.weaponStats ? <span>Damage: {item.weaponStats.damageMin}-{item.weaponStats.damageMax} {item.weaponStats.damageType}</span> : null}
        {item.weaponStats ? <span>Accuracy: {item.weaponStats.accuracy}%</span> : null}
        {item.armorStats ? <span>Reductions: {Object.entries(item.armorStats.reductions).map(([type, value]) => `${type} ${value}%`).join(" | ") || "None"}</span> : null}
        {item.armorSet ? <span>Set: {item.armorSet.name}</span> : null}
        {item.allowedVisualSlots?.length ? <span>Wear slot: {item.allowedVisualSlots.map(formatSlot).join(" / ")}</span> : null}
        <span>Source: {item.sourceCity !== "neutral" ? formatSlot(item.sourceCity) : "General"}</span>
        <span>Sell value: {item.valueSell} gold</span>
        {row.listedQuantity ? <span>Active market listings: x{row.listedQuantity}</span> : null}
      </div>
      {formMode === "send" ? (
        <div className="inv-inline-form">
          <input value={sendTarget} onChange={(event) => setSendTarget(event.target.value)} placeholder="Recipient public ID, e.g. P1000001" />
          <input type="number" min={1} max={row.quantity} value={sendQuantity} onChange={(event) => setSendQuantity(Number(event.target.value))} />
          <button type="button" onClick={onSend}>Send</button>
          <button type="button" onClick={() => onFormMode(null)}>Cancel</button>
        </div>
      ) : null}
      {formMode === "market" ? (
        <div className="inv-inline-form">
          <input type="number" min={1} max={row.quantity} value={marketQuantity} onChange={(event) => setMarketQuantity(Number(event.target.value))} />
          <input type="number" min={1} value={marketPrice} onChange={(event) => setMarketPrice(Number(event.target.value))} />
          <button type="button" onClick={onMarket}>List</button>
          <button type="button" onClick={() => onFormMode(null)}>Cancel</button>
        </div>
      ) : null}
    </div>
  );
}

function getCurrentCityId(playerState: unknown): string {
  const runtime = (playerState as { runtimeState?: { travel?: Record<string, unknown>; player?: Record<string, unknown> } } | null)?.runtimeState;
  return String(runtime?.travel?.currentCityId ?? runtime?.player?.currentCityId ?? "nexis");
}

export default function InventoryPage() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [serverEntries, setServerEntries] = useState<ServerInventoryEntry[] | null>(null);
  const [equipment, setEquipment] = useState<ServerEquipmentSlot[]>([]);
  const [visualEquipment, setVisualEquipment] = useState<ServerVisualEquipmentSlot[]>([]);
  const [equipmentTotals, setEquipmentTotals] = useState<Record<string, unknown>>({});
  const [loadouts, setLoadouts] = useState<ServerLoadout[]>([]);
  const [loadoutLabels, setLoadoutLabels] = useState<Record<string, string>>({});
  const [ownListings, setOwnListings] = useState<ServerMarketplaceListing[]>([]);
  const [catalogueCount, setCatalogueCount] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [form, setForm] = useState<{ rowKey: string; mode: FormMode } | null>(null);
  const [sendTarget, setSendTarget] = useState("");
  const [sendQuantity, setSendQuantity] = useState(1);
  const [marketQuantity, setMarketQuantity] = useState(1);
  const [marketPrice, setMarketPrice] = useState(50);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshInventory() {
    if (authSource !== "server" || !serverSessionToken) return;
    const [result, loadoutResult, marketplaceResult] = await Promise.all([getServerItemInventory(serverSessionToken), getServerLoadouts(serverSessionToken), getServerMarketplace(serverSessionToken)]);
    if (!result.ok) {
      setError(result.error);
      setServerEntries(null);
      return;
    }
    setServerEntries(result.inventory);
    setEquipment(result.equipment);
    setVisualEquipment(result.visualEquipment ?? []);
    setEquipmentTotals(result.equipmentTotals);
    setCatalogueCount(result.catalogueCount);
    if (loadoutResult.ok) {
      setLoadouts(loadoutResult.loadouts);
      setLoadoutLabels(Object.fromEntries(loadoutResult.loadouts.map((loadout) => [loadout.slot, loadout.label])));
    }
    if (marketplaceResult.ok) setOwnListings(marketplaceResult.marketplace.listings.filter((listing) => listing.isOwnListing));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authSource !== "server" || !serverSessionToken) {
        setServerEntries(null);
        setEquipment([]);
        setVisualEquipment([]);
        setLoadouts([]);
        setCatalogueCount(null);
        return;
      }
      setError(null);
      await refreshInventory();
      if (cancelled) return;
    }
    void load();
    return () => { cancelled = true; };
  }, [authSource, serverSessionToken]);

  const inventoryEntries = useMemo<ServerInventoryEntry[]>(() => {
    if (serverEntries) return serverEntries;
    return Object.entries(player.inventory ?? {}).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity, item: fallbackSummary(itemId) }));
  }, [player.inventory, serverEntries]);

  const listedByItem = useMemo(() => ownListings.reduce<Record<string, number>>((acc, listing) => {
    acc[listing.itemId] = (acc[listing.itemId] ?? 0) + listing.quantity;
    return acc;
  }, {}), [ownListings]);

  const rows = useMemo<LedgerRow[]>(() => {
    const equippedRows = equipment.filter((slot) => slot.itemId && slot.item).map((slot) => ({ itemId: slot.itemId as string, quantity: 1, item: slot.item, rowKey: `equipped:${slot.slot}:${slot.itemId}`, state: "equipped" as RowState, slot: slot.slot }));
    const wornRows = visualEquipment.filter((slot) => slot.itemId && slot.item).map((slot) => ({ itemId: slot.itemId as string, quantity: 1, item: slot.item, rowKey: `worn:${slot.slot}:${slot.itemId}`, state: "worn" as RowState, slot: slot.slot }));
    const carriedRows = inventoryEntries.map((entry) => ({ ...entry, rowKey: `inventory:${entry.itemId}`, state: "inventory" as RowState, listedQuantity: listedByItem[entry.itemId] ?? 0 }));
    return [...equippedRows, ...wornRows, ...carriedRows].sort((left, right) => (left.item?.category ?? "").localeCompare(right.item?.category ?? "") || (left.item?.displayName ?? left.itemId).localeCompare(right.item?.displayName ?? right.itemId));
  }, [equipment, visualEquipment, inventoryEntries, listedByItem]);

  const filterCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const item = row.item ?? fallbackSummary(row.itemId);
    acc.all += 1;
    if (item.category === "Equipment") acc.equipment += 1;
    else if (item.category === "Consumable") acc.consumables += 1;
    else if (item.category === "Clothing") acc.clothing += 1;
    else if (["Trade Good", "Black Market"].includes(item.category)) acc.trade += 1;
    else acc.other += 1;
    return acc;
  }, { all: 0, equipment: 0, consumables: 0, clothing: 0, trade: 0, other: 0 });

  const filters = [
    { id: "all", label: `All Types (${filterCounts.all})` },
    { id: "equipment", label: `Equipment (${filterCounts.equipment} owned)` },
    { id: "consumables", label: `Consumables (${filterCounts.consumables} owned)` },
    { id: "clothing", label: `Clothing (${filterCounts.clothing} owned)` },
    { id: "trade", label: `Trade Goods (${filterCounts.trade} owned)` },
    { id: "other", label: `Loot / Materials (${filterCounts.other} owned)` },
  ];

  const visibleRows = rows.filter((row) => {
    const item = row.item ?? fallbackSummary(row.itemId);
    if (activeCategory === "all") return true;
    if (activeCategory === "equipment") return item.category === "Equipment";
    if (activeCategory === "consumables") return item.category === "Consumable";
    if (activeCategory === "clothing") return item.category === "Clothing";
    if (activeCategory === "trade") return ["Trade Good", "Black Market"].includes(item.category);
    return !["Equipment", "Consumable", "Clothing", "Trade Good", "Black Market"].includes(item.category);
  });

  async function runInventoryAction(actionKey: string, action: () => Promise<void>) {
    setBusyAction(actionKey);
    setMessage(null);
    setError(null);
    try { await action(); } finally { setBusyAction(null); }
  }

  async function refreshFromResult(result: Awaited<ReturnType<typeof getServerItemInventory>>) {
    if (!result.ok) { setError(result.error); return; }
    setServerEntries(result.inventory);
    setEquipment(result.equipment);
    setVisualEquipment(result.visualEquipment ?? []);
    setEquipmentTotals(result.equipmentTotals);
    setCatalogueCount(result.catalogueCount);
    setMessage(result.message ?? "Inventory updated.");
    await refreshServerState();
    await refreshInventory();
  }

  function equipOrWear(row: LedgerRow) {
    if (!serverSessionToken || row.state !== "inventory") return;
    const item = row.item ?? fallbackSummary(row.itemId);
    void runInventoryAction(`equip:${row.itemId}`, async () => {
      if (item.allowedSlots.length) await refreshFromResult(await equipServerItem(serverSessionToken, row.itemId, item.allowedSlots[0] ?? null));
      else if (item.allowedVisualSlots?.length) await refreshFromResult(await wearServerItem(serverSessionToken, row.itemId, item.allowedVisualSlots[0] ?? null));
    });
  }

  function removeRow(row: LedgerRow) {
    if (!serverSessionToken) return;
    void runInventoryAction(`remove:${row.rowKey}`, async () => {
      if (row.state === "equipped" && row.slot) await refreshFromResult(await unequipServerItem(serverSessionToken, row.slot));
      if (row.state === "worn" && row.slot) await refreshFromResult(await removeWornServerItem(serverSessionToken, row.slot));
    });
  }

  function useItem(row: LedgerRow) {
    if (!serverSessionToken || row.state !== "inventory") return;
    void runInventoryAction(`use:${row.itemId}`, async () => { await refreshFromResult(await useServerItem(serverSessionToken, row.itemId, 1)); });
  }

  function destroyItem(row: LedgerRow) {
    if (!serverSessionToken || row.state !== "inventory") return;
    const item = row.item ?? fallbackSummary(row.itemId);
    const warning = rarityIsSensitive(item) ? `This is a ${item.rarity} item. Destroy ${item.displayName}?` : `Destroy ${item.displayName}?`;
    if (!window.confirm(warning)) return;
    void runInventoryAction(`destroy:${row.itemId}`, async () => { await refreshFromResult(await destroyServerItem(serverSessionToken, { itemId: row.itemId, quantity: 1, confirmation: row.itemId })); });
  }

  function openForm(row: LedgerRow, mode: FormMode) {
    if (row.state !== "inventory") return;
    const item = row.item ?? fallbackSummary(row.itemId);
    setExpandedKey(row.rowKey);
    setForm({ rowKey: row.rowKey, mode });
    setSendQuantity(1);
    setMarketQuantity(1);
    setMarketPrice(Math.max(1, item.valueSell || 1));
  }

  function sendRow(row: LedgerRow) {
    if (!serverSessionToken) return;
    void runInventoryAction(`send:${row.itemId}`, async () => {
      const result = await sendServerItem(serverSessionToken, { itemId: row.itemId, targetPublicId: sendTarget, quantity: Math.max(1, Math.min(row.quantity, sendQuantity)) });
      await refreshFromResult(result);
      setForm(null);
      setSendTarget("");
    });
  }

  function marketRow(row: LedgerRow) {
    if (!serverSessionToken) return;
    void runInventoryAction(`market:${row.itemId}`, async () => {
      const result = await createServerMarketplaceListing(serverSessionToken, { itemId: row.itemId, quantity: Math.max(1, Math.min(row.quantity, marketQuantity)), unitPrice: Math.max(1, marketPrice), cityId: getCurrentCityId(player) });
      if (!result.ok) { setError(result.error); return; }
      setMessage(result.message ?? "Listing created.");
      setForm(null);
      await refreshServerState();
      await refreshInventory();
    });
  }

  function saveLoadout(slot: string) {
    if (!serverSessionToken) return;
    void runInventoryAction(`save-loadout:${slot}`, async () => {
      const result = await saveServerLoadout(serverSessionToken, slot, loadoutLabels[slot] ?? null);
      if (!result.ok) { setError(result.error); return; }
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
      if (!result.ok) { setError(result.error); return; }
      setLoadouts(result.loadouts);
      await refreshFromResult(await getServerItemInventory(serverSessionToken));
      setMessage(result.message ?? "Loadout equipped.");
    });
  }

  const armorReductions = (equipmentTotals.armorReductions ?? {}) as Record<string, number>;
  const weaponStats = (equipmentTotals.weaponStats ?? {}) as Record<string, unknown>;
  const armorSets = Array.isArray(equipmentTotals.armorSets) ? equipmentTotals.armorSets as Array<{ name?: string; count?: number; activeBonuses?: Array<{ label?: string }> }> : [];

  return (
    <AppShell title="Inventory" hint="Dense holdings ledger for carried items, combat gear, clothing, consumables, and player-market actions.">
      {error ? <ContentPanel title="Inventory Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Inventory Notice"><strong>{message}</strong></ContentPanel> : null}
      {authSource !== "server" ? <ContentPanel title="Live Inventory"><strong>Server session required for item actions.</strong></ContentPanel> : null}

      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title={`Holdings Ledger (${rows.length} rows)`}>
            <div className="inv-ledger">
              <div className="inv-ledger__headline">
                <div className="inv-ledger__title">Nexis Holdings Ledger</div>
                <div className="inv-ledger__subtitle">Click a row for details. Highlighted rows are equipped or worn.</div>
              </div>
              <div className="inv-filter-bar">{filters.map((filter) => <button key={filter.id} type="button" className={`inv-filter-chip${filter.id === activeCategory ? " inv-filter-chip--active" : ""}`} onClick={() => setActiveCategory(filter.id)}>{filter.label}</button>)}</div>
              {visibleRows.length ? (
                <div className="inv-table">
                  <div className="inv-table__head"><span>Item</span><span>Type</span><span>Stats / Role</span><span>Qty</span><span>Actions</span></div>
                  {visibleRows.map((row) => {
                    const item = row.item ?? fallbackSummary(row.itemId);
                    const expanded = expandedKey === row.rowKey;
                    const formMode = form?.rowKey === row.rowKey ? form.mode : null;
                    const canEquip = row.state === "inventory" && (item.allowedSlots.length > 0 || Boolean(item.allowedVisualSlots?.length));
                    const canUse = row.state === "inventory" && item.useEffects.length > 0;
                    const canTrade = row.state === "inventory" && item.marketEligible !== false;
                    return (
                      <div key={row.rowKey} className={`inv-row-wrap${row.state !== "inventory" ? " inv-row-wrap--active" : ""}`}>
                        <button type="button" className="inv-table__row" onClick={() => setExpandedKey(expanded ? null : row.rowKey)}>
                          <span className="inv-table__item"><ItemIcon item={item} size={34} /><span><span className="inv-table__item-name">{item.displayName}</span><span className="inv-table__item-id">{item.rarity} | {row.state === "inventory" ? "Carried" : row.state === "equipped" ? `Equipped: ${formatSlot(row.slot)}` : `Worn: ${formatSlot(row.slot)}`}</span></span></span>
                          <span className="inv-table__category" style={{ color: getCategoryColour(item.category) }}>{item.category}</span>
                          <span className="inv-table__description">{item.effectSummary.slice(0, 3).join(" | ") || item.shortDescription}</span>
                          <span className="inv-table__qty">x{row.quantity}{row.listedQuantity ? <em>Listed x{row.listedQuantity}</em> : null}</span>
                          <span className="inv-actions">
                            {row.state === "inventory" ? <ActionButton icon="plus" label={item.allowedVisualSlots?.length ? "Wear" : "Equip"} disabled={Boolean(busyAction) || !canEquip} onClick={() => equipOrWear(row)} /> : <ActionButton icon="minus" label="Remove" disabled={Boolean(busyAction)} onClick={() => removeRow(row)} />}
                            <ActionButton icon="check" label="Use" disabled={Boolean(busyAction) || !canUse} onClick={() => useItem(row)} />
                            <ActionButton icon="send" label="Send to player" disabled={Boolean(busyAction) || row.state !== "inventory"} onClick={() => openForm(row, "send")} />
                            <ActionButton icon="market" label="List on player market" disabled={Boolean(busyAction) || !canTrade} onClick={() => openForm(row, "market")} />
                            <ActionButton icon="trash" label="Destroy" disabled={Boolean(busyAction) || row.state !== "inventory"} onClick={() => destroyItem(row)} />
                          </span>
                        </button>
                        {expanded ? <InventoryDetail row={row} formMode={formMode} sendTarget={sendTarget} sendQuantity={sendQuantity} marketQuantity={marketQuantity} marketPrice={marketPrice} onFormMode={(mode) => setForm(mode ? { rowKey: row.rowKey, mode } : null)} setSendTarget={setSendTarget} setSendQuantity={setSendQuantity} setMarketQuantity={setMarketQuantity} setMarketPrice={setMarketPrice} onSend={() => sendRow(row)} onMarket={() => marketRow(row)} /> : null}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="inv-empty"><div className="inv-empty__title">No items in this filter.</div><div className="inv-empty__sub">Switch filters or acquire supplies from markets, contracts, crafting, travel, and loot.</div></div>}
            </div>
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Combat Loadout">
            <div className="inv-compact-list">{equipment.map((slot) => <div key={slot.slot} className="inv-slot-line"><span>{formatSlot(slot.slot)}</span><strong>{slot.item?.displayName ?? "Empty"}</strong></div>)}</div>
          </ContentPanel>
          <ContentPanel title="Worn Clothing">
            <div className="inv-compact-list">{visualEquipment.length ? visualEquipment.map((slot) => <div key={slot.slot} className="inv-slot-line"><span>{formatSlot(slot.slot)}</span><strong>{slot.item?.displayName ?? "Empty"}</strong></div>) : <div className="inv-cat-row inv-cat-row--empty">No visual slots loaded.</div>}</div>
          </ContentPanel>
          <ContentPanel title="Gear Summary">
            <div className="info-list">
              <div className="info-row"><span className="info-row__label">Weapon</span><span className="info-row__value">{weaponStats.damageMin ? `${weaponStats.damageMin}-${weaponStats.damageMax} ${weaponStats.primaryDamageType ?? "damage"}` : "None"}</span></div>
              <div className="info-row"><span className="info-row__label">Accuracy</span><span className="info-row__value">{Number(weaponStats.accuracyBonus ?? 0) >= 0 ? "+" : ""}{String(weaponStats.accuracyBonus ?? 0)}</span></div>
              <div className="info-row"><span className="info-row__label">Armor DR</span><span className="info-row__value">{Object.entries(armorReductions).map(([type, value]) => `${type} ${value}%`).join(" | ") || "None"}</span></div>
            </div>
            <div className="inv-ledger-note">{armorSets.length ? armorSets.map((set) => `${set.name} (${set.count}/5)`).join(" | ") : "No active armor set bonuses."}</div>
          </ContentPanel>
          <ContentPanel title="Loadout Presets">
            <div className="inv-compact-list">
              {loadouts.length ? loadouts.map((loadout) => <div key={loadout.slot} className="inv-loadout-line"><input value={loadoutLabels[loadout.slot] ?? loadout.label} onChange={(event) => setLoadoutLabels((current) => ({ ...current, [loadout.slot]: event.target.value }))} aria-label={`Loadout ${loadout.slot} label`} /><button type="button" disabled={Boolean(busyAction)} onClick={() => saveLoadout(loadout.slot)}>Save</button><button type="button" disabled={Boolean(busyAction) || !loadout.savedAt} onClick={() => equipLoadout(loadout.slot)}>Equip</button></div>) : <div className="inv-cat-row inv-cat-row--empty">Loadout presets require a live session.</div>}
            </div>
          </ContentPanel>
          <ContentPanel title="Summary">
            <div className="info-list">
              <div className="info-row"><span className="info-row__label">Carried types</span><span className="info-row__value">{inventoryEntries.length}</span></div>
              <div className="info-row"><span className="info-row__label">Total carried</span><span className="info-row__value">{inventoryEntries.reduce((sum, entry) => sum + entry.quantity, 0)}</span></div>
              <div className="info-row"><span className="info-row__label">Own listings</span><span className="info-row__value">{ownListings.length}</span></div>
              {catalogueCount !== null ? <div className="info-row"><span className="info-row__label">Catalogue</span><span className="info-row__value">{catalogueCount} items</span></div> : null}
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
