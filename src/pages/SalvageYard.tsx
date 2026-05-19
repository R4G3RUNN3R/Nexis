import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import {
  getServerCrafting,
  repairServerEquipment,
  salvageServerItem,
  type ServerRepairOption,
  type ServerSalvageOption,
} from "../lib/authApi";
import { useAuth } from "../state/AuthContext";

function YieldText({ option }: { option: ServerSalvageOption }) {
  return (
    <span>{option.yieldItems.map((entry) => `${entry.item?.displayName ?? entry.itemId} x${entry.quantity}`).join(" | ")}</span>
  );
}

export default function SalvageYardPage() {
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [salvageOptions, setSalvageOptions] = useState<ServerSalvageOption[]>([]);
  const [repairOptions, setRepairOptions] = useState<ServerRepairOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (authSource !== "server" || !serverSessionToken) {
      setSalvageOptions([]);
      setRepairOptions([]);
      setError("Salvage and repair require a live server session.");
      return;
    }
    setError(null);
    const result = await getServerCrafting(serverSessionToken);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSalvageOptions(result.salvageOptions);
    setRepairOptions(result.repairOptions);
    setMessage(result.message ?? null);
  }

  useEffect(() => {
    void load();
  }, [authSource, serverSessionToken]);

  async function salvage(itemId: string) {
    if (!serverSessionToken) return;
    setBusy(`salvage:${itemId}`);
    setError(null);
    setMessage(null);
    const result = await salvageServerItem(serverSessionToken, itemId, 1);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSalvageOptions(result.salvageOptions);
    setRepairOptions(result.repairOptions);
    setMessage(result.message ?? "Item salvaged.");
    await refreshServerState();
  }

  async function repair(slot: string) {
    if (!serverSessionToken) return;
    setBusy(`repair:${slot}`);
    setError(null);
    setMessage(null);
    const result = await repairServerEquipment(serverSessionToken, slot);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSalvageOptions(result.salvageOptions);
    setRepairOptions(result.repairOptions);
    setMessage(result.message ?? "Equipment maintained.");
    await refreshServerState();
  }

  return (
    <AppShell title="Salvage Yard" hint="Break surplus goods into useful materials and keep equipped gear maintained for combat.">
      {error ? <ContentPanel title="Yard Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Yard Notice"><strong>{message}</strong></ContentPanel> : null}
      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title="Disassembly Bench">
            <div style={{ display: "grid", gap: 10 }}>
              {salvageOptions.length ? salvageOptions.map((option) => (
                <div key={option.itemId} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,13,18,0.58)", padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={option.item} /><strong>{option.item?.displayName ?? option.itemId}</strong></span>
                    <span style={{ color: "#9fb0bf", fontSize: 12 }}>Owned x{option.ownedQuantity}</span>
                  </div>
                  <div style={{ color: "#d8c278", fontSize: 13 }}>Yield: <YieldText option={option} /></div>
                  <button type="button" disabled={Boolean(busy) || !option.canSalvage} onClick={() => salvage(option.itemId)}>
                    {busy === `salvage:${option.itemId}` ? "Salvaging..." : "Salvage One"}
                  </button>
                </div>
              )) : <div style={{ color: "#9fb0bf" }}>No useful salvage stock in inventory. Contracts, markets, and combat drops will feed this bench.</div>}
            </div>
          </ContentPanel>
        </div>
        <div className="nexis-column">
          <ContentPanel title="Equipment Maintenance">
            <div style={{ display: "grid", gap: 10 }}>
              {repairOptions.length ? repairOptions.map((option) => (
                <div key={option.slot} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,13,18,0.58)", padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}><ItemIcon item={option.item} /><strong style={{ textTransform: "capitalize" }}>{option.slot.replace(/[0-9]/g, " $&")}</strong></div>
                  <div style={{ color: "#b7c3cf", fontSize: 13 }}>{option.item?.displayName ?? "Empty"}</div>
                  <div style={{ color: option.canRepair ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{option.canRepair ? "Ready for maintenance" : option.lockReason}</div>
                  <button type="button" disabled={Boolean(busy) || !option.canRepair} onClick={() => repair(option.slot)}>
                    {busy === `repair:${option.slot}` ? "Maintaining..." : "Maintain Gear"}
                  </button>
                </div>
              )) : <div style={{ color: "#9fb0bf" }}>Equip gear first, then bring repair kits or rivets here.</div>}
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
