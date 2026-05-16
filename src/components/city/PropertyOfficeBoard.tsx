import { useEffect, useMemo, useState } from "react";
import {
  acquireOrganizationBase,
  cancelOrganizationMainBuild,
  cancelOrganizationRoomBuild,
  getMyOrganization,
  getOrganizationBaseOwnership,
  sellbackOrganizationPlot,
  startOrganizationMainBuild,
  startOrganizationRoomBuild,
  removeOrganizationBaseRoom,
} from "../../lib/organizationApi";
import { type OrganizationBaseOwnershipResponse, type OrganizationRecord, type OrganizationType } from "../../lib/organizations";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";

type OfficeOrgState = {
  type: OrganizationType;
  organization: OrganizationRecord;
  ownership: OrganizationBaseOwnershipResponse;
};

type MaterialInput = { timber: string; stone: string; iron: string };

type LaborOption = {
  source: string;
  sourceLabel: string;
  availableCount: number;
  estimatedTimeHours: number | null;
  estimatedQualityScore: number | null;
  estimatedQualityTier: string;
  wageCostGold: number | null;
  professionLevel: number | null;
  ratingReputation: number | null;
  unavailableReason?: string;
};

type LaborComparison = {
  options: LaborOption[];
  recommendedSource: string;
};

type RoomOption = {
  key: string;
  displayName: string;
  durationHours: number;
  baseGoldCost: number;
  laborCostGold: number;
  monthlyUpkeepGold: number;
  removalCostGold: number;
  materialRequirements: { timber: number; stone: number; iron: number };
  laborComparison?: LaborComparison;
};

type BuildQualitySummary = {
  tier: string;
  score: number;
  modifiers: {
    operationalMultiplier: number;
    upkeepMultiplier: number;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readPlot(entry: Record<string, unknown>) {
  const requirements = asRecord(entry.requirements);
  return {
    key: asText(entry.key),
    displayName: asText(entry.displayName, "Unnamed Plot"),
    cityId: asText(entry.cityId, "Unknown"),
    size: asText(entry.size, "medium"),
    roomCapacity: asNumber(entry.roomCapacity, 0),
    plotCostGold: asNumber(entry.plotCostGold, 0),
    minimumLevel: asNumber(requirements.minimumLevel, 0),
  };
}

function readLaborComparison(value: unknown): LaborComparison {
  const source = asRecord(value);
  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const options: LaborOption[] = rawOptions.map((entry) => {
    const item = asRecord(entry);
    return {
      source: asText(item.source),
      sourceLabel: asText(item.sourceLabel, asText(item.source, "Labor")),
      availableCount: asNumber(item.availableCount, 0),
      estimatedTimeHours: item.estimatedTimeHours == null ? null : asNumber(item.estimatedTimeHours, 0),
      estimatedQualityScore: item.estimatedQualityScore == null ? null : asNumber(item.estimatedQualityScore, 0),
      estimatedQualityTier: asText(item.estimatedQualityTier, "standard"),
      wageCostGold: item.wageCostGold == null ? null : asNumber(item.wageCostGold, 0),
      professionLevel: item.professionLevel == null ? null : asNumber(item.professionLevel, 0),
      ratingReputation: item.ratingReputation == null ? null : asNumber(item.ratingReputation, 0),
      unavailableReason: asText(item.unavailableReason, ""),
    };
  }).filter((entry) => entry.source);

  return {
    options,
    recommendedSource: asText(source.recommendedSource, options[0]?.source ?? "npc_contractor"),
  };
}

function readBuildQuality(value: unknown): BuildQualitySummary | null {
  const record = asRecord(value);
  const tier = asText(record.tier);
  if (!tier) return null;
  const modifiers = asRecord(record.modifiers);
  return {
    tier,
    score: asNumber(record.score, 0),
    modifiers: {
      operationalMultiplier: asNumber(modifiers.operationalMultiplier, 1),
      upkeepMultiplier: asNumber(modifiers.upkeepMultiplier, 1),
    },
  };
}

function readRoomOption(entry: Record<string, unknown>): RoomOption {
  return {
    key: asText(entry.key),
    displayName: asText(entry.displayName, "Room"),
    durationHours: asNumber(entry.durationHours, 0),
    baseGoldCost: asNumber(entry.baseGoldCost, 0),
    laborCostGold: asNumber(entry.laborCostGold, 0),
    monthlyUpkeepGold: asNumber(entry.monthlyUpkeepGold, 0),
    removalCostGold: asNumber(entry.removalCostGold, 0),
    materialRequirements: {
      timber: asNumber(asRecord(entry.materialRequirements).timber, 0),
      stone: asNumber(asRecord(entry.materialRequirements).stone, 0),
      iron: asNumber(asRecord(entry.materialRequirements).iron, 0),
    },
  };
}

function readMainBuilding(entry: Record<string, unknown>) {
  return {
    key: asText(entry.key),
    displayName: asText(entry.displayName, "Unnamed Building"),
    tier: asNumber(entry.tier, 1),
    durationHours: asNumber(entry.durationHours, 0),
    baseGoldCost: asNumber(entry.baseGoldCost, 0),
    laborCostGold: asNumber(entry.laborCostGold, 0),
    monthlyUpkeepGold: asNumber(entry.monthlyUpkeepGold, 0),
    materialRequirements: {
      timber: asNumber(asRecord(entry.materialRequirements).timber, 0),
      stone: asNumber(asRecord(entry.materialRequirements).stone, 0),
      iron: asNumber(asRecord(entry.materialRequirements).iron, 0),
    },
    laborComparison: readLaborComparison(entry.laborComparison),
  };
}

function isPlotOnlyBase(ownership: OrganizationBaseOwnershipResponse) {
  const base = ownership.base;
  if (!base) return false;
  const construction = asRecord(base.construction);
  return asText(construction.buildingState) === "plot_only";
}

function readInstalledRooms(base: OrganizationBaseOwnershipResponse["base"]) {
  if (!base) return [];
  const construction = asRecord(base.construction);
  const rawRooms = Array.isArray(construction.rooms) ? construction.rooms : [];
  return rawRooms
    .map((entry) => asRecord(entry))
    .filter((entry) => asText(entry.status) === "complete")
    .map((entry) => ({
      roomKey: asText(entry.roomKey),
      roomName: asText(entry.roomName, asText(entry.roomKey, "Room")),
      monthlyUpkeepGold: asNumber(entry.monthlyUpkeepGold, 0),
      qualityTier: asText(entry.qualityTier, "standard"),
      qualityScore: asNumber(entry.qualityScore, 0),
    }));
}

function readActiveConstruction(base: OrganizationBaseOwnershipResponse["base"]) {
  if (!base) return null;
  const construction = asRecord(base.construction);
  const activeJob = asRecord(construction.activeJob);
  const state = asText(construction.buildingState);
  if (asText(activeJob.status) !== "active") return null;
  if (state !== "main_building_under_construction" && state !== "room_upgrade_under_construction") return null;

  const isRoom = state === "room_upgrade_under_construction";
  return {
    state,
    isRoom,
    buildingName: isRoom ? asText(activeJob.roomName, "Room Upgrade") : asText(construction.mainBuildingName, "Main Building"),
    startedAt: asNumber(activeJob.startedAt, 0),
    completesAt: asNumber(activeJob.completesAt, 0),
    durationHours: asNumber(activeJob.durationHours, 0),
    prepaidGold: asNumber(asRecord(activeJob.prepaid).effectiveGoldCost, 0),
    materialsConsumed: asRecord(asRecord(activeJob.prepaid).materialsConsumed),
  };
}

function formatDurationMs(ms: number) {
  const safe = Math.max(0, ms);
  const totalHours = Math.floor(safe / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((safe % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function PropertyOfficeBoard() {
  const { authSource, serverSessionToken } = useAuth();
  const { player } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OfficeOrgState[]>([]);
  const [selectedBuildingByOrg, setSelectedBuildingByOrg] = useState<Record<string, string>>({});
  const [selectedLaborByOrg, setSelectedLaborByOrg] = useState<Record<string, string>>({});
  const [selectedRoomByOrg, setSelectedRoomByOrg] = useState<Record<string, string>>({});
  const [materialsByOrg, setMaterialsByOrg] = useState<Record<string, MaterialInput>>({});

  const isServerMode = authSource === "server" && Boolean(serverSessionToken);

  async function loadOfficeState() {
    if (!serverSessionToken) return;
    setLoading(true);
    setError(null);

    const orgTypes: OrganizationType[] = ["guild", "consortium"];
    const collected: OfficeOrgState[] = [];

    for (const type of orgTypes) {
      const mine = await getMyOrganization(serverSessionToken, type);
      if ("ok" in mine && mine.ok === false) {
        setError(mine.error);
        continue;
      }
      const org = (mine as { organization: OrganizationRecord | null }).organization;
      if (!org?.internalId) continue;

      const ownership = await getOrganizationBaseOwnership(serverSessionToken, org.internalId);
      if ("ok" in ownership && ownership.ok === false) {
        setError(ownership.error);
        continue;
      }

      collected.push({
        type,
        organization: org,
        ownership: ownership as OrganizationBaseOwnershipResponse,
      });
    }

    setRows(collected);
    setLoading(false);
  }

  useEffect(() => {
    void loadOfficeState();
  }, [serverSessionToken]);

  const highestMinLevel = useMemo(() => {
    return rows.reduce((maxValue, row) => {
      const level = row.ownership.catalog.propertyOffice?.plotPurchaseMinLevel ?? 15;
      return Math.max(maxValue, level);
    }, 15);
  }, [rows]);

  function getMaterials(orgId: string): MaterialInput {
    return materialsByOrg[orgId] ?? { timber: "0", stone: "0", iron: "0" };
  }

  function setMaterial(orgId: string, key: keyof MaterialInput, value: string) {
    setMaterialsByOrg((prev) => ({
      ...prev,
      [orgId]: {
        ...getMaterials(orgId),
        [key]: value.replace(/[^\d]/g, ""),
      },
    }));
  }

  async function handlePlotPurchase(organizationInternalId: string, plotKey: string) {
    if (!serverSessionToken) return;
    const result = await acquireOrganizationBase(serverSessionToken, organizationInternalId, {
      mode: "plot_construction",
      plotKey,
    });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    setMessage("Plot purchased. Upkeep remains zero until the main building is completed.");
    await loadOfficeState();
  }

  async function handleSellback(organizationInternalId: string) {
    if (!serverSessionToken) return;
    const result = await sellbackOrganizationPlot(serverSessionToken, organizationInternalId);
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    setMessage("Plot sold back to the NPC Property Office at loss. No player-to-player plot transfer is allowed.");
    await loadOfficeState();
  }

  async function handleStartBuild(organizationInternalId: string) {
    if (!serverSessionToken) return;
    const selected = selectedBuildingByOrg[organizationInternalId];
    if (!selected) {
      setMessage("Select a main building first.");
      return;
    }

    const material = getMaterials(organizationInternalId);
    const selectedLaborSource = selectedLaborByOrg[organizationInternalId] ?? "";
    const normalizedLaborSource: "player_pool" | "npc_contractor" | undefined =
      selectedLaborSource === "player_pool" || selectedLaborSource === "npc_contractor"
        ? selectedLaborSource
        : undefined;
    const payload = {
      buildingKey: selected,
      materials: {
        timber: Number(material.timber || "0"),
        stone: Number(material.stone || "0"),
        iron: Number(material.iron || "0"),
      },
      laborSource: normalizedLaborSource,
      rushBuild: false,
    };

    const result = await startOrganizationMainBuild(serverSessionToken, organizationInternalId, payload);
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }

    setMessage("Main-building construction started. Contract is prepaid and cancellation provides no refund.");
    await loadOfficeState();
  }

  async function handleStartRoomBuild(organizationInternalId: string) {
    if (!serverSessionToken) return;
    const selectedRoomKey = selectedRoomByOrg[organizationInternalId];
    if (!selectedRoomKey) {
      setMessage("Select a room upgrade first.");
      return;
    }

    const material = getMaterials(organizationInternalId);
    const selectedLaborSource = selectedLaborByOrg[organizationInternalId] ?? "";
    const normalizedLaborSource: "player_pool" | "npc_contractor" | undefined =
      selectedLaborSource === "player_pool" || selectedLaborSource === "npc_contractor"
        ? selectedLaborSource
        : undefined;

    const result = await startOrganizationRoomBuild(serverSessionToken, organizationInternalId, {
      roomKey: selectedRoomKey,
      materials: {
        timber: Number(material.timber || "0"),
        stone: Number(material.stone || "0"),
        iron: Number(material.iron || "0"),
      },
      laborSource: normalizedLaborSource,
    });

    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }

    setMessage("Room construction started. Contract is prepaid; cancellation is available but refunds are not, because apparently masonry has standards.");
    await loadOfficeState();
  }

  async function handleRemoveRoom(organizationInternalId: string, roomKey: string) {
    if (!serverSessionToken) return;
    const result = await removeOrganizationBaseRoom(serverSessionToken, organizationInternalId, { roomKey });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    setMessage("Room removed. Removal costs gold and grants no refund.");
    await loadOfficeState();
  }

  async function handleCancelBuild(organizationInternalId: string) {
    if (!serverSessionToken) return;
    const result = await cancelOrganizationMainBuild(serverSessionToken, organizationInternalId, {
      reason: "Leadership cancelled construction via Property Office.",
    });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }

    setMessage("Construction cancelled. Costs are not refunded and builders keep full pay.");
    await loadOfficeState();
  }

  async function handleCancelRoomBuild(organizationInternalId: string) {
    if (!serverSessionToken) return;
    const result = await cancelOrganizationRoomBuild(serverSessionToken, organizationInternalId, {
      reason: "Treasury cancelled room construction via Property Office.",
    });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }

    setMessage("Room construction cancelled. Costs are not refunded and builders keep full pay.");
    await loadOfficeState();
  }

  if (!isServerMode) {
    return <div className="guild-inline-note guild-inline-note--warning">Property Office actions require authenticated server mode.</div>;
  }

  if (loading && rows.length === 0) {
    return <div className="guild-inline-note">Loading Property Office records from the live city ledger.</div>;
  }

  return (
    <div className="org-surface" style={{ display: "grid", gap: 14 }}>
      <section className="panel org-panel">
        <div className="org-panel__head">
          <div>
            <p className="org-eyebrow">Property Office</p>
            <h3>Plot and Main Building Contracts</h3>
          </div>
        </div>
        <div className="org-detail-list">
          <div className="info-row"><span className="info-row__label">Player level</span><span className="info-row__value">{player.level}</span></div>
          <div className="info-row"><span className="info-row__label">Plot unlock level</span><span className="info-row__value">{highestMinLevel}</span></div>
          <div className="info-row"><span className="info-row__label">Unbuilt plot upkeep</span><span className="info-row__value">None</span></div>
        </div>
      </section>

      {message ? <div className="guild-inline-note">{message}</div> : null}
      {error ? <div className="guild-inline-note guild-inline-note--warning">{error}</div> : null}

      {rows.length === 0 ? (
        <section className="panel org-panel">
          <div className="guild-inline-note guild-inline-note--warning">No guild or consortium membership found for this account, so there is no organization to buy a plot for.</div>
        </section>
      ) : null}

      {rows.map((row) => {
        const office = row.ownership.catalog.propertyOffice;
        const builders = office?.builderAvailability;
        const npcSellbackReturnPct = office?.npcSellbackReturnPct ?? 65;
        const plotOwned = isPlotOnlyBase(row.ownership);
        const hasAnyBase = Boolean(row.ownership.base);
        const base = row.ownership.base;
        const activeBuild = readActiveConstruction(base);
        const eligiblePlots = row.ownership.catalog.eligiblePlots
          .map((entry) => readPlot(asRecord(entry)))
          .filter((plot) => plot.key);
        const buildingOptions = (row.ownership.catalog.mainBuildingOptions ?? [])
          .map((entry) => readMainBuilding(asRecord(entry)))
          .filter((building) => building.key);
        const roomOptions = (row.ownership.catalog.roomOptions ?? [])
          .map((entry) => readRoomOption(asRecord(entry)))
          .filter((room) => room.key);

        const selectedBuildingKey = selectedBuildingByOrg[row.organization.internalId] ?? (buildingOptions[0]?.key ?? "");
        const selectedBuilding = buildingOptions.find((entry) => entry.key === selectedBuildingKey) ?? null;
        const selectedRoomKey = selectedRoomByOrg[row.organization.internalId] ?? (roomOptions[0]?.key ?? "");
        const selectedRoom = roomOptions.find((entry) => entry.key === selectedRoomKey) ?? null;
        const useRoomLabor = asText(base?.buildingState) === "main_building_complete";
        const laborOptions = useRoomLabor
          ? (selectedRoom?.laborComparison?.options ?? [])
          : (selectedBuilding?.laborComparison.options ?? []);
        const recommendedLaborSource = useRoomLabor
          ? (selectedRoom?.laborComparison?.recommendedSource ?? "npc_contractor")
          : (selectedBuilding?.laborComparison.recommendedSource ?? "npc_contractor");
        const selectedLaborSource = selectedLaborByOrg[row.organization.internalId] ?? recommendedLaborSource;
        const selectedLabor = laborOptions.find((entry) => entry.source === selectedLaborSource) ?? null;

        const builtQuality = readBuildQuality(base?.buildQuality);
        const installedRooms = readInstalledRooms(base);
        const blockedByActiveBuild = Boolean(activeBuild);

        return (
          <section key={row.organization.internalId} className="panel org-panel">
            <div className="org-panel__head">
              <div>
                <p className="org-eyebrow">{row.type === "guild" ? "Guild Property Office" : "Consortium Property Office"}</p>
                <h3>{row.organization.name}</h3>
              </div>
            </div>

            <div className="org-grid-two">
              <section className="panel org-panel">
                <div className="org-panel__head"><h3 style={{ margin: 0 }}>Available Plots</h3></div>
                <div style={{ display: "grid", gap: 10 }}>
                  {eligiblePlots.map((plot) => {
                    const blockedByLevel = player.level < plot.minimumLevel;
                    const blockedByOwnership = hasAnyBase;
                    return (
                      <div key={plot.key} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>{plot.displayName}</strong>
                          <span>{plot.plotCostGold.toLocaleString("en-GB")} gold</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#9fb0bf" }}>
                          {plot.cityId} | {plot.size} plot | {plot.roomCapacity} room slots after build complete
                        </div>
                        <div style={{ fontSize: 12, color: "#b7c3cf" }}>Requirement: level {plot.minimumLevel}+</div>
                        <button
                          type="button"
                          className="org-button"
                          disabled={blockedByLevel || blockedByOwnership}
                          onClick={() => void handlePlotPurchase(row.organization.internalId, plot.key)}
                        >
                          {blockedByOwnership ? "Base/Plot already owned" : blockedByLevel ? `Requires level ${plot.minimumLevel}` : "Buy Plot"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel org-panel">
                <div className="org-panel__head"><h3 style={{ margin: 0 }}>Hire Section (Aggregate)</h3></div>
                <div className="org-detail-list">
                  <div className="info-row"><span className="info-row__label">Player builders available</span><span className="info-row__value">{builders?.playerBuilders ?? 0}</span></div>
                  <div className="info-row"><span className="info-row__label">NPC builders available</span><span className="info-row__value">{builders?.npcBuilders ?? 0}</span></div>
                  <div className="info-row"><span className="info-row__label">Total builder availability</span><span className="info-row__value">{builders?.totalAvailable ?? 0}</span></div>
                </div>
                <div className="guild-inline-note">Identity-protected listing: no raw builder names or personal stats are exposed in Property Office aggregate view.</div>

                <div className="org-panel__head" style={{ marginTop: 12 }}><h3 style={{ margin: 0 }}>Owned Plot / Main Build</h3></div>
                {plotOwned && base ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div className="info-row"><span className="info-row__label">Current plot</span><span className="info-row__value">{base.displayName}</span></div>
                    <div className="info-row"><span className="info-row__label">Unbuilt upkeep</span><span className="info-row__value">0 gold</span></div>
                    <div className="info-row"><span className="info-row__label">NPC sellback return</span><span className="info-row__value">{npcSellbackReturnPct}% of paid cost</span></div>

                    {activeBuild ? (
                      <>
                        <div className="guild-inline-note guild-inline-note--warning">
                          {activeBuild.isRoom ? "Room upgrade active" : "Main build active"}: {activeBuild.buildingName} | ETA {formatDurationMs(activeBuild.completesAt - Date.now())} | Prepaid {activeBuild.prepaidGold.toLocaleString("en-GB")} gold.
                        </div>
                        <button
                          type="button"
                          className="org-button org-button--ghost"
                          onClick={() => void (activeBuild.isRoom ? handleCancelRoomBuild(row.organization.internalId) : handleCancelBuild(row.organization.internalId))}
                        >
                            Cancel Active Construction (No Refund)
                        </button>
                      </>
                    ) : (
                      <>
                        {asText(base.buildingState) === "main_building_complete" && builtQuality ? (
                          <div className="guild-inline-note">
                            Completed quality: <strong>{builtQuality.tier}</strong> ({builtQuality.score}).
                            Operational modifier {builtQuality.modifiers.operationalMultiplier.toFixed(2)}x,
                            upkeep modifier {builtQuality.modifiers.upkeepMultiplier.toFixed(2)}x.
                          </div>
                        ) : null}
                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={{ fontSize: 12, color: "#b7c3cf" }}>Main building</label>
                          <select
                            className="org-input"
                            value={selectedBuildingKey}
                            onChange={(event) => setSelectedBuildingByOrg((prev) => ({ ...prev, [row.organization.internalId]: event.target.value }))}
                          >
                            {buildingOptions.map((building) => (
                              <option key={building.key} value={building.key}>{building.displayName}</option>
                            ))}
                          </select>

                          {selectedBuilding ? (
                            <div className="org-detail-list">
                              <div className="info-row"><span className="info-row__label">Build duration (baseline)</span><span className="info-row__value">{selectedBuilding.durationHours}h</span></div>
                              <div className="info-row"><span className="info-row__label">Base gold</span><span className="info-row__value">{selectedBuilding.baseGoldCost.toLocaleString("en-GB")}</span></div>
                              <div className="info-row"><span className="info-row__label">Upkeep after completion</span><span className="info-row__value">{selectedBuilding.monthlyUpkeepGold.toLocaleString("en-GB")}/month</span></div>
                            </div>
                          ) : null}

                          {laborOptions.length > 0 ? (
                            <div style={{ display: "grid", gap: 8 }}>
                              <label style={{ fontSize: 12, color: "#b7c3cf" }}>Labor source</label>
                              <select
                                className="org-input"
                                value={selectedLaborSource}
                                onChange={(event) => setSelectedLaborByOrg((prev) => ({ ...prev, [row.organization.internalId]: event.target.value }))}
                              >
                                {laborOptions.map((option) => (
                                  <option key={option.source} value={option.source} disabled={option.estimatedTimeHours == null || option.wageCostGold == null}>
                                    {option.sourceLabel}
                                  </option>
                                ))}
                              </select>

                              {selectedLabor ? (
                                <div className="org-detail-list">
                                  <div className="info-row"><span className="info-row__label">Estimated time</span><span className="info-row__value">{selectedLabor.estimatedTimeHours == null ? "Unavailable" : `${selectedLabor.estimatedTimeHours}h`}</span></div>
                                  <div className="info-row"><span className="info-row__label">Estimated quality</span><span className="info-row__value">{selectedLabor.estimatedQualityScore == null ? "N/A" : `${selectedLabor.estimatedQualityTier} (${selectedLabor.estimatedQualityScore})`}</span></div>
                                  <div className="info-row"><span className="info-row__label">Wage cost</span><span className="info-row__value">{selectedLabor.wageCostGold == null ? "N/A" : `${selectedLabor.wageCostGold.toLocaleString("en-GB")} gold`}</span></div>
                                  <div className="info-row"><span className="info-row__label">Profession level</span><span className="info-row__value">{selectedLabor.professionLevel == null ? "N/A" : selectedLabor.professionLevel}</span></div>
                                  <div className="info-row"><span className="info-row__label">Rating / reputation</span><span className="info-row__value">{selectedLabor.ratingReputation == null ? "N/A" : selectedLabor.ratingReputation}</span></div>
                                </div>
                              ) : null}

                              {selectedLabor?.unavailableReason ? <div className="guild-inline-note guild-inline-note--warning">{selectedLabor.unavailableReason}</div> : null}
                            </div>
                          ) : null}

                          <label style={{ fontSize: 12, color: "#b7c3cf" }}>Optional material contribution (from org storage)</label>
                          <div className="org-grid-two" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                            <input className="org-input" placeholder="Timber" value={getMaterials(row.organization.internalId).timber} onChange={(e) => setMaterial(row.organization.internalId, "timber", e.target.value)} />
                            <input className="org-input" placeholder="Stone" value={getMaterials(row.organization.internalId).stone} onChange={(e) => setMaterial(row.organization.internalId, "stone", e.target.value)} />
                            <input className="org-input" placeholder="Iron" value={getMaterials(row.organization.internalId).iron} onChange={(e) => setMaterial(row.organization.internalId, "iron", e.target.value)} />
                          </div>
                        </div>

                        <button type="button" className="org-button" disabled={blockedByActiveBuild || asText(base.buildingState) === "main_building_complete" || !selectedBuildingKey || (selectedLabor?.estimatedTimeHours == null)} onClick={() => void handleStartBuild(row.organization.internalId)}>
                          {asText(base.buildingState) === "main_building_complete" ? "Main Building Already Completed" : "Start Main Building (Prepaid)"}
                        </button>

                        {asText(base.buildingState) === "main_building_complete" ? (
                          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                            <div className="org-detail-list">
                              <div className="info-row"><span className="info-row__label">Room Capacity</span><span className="info-row__value">{base.roomCapacity}</span></div>
                              <div className="info-row"><span className="info-row__label">Rooms Installed</span><span className="info-row__value">{installedRooms.length}</span></div>
                            </div>

                            {installedRooms.length > 0 ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                {installedRooms.map((room) => (
                                  <div key={room.roomKey} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8, display: "grid", gap: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                      <strong>{room.roomName}</strong>
                                      <span>{room.monthlyUpkeepGold.toLocaleString("en-GB")} / month</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#9fb0bf" }}>Quality: {room.qualityTier} ({room.qualityScore})</div>
                                    <button type="button" className="org-button org-button--ghost" onClick={() => void handleRemoveRoom(row.organization.internalId, room.roomKey)}>
                                      Remove Room (No Refund)
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <label style={{ fontSize: 12, color: "#b7c3cf" }}>Room upgrade</label>
                            <select
                              className="org-input"
                              value={selectedRoomKey}
                              onChange={(event) => setSelectedRoomByOrg((prev) => ({ ...prev, [row.organization.internalId]: event.target.value }))}
                            >
                              {roomOptions.map((room) => (
                                <option key={room.key} value={room.key}>{room.displayName}</option>
                              ))}
                            </select>

                            {selectedRoom ? (
                              <div className="org-detail-list">
                                <div className="info-row"><span className="info-row__label">Room build duration</span><span className="info-row__value">{selectedRoom.durationHours}h</span></div>
                                <div className="info-row"><span className="info-row__label">Base gold</span><span className="info-row__value">{selectedRoom.baseGoldCost.toLocaleString("en-GB")}</span></div>
                                <div className="info-row"><span className="info-row__label">Room upkeep add</span><span className="info-row__value">{selectedRoom.monthlyUpkeepGold.toLocaleString("en-GB")}/month</span></div>
                                <div className="info-row"><span className="info-row__label">Removal cost</span><span className="info-row__value">{selectedRoom.removalCostGold.toLocaleString("en-GB")} (no refund)</span></div>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              className="org-button"
                              disabled={blockedByActiveBuild || !selectedRoomKey || installedRooms.length >= (base.roomCapacity ?? 0) || (selectedLabor?.estimatedTimeHours == null)}
                              onClick={() => void handleStartRoomBuild(row.organization.internalId)}
                            >
                              Start Room Upgrade (Prepaid)
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}

                    <button type="button" className="org-button org-button--ghost" onClick={() => void handleSellback(row.organization.internalId)}>
                      Sell Plot Back to NPC
                    </button>
                  </div>
                ) : hasAnyBase && base ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div className="guild-inline-note">This organization already has an established base. New plot purchase is locked by one-base ownership rules.</div>
                    <div className="org-detail-list">
                      <div className="info-row"><span className="info-row__label">Base state</span><span className="info-row__value">{asText(base.buildingState, base.status)}</span></div>
                      <div className="info-row"><span className="info-row__label">Current property</span><span className="info-row__value">{base.displayName}</span></div>
                      <div className="info-row"><span className="info-row__label">Monthly upkeep</span><span className="info-row__value">{base.monthlyUpkeepGold.toLocaleString("en-GB")} gold</span></div>
                      {builtQuality ? <div className="info-row"><span className="info-row__label">Build quality</span><span className="info-row__value">{builtQuality.tier} ({builtQuality.score})</span></div> : null}
                    </div>
                  </div>
                ) : (
                  <div className="guild-inline-note">No plot currently owned.</div>
                )}
              </section>
            </div>
          </section>
        );
      })}
    </div>
  );
}
