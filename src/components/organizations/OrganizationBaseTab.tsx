import { useEffect, useMemo, useState } from "react";
import {
  buybackOrganizationBase,
  getOrganizationBaseOwnership,
  payOrganizationBaseUpkeep,
} from "../../lib/organizationApi";
import { type OrganizationBaseOwnershipResponse, type OrganizationType } from "../../lib/organizations";

type BaseTabProps = {
  serverSessionToken: string | null;
  organizationInternalId: string;
  organizationType: OrganizationType;
  onMessage: (message: string) => void;
  onRefreshOrganization?: () => void;
};

function formatDate(value: number | null) {
  if (!value || !Number.isFinite(value)) return "Unknown";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(base: NonNullable<OrganizationBaseOwnershipResponse["base"]>) {
  if (base.status === "auction") return "warning";
  if (base.status === "confiscated") return "danger";
  if (base.review.isUnderThreshold && base.review.isReviewWindowOpen) return "danger";
  if (base.review.isReviewWindowOpen) return "warning";
  return "safe";
}

function statusText(base: NonNullable<OrganizationBaseOwnershipResponse["base"]>) {
  if (base.status === "auction") return "Auctioned";
  if (base.status === "confiscated") return "Confiscated";
  if (base.review.isUnderThreshold && base.review.isReviewWindowOpen) return "At Risk";
  if (base.review.isReviewWindowOpen) return "Review Soon";
  return "Stable";
}

function effectRows(base: NonNullable<OrganizationBaseOwnershipResponse["base"]>, organizationType: OrganizationType) {
  const fx = base.mechanicalEffects?.effects ?? {};
  const entries = organizationType === "guild"
    ? [
        { key: "questPowerPct", label: "Quest operation power", suffix: "%" },
        { key: "dungeonPowerFlat", label: "Dungeon readiness", suffix: " flat" },
        { key: "renownDailyPct", label: "Daily renown", suffix: "%" },
      ]
    : [
        { key: "routeEfficiencyPct", label: "Route efficiency", suffix: "%" },
        { key: "logisticsRewardPct", label: "Route reward", suffix: "%" },
        { key: "launchCostReductionPct", label: "Launch cost reduction", suffix: "%" },
        { key: "logisticsLossMitigationPct", label: "Loss mitigation", suffix: "%" },
      ];

  return entries
    .map((entry) => ({ ...entry, value: Number((fx as Record<string, number>)[entry.key] ?? 0) }))
    .filter((entry) => entry.value > 0);
}

function warningText(base: NonNullable<OrganizationBaseOwnershipResponse["base"]>) {
  if (base.status === "auction") {
    return "Buyback rights are closed. This base is in NPC auction status only for this phase.";
  }
  if (base.status === "confiscated") {
    return "Passive base gains are disabled until buyback succeeds. Active jobs continue as normal.";
  }
  if (base.review.isUnderThreshold && base.review.isReviewWindowOpen) {
    return `Under threshold before review. Pay at least ${base.review.shortfallToThresholdGold.toLocaleString("en-GB")} gold more to avoid confiscation risk.`;
  }
  if (base.review.isReviewWindowOpen) {
    return `Review window is active (${base.review.daysUntilReview.toFixed(1)} days remaining). Keep vault funded so autopay can intervene.`;
  }
  return "Vault funding can auto-pay during review checks, but manual upkeep remains available to leadership.";
}

export function OrganizationBaseTab({
  serverSessionToken,
  organizationInternalId,
  organizationType,
  onMessage,
  onRefreshOrganization,
}: BaseTabProps) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<OrganizationBaseOwnershipResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState("1000");

  async function reload() {
    if (!serverSessionToken) return;
    setLoading(true);
    const result = await getOrganizationBaseOwnership(serverSessionToken, organizationInternalId);
    if ("ok" in result && result.ok === false) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setError(null);
    setState(result as OrganizationBaseOwnershipResponse);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [organizationInternalId, serverSessionToken]);

  const base = state?.base ?? null;
  const tone = useMemo(() => (base ? statusTone(base) : "safe"), [base]);
  const thresholdPct = base?.periodDueGold ? Math.min(100, Math.round((base.periodPaidGold / base.periodDueGold) * 100)) : 0;

  async function handleManualPay() {
    if (!serverSessionToken || !base) return;
    const amountGold = Math.max(1, Math.floor(Number(manualAmount) || 0));
    const result = await payOrganizationBaseUpkeep(serverSessionToken, organizationInternalId, amountGold);
    if ("ok" in result && result.ok === false) {
      onMessage(result.error);
      return;
    }
    onMessage(`Base upkeep paid: ${amountGold.toLocaleString("en-GB")} gold.`);
    await reload();
    onRefreshOrganization?.();
  }

  async function handleBuyback() {
    if (!serverSessionToken || !base) return;
    const result = await buybackOrganizationBase(serverSessionToken, organizationInternalId);
    if ("ok" in result && result.ok === false) {
      onMessage(result.error);
      return;
    }
    onMessage("Base buyback completed. Passive gains restored.");
    await reload();
    onRefreshOrganization?.();
  }

  if (!serverSessionToken) {
    return <div className="guild-inline-note guild-inline-note--warning">Base controls require authenticated server mode.</div>;
  }

  if (loading && !state) {
    return <div className="guild-inline-note">Loading the base ledger…</div>;
  }

  if (error) {
    return (
      <div className="guild-stack">
        <div className="guild-inline-note guild-inline-note--warning">{error}</div>
        <button type="button" className="org-button" onClick={() => void reload()}>
          Retry Base Ledger
        </button>
      </div>
    );
  }

  if (!base) {
    const buildings = state?.catalog?.eligibleBuildings?.length ?? 0;
    const plots = state?.catalog?.eligiblePlots?.length ?? 0;
    return (
      <div className="org-surface">
        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Base Ownership</p>
              <h3>No base currently owned</h3>
            </div>
          </div>
          <div className="org-detail-list">
            <div className="info-row"><span className="info-row__label">Organization Type</span><span className="info-row__value">{organizationType}</span></div>
            <div className="info-row"><span className="info-row__label">Eligible buildings</span><span className="info-row__value">{buildings}</span></div>
            <div className="info-row"><span className="info-row__label">Eligible plots</span><span className="info-row__value">{plots}</span></div>
          </div>
          <div className="guild-inline-note">
            Acquisition, upkeep, review, confiscation, buyback, and auction records are handled by the live city ledger.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="org-surface">
      <section className={`base-status-strip base-status-strip--${tone}`}>
        <div>
          <p className="org-eyebrow">Base Status</p>
          <h3>{statusText(base)} — {base.displayName}</h3>
          <p>{warningText(base)}</p>
        </div>
        <button type="button" className="org-button org-button--ghost" onClick={() => void reload()}>
          Refresh Base State
        </button>
      </section>

      <section className="org-grid-two">
        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Ownership</p>
              <h3>Base ledger</h3>
            </div>
          </div>
          <div className="org-detail-list">
            <div className="info-row"><span className="info-row__label">Current owned base</span><span className="info-row__value">{base.displayName}</span></div>
            <div className="info-row"><span className="info-row__label">City/location</span><span className="info-row__value">{base.cityId ?? "Unknown"}</span></div>
            <div className="info-row"><span className="info-row__label">Ownership mode</span><span className="info-row__value">{base.ownershipMode}</span></div>
            <div className="info-row"><span className="info-row__label">Daily upkeep</span><span className="info-row__value">{Math.ceil(base.monthlyUpkeepGold / 30).toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Monthly upkeep target</span><span className="info-row__value">{base.monthlyUpkeepGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Next review date</span><span className="info-row__value">{formatDate(base.nextReviewAt)}</span></div>
            <div className="info-row"><span className="info-row__label">Passive gains</span><span className="info-row__value">{base.passiveBenefitsActive ? "Active" : "Disabled"}</span></div>
          </div>
        </section>

        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Period Ledger</p>
              <h3>Debt and threshold</h3>
            </div>
          </div>
          <div className="org-detail-list">
            <div className="info-row"><span className="info-row__label">Total owed (period)</span><span className="info-row__value">{base.periodDueGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Paid (period)</span><span className="info-row__value">{base.periodPaidGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Outstanding</span><span className="info-row__value">{base.outstandingGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">One-third threshold</span><span className="info-row__value">{base.review.minimumRequiredGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Threshold shortfall</span><span className="info-row__value">{base.review.shortfallToThresholdGold.toLocaleString("en-GB")} gold</span></div>
            <div className="info-row"><span className="info-row__label">Review proximity</span><span className="info-row__value">{base.review.daysUntilReview.toFixed(1)} days</span></div>
          </div>
          <div className="base-threshold-meter" role="img" aria-label={`Threshold coverage ${thresholdPct}%`}>
            <span style={{ width: `${thresholdPct}%` }} />
          </div>
          <div className="guild-inline-note">
            Vault autopay can prevent confiscation at review if enough treasury gold is available. Manual payments are immediate and server-validated.
          </div>
        </section>
      </section>

      <section className="org-grid-two">
        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Mechanical Effects</p>
              <h3>Operational modifiers</h3>
            </div>
          </div>
          <div className="org-detail-list">
            {effectRows(base, organizationType).map((row) => (
              <div key={row.key} className="info-row">
                <span className="info-row__label">{row.label}</span>
                <span className="info-row__value">+{row.value.toFixed(row.key === "dungeonPowerFlat" ? 0 : 2)}{row.suffix}</span>
              </div>
            ))}
            {effectRows(base, organizationType).length === 0 ? (
              <div className="info-row"><span className="info-row__label">Modifiers</span><span className="info-row__value">None active</span></div>
            ) : null}
            <div className="info-row"><span className="info-row__label">Quality factor</span><span className="info-row__value">{(base.mechanicalEffects?.qualityFactor ?? 1).toFixed(3)}x</span></div>
          </div>
          <div className="guild-inline-note">
            These effects apply to guild operations or consortium logistics through this base profile.
          </div>
        </section>

        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Recovery</p>
              <h3>Confiscation and buyback</h3>
            </div>
          </div>
          <div className="org-detail-list">
            <div className="info-row"><span className="info-row__label">Confiscation status</span><span className="info-row__value">{base.status === "confiscated" ? "Confiscated" : "Not confiscated"}</span></div>
            <div className="info-row"><span className="info-row__label">Buyback deadline</span><span className="info-row__value">{formatDate(base.buybackUntil)}</span></div>
            <div className="info-row"><span className="info-row__label">Buyback cost</span><span className="info-row__value">{base.buyback?.totalDueGold?.toLocaleString("en-GB") ?? "N/A"} gold</span></div>
          </div>
          <div className="org-form">
            <input
              className="org-input"
              inputMode="numeric"
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="Manual upkeep amount"
            />
            <button type="button" className="org-button" onClick={() => void handleManualPay()} disabled={base.status !== "active"}>
              Pay Upkeep
            </button>
            <button type="button" className="org-button org-button--ghost" onClick={() => void handleBuyback()} disabled={base.status !== "confiscated"}>
              Buyback Base
            </button>
          </div>
        </section>

        <section className="panel org-panel">
          <div className="org-panel__head">
            <div>
              <p className="org-eyebrow">Auction Status</p>
              <h3>Post-buyback expiry</h3>
            </div>
          </div>
          <div className="org-detail-list">
            <div className="info-row"><span className="info-row__label">Auction state</span><span className="info-row__value">{base.status === "auction" ? "Open auction lifecycle" : "Not in auction"}</span></div>
            <div className="info-row"><span className="info-row__label">Opening bid</span><span className="info-row__value">{base.auction ? `${base.auction.openingBidGold.toLocaleString("en-GB")} gold` : "N/A"}</span></div>
            <div className="info-row"><span className="info-row__label">Current bid</span><span className="info-row__value">{base.auction ? `${base.auction.currentBidGold.toLocaleString("en-GB")} gold` : "N/A"}</span></div>
            <div className="info-row"><span className="info-row__label">Auction closes</span><span className="info-row__value">{formatDate(base.auction?.closesAt ?? null)}</span></div>
          </div>
          <div className="guild-inline-note">
            Auction interaction is status-only on org pages in this phase. Bidding UI is intentionally deferred.
          </div>
        </section>
      </section>
    </div>
  );
}
