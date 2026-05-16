import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AppShell } from "../components/layout/AppShell";
import {
  formatPropertyPrice,
  getAvailableUpgrades,
  getPropertyTier,
  type PropertyUpgrade,
} from "../data/propertyData";
import "./property-detail.css";

type UpgradeState = {
  physical: string[];
  magical: string[];
  staff: string[];
};

function calculateTotals(
  baseComfort: number,
  baseUpkeep: number,
  selected: PropertyUpgrade[],
) {
  return selected.reduce(
    (totals, upgrade) => {
      totals.comfort += upgrade.comfortBonus;
      totals.upkeep += upgrade.upkeep;
      totals.cost += upgrade.cost;
      return totals;
    },
    { comfort: baseComfort, upkeep: baseUpkeep, cost: 0 },
  );
}

function UpgradeBlock({
  title,
  summary,
  slots,
  available,
  selectedIds,
  onToggle,
}: {
  title: string;
  summary: string;
  slots: number;
  available: PropertyUpgrade[];
  selectedIds: string[];
  onToggle: (upgradeId: string) => void;
}) {
  return (
    <div className="property-detail__section">
      <div className="property-detail__section-head">
        <div>
          <div className="property-detail__section-title">{title}</div>
          <div className="property-detail__section-copy">{summary}</div>
        </div>

        <div className="property-detail__slots">
          {selectedIds.length}/{slots} slots
        </div>
      </div>

      <div className="property-detail__upgrade-list">
        {available.map((upgrade) => {
          const active = selectedIds.includes(upgrade.id);
          const disabled = !active && selectedIds.length >= slots;

          return (
            <button
              key={upgrade.id}
              type="button"
              className={[
                "property-upgrade-card",
                active ? "property-upgrade-card--active" : "",
              ].join(" ")}
              disabled={disabled}
              onClick={() => onToggle(upgrade.id)}
            >
              <div className="property-upgrade-card__top">
                <div className="property-upgrade-card__title">{upgrade.name}</div>
                <div className="property-upgrade-card__cost">{formatPropertyPrice(upgrade.cost)}</div>
              </div>

              <div className="property-upgrade-card__summary">{upgrade.summary}</div>

              <div className="property-upgrade-card__stats">
                <span>+{upgrade.comfortBonus} Comfort</span>
                <span>+{formatPropertyPrice(upgrade.upkeep)}/day</span>
              </div>

              <ul className="property-upgrade-card__effects">
                {upgrade.effects.map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PropertyDetailPage() {
  const [matched, params] = useRoute("/properties/:propertyId");
  const propertyId = matched ? params.propertyId : "shack";
  const property = useMemo(() => getPropertyTier(propertyId), [propertyId]);

  const physicalOptions = useMemo(() => getAvailableUpgrades(property.id, "physical"), [property.id]);
  const magicalOptions = useMemo(() => getAvailableUpgrades(property.id, "magical"), [property.id]);
  const staffOptions = useMemo(() => getAvailableUpgrades(property.id, "staff"), [property.id]);

  const [selected, setSelected] = useState<UpgradeState>({
    physical: [],
    magical: [],
    staff: [],
  });

  function toggle(category: keyof UpgradeState, upgradeId: string, slots: number) {
    setSelected((current) => {
      const alreadySelected = current[category].includes(upgradeId);

      if (alreadySelected) {
        return {
          ...current,
          [category]: current[category].filter((id) => id !== upgradeId),
        };
      }

      if (current[category].length >= slots) {
        return current;
      }

      return {
        ...current,
        [category]: [...current[category], upgradeId],
      };
    });
  }

  const selectedUpgrades = [
    ...physicalOptions.filter((upgrade) => selected.physical.includes(upgrade.id)),
    ...magicalOptions.filter((upgrade) => selected.magical.includes(upgrade.id)),
    ...staffOptions.filter((upgrade) => selected.staff.includes(upgrade.id)),
  ];

  const totals = calculateTotals(property.comfort, property.upkeep, selectedUpgrades);

  return (
    <AppShell
      title={property.name}
      hint="Property management is where Nexis stops being housing and starts becoming power."
    >
      <div className="property-detail">
        <div className="property-detail__top">
          <div className="property-detail__image-panel">
            <img src={property.image} alt={property.name} className="property-detail__image" />
          </div>

          <div className="property-detail__summary-panel">
            <div className="property-detail__back">
              <Link href="/properties">← Back to Properties</Link>
            </div>

            <div className="property-detail__title">{property.name}</div>
            <div className="property-detail__copy">{property.summary}</div>

            <div className="property-detail__stats-grid">
              <div className="property-detail__stat">
                <span>Base Price</span>
                <strong>{formatPropertyPrice(property.price)}</strong>
              </div>
              <div className="property-detail__stat">
                <span>Base Comfort</span>
                <strong>{property.comfort}</strong>
              </div>
              <div className="property-detail__stat">
                <span>Base Upkeep</span>
                <strong>{formatPropertyPrice(property.upkeep)}/day</strong>
              </div>
              <div className="property-detail__stat">
                <span>Slots</span>
                <strong>
                  P{property.physicalSlots} • M{property.magicalSlots} • S{property.staffSlots}
                </strong>
              </div>
            </div>

            <div className="property-detail__totals">
              <div className="property-detail__totals-title">Current Build Totals</div>
              <div className="property-detail__totals-grid">
                <div>
                  <span>Total Comfort</span>
                  <strong>{totals.comfort}</strong>
                </div>
                <div>
                  <span>Total Upkeep</span>
                  <strong>{formatPropertyPrice(totals.upkeep)}/day</strong>
                </div>
                <div>
                  <span>Upgrade Cost</span>
                  <strong>{formatPropertyPrice(totals.cost)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <UpgradeBlock
          title="Physical Upgrades"
          summary="Structural and luxury improvements. These define how the property feels to actually live in."
          slots={property.physicalSlots}
          available={physicalOptions}
          selectedIds={selected.physical}
          onToggle={(id) => toggle("physical", id, property.physicalSlots)}
        />

        <UpgradeBlock
          title="Magical Enhancements"
          summary="This is where Nexis should shine. Enchantments add identity, protection, and later real mechanics."
          slots={property.magicalSlots}
          available={magicalOptions}
          selectedIds={selected.magical}
          onToggle={(id) => toggle("magical", id, property.magicalSlots)}
        />

        <UpgradeBlock
          title="Staff & Household Roles"
          summary="Not just decoration. Staff upgrades shape comfort, logistics, and security identity."
          slots={property.staffSlots}
          available={staffOptions}
          selectedIds={selected.staff}
          onToggle={(id) => toggle("staff", id, property.staffSlots)}
        />
      </div>
    </AppShell>
  );
}
