// ---------------------------------------------------------------------------
// Nexis - Housing Page
// One residence at a time, upgrades per tier, and now a mildly unreasonable
// amount of administrator airship privilege.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { usePlayer } from "../state/PlayerContext";
import {
  canAccessPropertyTier,
  formatGold,
  getPropertyAccessLabel,
  getPropertyById,
  propertyTiers,
  type PropertyTier,
  type PropertyUpgrade,
} from "../data/propertyData";
import "../styles/housing.css";

function CurrentPropertyPanel({ tier }: { tier: PropertyTier }) {
  const { player } = usePlayer();
  const installed = player.property.installedUpgrades;

  const comfortFromUpgrades = tier.upgrades
    .filter((upgrade) => installed.includes(upgrade.id))
    .reduce((sum, upgrade) => sum + upgrade.comfortBonus, 0);

  const currentMaxComfort = tier.baseComfort + comfortFromUpgrades;
  const installedCount = tier.upgrades.filter((upgrade) => installed.includes(upgrade.id)).length;
  const availableSlots = tier.upgradeSlots - installedCount;

  return (
    <div className="housing-current">
      <div className="housing-current__icon">{tier.icon}</div>
      <div className="housing-current__body">
        <div className="housing-current__label">Current Residence</div>
        <div className="housing-current__name">{tier.name}</div>
        <div className="housing-current__flavour">{tier.flavour}</div>

        <div className="housing-current__stats">
          <div className="housing-stat">
            <span className="housing-stat__key">Max Comfort</span>
            <span className="housing-stat__val">{currentMaxComfort}</span>
          </div>
          <div className="housing-stat">
            <span className="housing-stat__key">Upgrade Slots</span>
            <span className="housing-stat__val">
              {installedCount} / {tier.upgradeSlots} used
            </span>
          </div>
          <div className="housing-stat">
            <span className="housing-stat__key">Upkeep</span>
            <span className="housing-stat__val">
              {tier.upkeepPerDay === 0 ? "Free" : `${formatGold(tier.upkeepPerDay)} / day`}
            </span>
          </div>
          {availableSlots > 0 && (
            <div className="housing-stat housing-stat--open">
              <span className="housing-stat__key">Open Slots</span>
              <span className="housing-stat__val">{availableSlots} available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UpgradeCard({
  upgrade,
  isInstalled,
  canAfford,
  onInstall,
}: {
  upgrade: PropertyUpgrade;
  isInstalled: boolean;
  canAfford: boolean;
  onInstall: (upgrade: PropertyUpgrade) => void;
}) {
  return (
    <div className={`housing-upgrade${isInstalled ? " housing-upgrade--installed" : ""}`}>
      <div className="housing-upgrade__top">
        <div className="housing-upgrade__name">{upgrade.name}</div>
        <div className="housing-upgrade__cost">
          {isInstalled ? (
            <span className="housing-upgrade__installed-tag">Installed</span>
          ) : (
            formatGold(upgrade.cost)
          )}
        </div>
      </div>
      <div className="housing-upgrade__desc">{upgrade.description}</div>
      <ul className="housing-upgrade__effects">
        {upgrade.effects.map((effect) => (
          <li key={effect}>{effect}</li>
        ))}
      </ul>
      {!isInstalled && (
        <button
          type="button"
          className="housing-upgrade__btn"
          disabled={!canAfford}
          onClick={() => onInstall(upgrade)}
        >
          {canAfford ? "Install" : "Insufficient Gold"}
        </button>
      )}
    </div>
  );
}

function PropertyRow({
  tier,
  isOwned,
  isSelected,
  onClick,
}: {
  tier: PropertyTier;
  isOwned: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { player } = usePlayer();
  const canAccess = canAccessPropertyTier(tier, { publicId: player.publicId });
  const isAssignment = (tier.acquisition ?? "purchase") === "assignment";
  const canAfford = isAssignment ? canAccess : player.gold >= tier.price;
  const isLocked = !isOwned && (!canAccess || !canAfford);
  const accessLabel = getPropertyAccessLabel(tier);

  return (
    <button
      type="button"
      className={`housing-tier-row${isOwned ? " housing-tier-row--owned" : ""}${isSelected ? " housing-tier-row--selected" : ""}${isLocked ? " housing-tier-row--locked" : ""}`}
      onClick={onClick}
    >
      <span className="housing-tier-row__icon">{tier.icon}</span>
      <div className="housing-tier-row__info">
        <div className="housing-tier-row__name">{tier.name}</div>
        <div className="housing-tier-row__summary">{tier.summary}</div>
      </div>
      <div className="housing-tier-row__meta">
        <div className="housing-tier-row__comfort">
          {tier.baseComfort}-{tier.maxComfort} comfort
        </div>
        <div className={`housing-tier-row__price${isOwned ? " housing-tier-row__price--owned" : ""}`}>
          {isOwned
            ? "Owned"
            : accessLabel
            ? accessLabel
            : isAssignment
            ? "Assigned"
            : tier.price === 0
            ? "Free"
            : formatGold(tier.price)}
        </div>
      </div>
    </button>
  );
}

function PropertyDetailPanel({
  tier,
  isOwned,
  canAccess,
  onPurchase,
  onInstallUpgrade,
}: {
  tier: PropertyTier;
  isOwned: boolean;
  canAccess: boolean;
  onPurchase: (tier: PropertyTier) => void;
  onInstallUpgrade: (upgrade: PropertyUpgrade) => void;
}) {
  const { player } = usePlayer();
  const installed = player.property.installedUpgrades;
  const isAssignment = (tier.acquisition ?? "purchase") === "assignment";
  const canAffordProperty = player.gold >= tier.price;
  const canClaimProperty = canAccess && (isAssignment || canAffordProperty);
  const accessLabel = getPropertyAccessLabel(tier);

  const installedCount = tier.upgrades.filter((upgrade) => installed.includes(upgrade.id)).length;
  const comfortFromUpgrades = tier.upgrades
    .filter((upgrade) => installed.includes(upgrade.id))
    .reduce((sum, upgrade) => sum + upgrade.comfortBonus, 0);

  return (
    <div className="housing-detail">
      <div className="housing-detail__header">
        <span className="housing-detail__icon">{tier.icon}</span>
        <div className="housing-detail__header-info">
          <div className="housing-detail__title">{tier.name}</div>
          <div className="housing-detail__flavour">{tier.flavour}</div>
        </div>
      </div>

      <div className="housing-detail__stats">
        <div className="housing-detail__stat">
          <span>Base Comfort</span>
          <strong>{tier.baseComfort}</strong>
        </div>
        <div className="housing-detail__stat">
          <span>Max Comfort (full)</span>
          <strong>{isOwned ? tier.baseComfort + comfortFromUpgrades : tier.maxComfort}</strong>
        </div>
        <div className="housing-detail__stat">
          <span>Upgrade Slots</span>
          <strong>{isOwned ? `${installedCount} / ${tier.upgradeSlots}` : tier.upgradeSlots}</strong>
        </div>
        <div className="housing-detail__stat">
          <span>Upkeep / Day</span>
          <strong>{tier.upkeepPerDay === 0 ? "Free" : formatGold(tier.upkeepPerDay)}</strong>
        </div>
      </div>

      {!isOwned && (
        <div className="housing-detail__purchase-row">
          <div className="housing-detail__purchase-note">
            {!canAccess
              ? accessLabel
                ? `${accessLabel}. This residence is not available to this identity.`
                : "This residence is not available to this identity."
              : isAssignment
              ? accessLabel
                ? `${accessLabel}. Command access can be assigned without a gold cost.`
                : "This residence is assigned rather than purchased."
              : tier.price === 0
              ? "This is your default residence."
              : canAffordProperty
              ? `You have ${formatGold(player.gold)} - you can afford this.`
              : `You need ${formatGold(tier.price - player.gold)} more gold.`}
          </div>
          {canAccess && (isAssignment || tier.price > 0) && (
            <button
              type="button"
              className="housing-detail__purchase-btn"
              disabled={!canClaimProperty}
              onClick={() => onPurchase(tier)}
            >
              {isAssignment
                ? "Claim Command Access"
                : canAffordProperty
                ? `Move In - ${formatGold(tier.price)}`
                : "Cannot Afford"}
            </button>
          )}
        </div>
      )}

      {tier.upgradeSlots > 0 && (
        <div className="housing-detail__upgrades">
          <div className="housing-detail__upgrades-header">
            <div className="housing-detail__upgrades-title">
              Upgrades
              {isOwned && (
                <span className="housing-detail__upgrades-slots">
                  {tier.upgradeSlots - installedCount} slot{tier.upgradeSlots - installedCount !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
            {!isOwned && (
              <div className="housing-detail__upgrades-note">
                {!canAccess
                  ? "This residence must be assigned before upgrades are available."
                  : isAssignment
                  ? "Claim this command residence to install upgrades."
                  : "Purchase this property to install upgrades."}
              </div>
            )}
          </div>

          <div className="housing-detail__upgrade-grid">
            {tier.upgrades.map((upgrade) => (
              <UpgradeCard
                key={upgrade.id}
                upgrade={upgrade}
                isInstalled={installed.includes(upgrade.id)}
                canAfford={isOwned && player.gold >= upgrade.cost && !installed.includes(upgrade.id)}
                onInstall={onInstallUpgrade}
              />
            ))}
          </div>
        </div>
      )}

      {tier.upgradeSlots === 0 && isOwned && (
        <div className="housing-detail__no-upgrades">
          The Shack cannot be upgraded. Purchase a higher-tier property to unlock upgrade slots.
        </div>
      )}
    </div>
  );
}

export default function HousingPage() {
  const { player, purchaseProperty, installUpgrade } = usePlayer();
  const [selectedTierId, setSelectedTierId] = useState(player.property.current);
  const [toast, setToast] = useState<string | null>(null);

  const currentTier = getPropertyById(player.property.current) ?? propertyTiers[0];
  const visiblePropertyTiers = useMemo(
    () =>
      propertyTiers.filter(
        (tier) =>
          canAccessPropertyTier(tier, { publicId: player.publicId }) ||
          tier.id === player.property.current,
      ),
    [player.property.current, player.publicId],
  );
  const selectedTier = visiblePropertyTiers.find((tier) => tier.id === selectedTierId) ?? currentTier;
  const isSelectedOwned = selectedTierId === player.property.current;
  const canAccessSelectedTier = canAccessPropertyTier(selectedTier, {
    publicId: player.publicId,
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function handlePurchase(tier: PropertyTier) {
    const ok = purchaseProperty(tier.id, tier.price);
    if (ok) {
      setSelectedTierId(tier.id);
      showToast(
        (tier.acquisition ?? "purchase") === "assignment"
          ? `${tier.name} command access granted.`
          : `You have moved into your new ${tier.name}.`,
      );
    } else {
      showToast("Access denied or insufficient gold.");
    }
  }

  function handleInstallUpgrade(upgrade: PropertyUpgrade) {
    const ok = installUpgrade(upgrade.id, upgrade.cost);
    if (ok) {
      showToast(`${upgrade.name} installed.`);
    } else {
      showToast("Could not install upgrade.");
    }
  }

  return (
    <AppShell title="Housing">
      <div className="housing-page">
        {toast && <div className="housing-toast">{toast}</div>}

        <div className="housing-gold-bar">
          <span className="housing-gold-bar__label">Your gold</span>
          <span className="housing-gold-bar__value">{formatGold(player.gold)}</span>
        </div>

        <CurrentPropertyPanel tier={currentTier} />

        <div className="housing-layout">
          <div className="housing-tiers">
            <div className="housing-tiers__heading">Available Properties</div>
            {visiblePropertyTiers.map((tier) => (
              <PropertyRow
                key={tier.id}
                tier={tier}
                isOwned={tier.id === player.property.current}
                isSelected={tier.id === selectedTierId}
                onClick={() => setSelectedTierId(tier.id)}
              />
            ))}
          </div>

          <div className="housing-detail-wrap">
            <PropertyDetailPanel
              tier={selectedTier}
              isOwned={isSelectedOwned}
              canAccess={canAccessSelectedTier}
              onPurchase={handlePurchase}
              onInstallUpgrade={handleInstallUpgrade}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
