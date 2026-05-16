import crypto from "node:crypto";
import { query, closePool } from "../../server/db/pool.js";
import { HttpError } from "../../server/lib/errors.js";
import {
  acquireOrganizationBaseForUser,
  getOrganizationBaseOwnershipForUser,
  sellbackOrganizationPlotForUser,
} from "../../server/services/organizationBaseOwnershipService.js";
import {
  cancelOrganizationMainBuildForUser,
  startOrganizationMainBuildForUser,
} from "../../server/services/organizationBaseConstructionService.js";
import {
  cancelOrganizationRoomBuildForUser,
  removeOrganizationBaseRoomForUser,
  startOrganizationRoomBuildForUser,
} from "../../server/services/organizationBaseRoomService.js";
import { runOrganizationBaseLifecycleSweep } from "../../server/services/organizationBaseSafetyService.js";
import { getConsortiumLogisticsBoardForUser } from "../../server/services/consortiumLogisticsService.js";
import { getMyOrganization } from "../../server/services/organizationService.js";

const CANARY = {
  leaderEmail: "canary.consortium.leader@nexis.local",
  builderEmail: "canary.consortium.builder@nexis.local",
  orgName: "Canary Logistics Consortium",
  consortiumTypeKey: "logistics",
  consortiumTypeName: "Logistics Consortium",
  plotKey: "nexis_citadel_plot_s",
  mainBuildingKey: "consortium_trade_office",
};

const BUILDER_TRACK_ID = "builders_guild";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function experienceForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor((safeLevel * (safeLevel - 1) * 50) / 2);
}

async function ensureUser({ email, username, firstName, lastName, privilegeRole = "player", level = 25, activeBuilder = false }) {
  const existing = await query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  let user = existing.rows[0] ?? null;
  if (!user) {
    const internalId = `usr_${crypto.randomUUID()}`;
    const pub = await query("SELECT COALESCE(MAX(public_id), 1000000) + 1 AS next_id FROM users");
    const publicId = Number(pub.rows[0].next_id);
    await query(
      `INSERT INTO users (internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,'player',$7,$8)`,
      [internalId, publicId, username, email, firstName, lastName, privilegeRole, "canary_not_for_login"],
    );
    user = (await query("SELECT * FROM users WHERE internal_id = $1", [internalId])).rows[0];
  } else {
    await query(
      `UPDATE users
       SET username = $2,
           first_name = $3,
           last_name = $4,
           privilege_role = $5
       WHERE internal_id = $1`,
      [user.internal_id, username, firstName, lastName, privilegeRole],
    );
    user = (await query("SELECT * FROM users WHERE internal_id = $1", [user.internal_id])).rows[0];
  }

  const workingStats = activeBuilder
    ? { manualLabor: 9999, intelligence: 9999, endurance: 9999 }
    : { manualLabor: 52, intelligence: 45, endurance: 50 };
  const civicState = activeBuilder
    ? { activeTrackId: BUILDER_TRACK_ID, trackProgress: { [BUILDER_TRACK_ID]: { rank: 99, shiftsWorked: 999999 } } }
    : {};
  const snapshot = {
    condition: { type: "normal" },
    experience: experienceForLevel(level),
    level: Number(level) || 1,
  };

  const ps = await query("SELECT user_internal_id FROM player_state WHERE user_internal_id = $1 LIMIT 1", [user.internal_id]);
  if (!ps.rows.length) {
    await query(
      `INSERT INTO player_state (user_internal_id, level, gold, working_stats, player_snapshot, civic_state)
       VALUES ($1, $2, 500000, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [user.internal_id, level, JSON.stringify(workingStats), JSON.stringify(snapshot), JSON.stringify(civicState)],
    );
  } else {
    await query(
      `UPDATE player_state
       SET level = $2,
           gold = GREATEST(gold, 500000),
           working_stats = $3::jsonb,
           player_snapshot = $4::jsonb,
           civic_state = $5::jsonb,
           updated_at = NOW()
       WHERE user_internal_id = $1`,
      [user.internal_id, level, JSON.stringify(workingStats), JSON.stringify(snapshot), JSON.stringify(civicState)],
    );
  }

  return {
    internalId: user.internal_id,
    publicId: Number(user.public_id),
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    privilegeRole: user.privilege_role,
  };
}

async function setUserLevel(user, level) {
  const snapshot = {
    condition: { type: "normal" },
    experience: experienceForLevel(level),
    level,
  };
  await query(
    `UPDATE player_state
     SET level = $2,
         player_snapshot = $3::jsonb,
         updated_at = NOW()
     WHERE user_internal_id = $1`,
    [user.internalId, level, JSON.stringify(snapshot)],
  );
}

function consortiumMetadata(leaderInternalId) {
  return {
    companyStyle: true,
    rewardTiers: [1, 3, 5, 7, 10],
    rolesFlavor: ["director", "dispatcher", "hauler", "quartermaster", "warehouse master"],
    management: {
      positions: { [leaderInternalId]: "director" },
      applications: [],
      outreach: { level: 0, campaignsLaunched: 0, lastRunAt: null },
      health: {},
      performance: {},
    },
  };
}

async function ensureCanaryConsortium(leader) {
  const existing = await query(
    "SELECT * FROM organizations WHERE lower(name) = lower($1) AND type = 'consortium' LIMIT 1",
    [CANARY.orgName],
  );

  let org = existing.rows[0] ?? null;
  if (!org) {
    const orgInternalId = `org_${crypto.randomUUID()}`;
    const nextOrg = await query("SELECT COALESCE(MAX(public_id), 2000000) + 1 AS next_id FROM organizations");
    const orgPublicId = Number(nextOrg.rows[0].next_id);
    await query(
      `INSERT INTO organizations (
        internal_id, public_id, type, name, tag, founder_internal_id, founder_public_id,
        description, status_text, consortium_type_key, consortium_type_name,
        passive_bonus_summary, creation_cost, treasury, metadata
      ) VALUES (
        $1,$2,'consortium',$3,NULL,$4,$5,
        'Controlled canary consortium for Property Office and construction validation.','Canary controlled',$6,$7,
        'Canary validation only',0,$8::jsonb,$9::jsonb
      )`,
      [
        orgInternalId,
        orgPublicId,
        CANARY.orgName,
        leader.internalId,
        leader.publicId,
        CANARY.consortiumTypeKey,
        CANARY.consortiumTypeName,
        JSON.stringify({ copper: 0, silver: 0, gold: 1800000, platinum: 0 }),
        JSON.stringify(consortiumMetadata(leader.internalId)),
      ],
    );
    org = (await query("SELECT * FROM organizations WHERE internal_id = $1", [orgInternalId])).rows[0];
  } else {
    await query(
      `UPDATE organizations
       SET founder_internal_id = $2,
           founder_public_id = $3,
           status_text = 'Canary controlled',
           consortium_type_key = $4,
           consortium_type_name = $5,
           treasury = $6::jsonb,
           metadata = $7::jsonb,
           updated_at = NOW()
       WHERE internal_id = $1`,
      [
        org.internal_id,
        leader.internalId,
        leader.publicId,
        CANARY.consortiumTypeKey,
        CANARY.consortiumTypeName,
        JSON.stringify({ copper: 0, silver: 0, gold: 1800000, platinum: 0 }),
        JSON.stringify(consortiumMetadata(leader.internalId)),
      ],
    );
    org = (await query("SELECT * FROM organizations WHERE internal_id = $1", [org.internal_id])).rows[0];
  }

  await query("DELETE FROM organization_roles WHERE organization_internal_id = $1", [org.internal_id]);
  await query("DELETE FROM organization_members WHERE organization_internal_id = $1", [org.internal_id]);
  await query(
    `INSERT INTO organization_roles (organization_internal_id, role_key, display_name, rank_order, permissions, is_system_role)
     VALUES
     ($1,'director','Director',1,$2::jsonb,true),
     ($1,'specialist','Dispatcher',2,$3::jsonb,true),
     ($1,'employee','Employee',3,$4::jsonb,true)`,
    [
      org.internal_id,
      JSON.stringify(["manage_members", "manage_treasury", "manage_contracts", "recruit_members", "view_logs", "participate"]),
      JSON.stringify(["recruit_members", "view_logs", "participate"]),
      JSON.stringify(["participate"]),
    ],
  );
  await query(
    `INSERT INTO organization_members (organization_internal_id, user_internal_id, user_public_id, display_name, role_key)
     VALUES ($1,$2,$3,$4,'director')`,
    [org.internal_id, leader.internalId, leader.publicId, `${leader.firstName} ${leader.lastName}`.trim()],
  );

  return (await query("SELECT * FROM organizations WHERE internal_id = $1", [org.internal_id])).rows[0];
}

async function resetCanaryBaseState(orgInternalId) {
  await query("DELETE FROM organization_base_storage WHERE organization_internal_id = $1", [orgInternalId]);
  await query("DELETE FROM organization_base_payments WHERE organization_internal_id = $1", [orgInternalId]);
  await query("DELETE FROM organization_base_events WHERE organization_internal_id = $1", [orgInternalId]);
  await query("DELETE FROM organization_bases WHERE organization_internal_id = $1", [orgInternalId]);
  await query(
    `DELETE FROM organization_logs
     WHERE organization_internal_id = $1
       AND (
         action_type LIKE 'organization_base_%' OR
         action_type LIKE 'organization_main_build_%' OR
         action_type LIKE 'organization_room_%' OR
         action_type = 'organization_builder_assigned'
       )`,
    [orgInternalId],
  );
}

async function getOrgGold(orgInternalId) {
  const row = await query("SELECT treasury FROM organizations WHERE internal_id = $1", [orgInternalId]);
  return Number(row.rows[0]?.treasury?.gold ?? 0);
}

async function getBuilderTrack(builderInternalId) {
  const row = await query("SELECT civic_state FROM player_state WHERE user_internal_id = $1", [builderInternalId]);
  return asRecord(asRecord(row.rows[0]?.civic_state).trackProgress?.[BUILDER_TRACK_ID]);
}

async function setStaleBuilderAssignment(builder, orgInternalId, leader) {
  const row = await query("SELECT civic_state FROM player_state WHERE user_internal_id = $1", [builder.internalId]);
  const civicState = asRecord(row.rows[0]?.civic_state);
  const trackProgress = asRecord(civicState.trackProgress);
  const builderTrack = asRecord(trackProgress[BUILDER_TRACK_ID]);
  const now = Date.now();
  const nextTrack = {
    ...builderTrack,
    activeAssignment: {
      assignmentToken: "canary-stale-reservation",
      organizationInternalId: orgInternalId,
      jobId: "canary-stale-job",
      jobType: "room_upgrade",
      assignedAt: now - 120000,
      expiresAt: now - 60000,
      assignedByInternalId: leader.internalId,
    },
  };
  await query(
    `UPDATE player_state
     SET civic_state = $2::jsonb,
         updated_at = NOW()
     WHERE user_internal_id = $1`,
    [
      builder.internalId,
      JSON.stringify({
        ...civicState,
        activeTrackId: BUILDER_TRACK_ID,
        trackProgress: {
          ...trackProgress,
          [BUILDER_TRACK_ID]: nextTrack,
        },
      }),
    ],
  );
}

async function listEvidenceRows(orgInternalId) {
  const events = await query(
    `SELECT event_type, created_at, summary
     FROM organization_base_events
     WHERE organization_internal_id = $1
     ORDER BY created_at ASC`,
    [orgInternalId],
  );
  const logs = await query(
    `SELECT action_type, created_at, summary
     FROM organization_logs
     WHERE organization_internal_id = $1
     ORDER BY created_at ASC`,
    [orgInternalId],
  );
  const bases = await query(
    `SELECT id, organization_internal_id, ownership_mode, property_key, status,
            monthly_upkeep_gold, period_due_gold, period_paid_gold,
            period_started_at, next_review_at, buyback_until,
            debt_gold_at_confiscation, metadata, updated_at
     FROM organization_bases
     WHERE organization_internal_id = $1`,
    [orgInternalId],
  );
  return { events: events.rows, logs: logs.rows, bases: bases.rows };
}

async function main() {
  const leader = await ensureUser({
    email: CANARY.leaderEmail,
    username: "canary_consortium_leader",
    firstName: "Canary",
    lastName: "Director",
    privilegeRole: "admin",
    level: 25,
  });
  const builder = await ensureUser({
    email: CANARY.builderEmail,
    username: "canary_consortium_builder",
    firstName: "Canary",
    lastName: "Builder",
    privilegeRole: "player",
    level: 25,
    activeBuilder: true,
  });
  const org = await ensureCanaryConsortium(leader);
  await resetCanaryBaseState(org.internal_id);

  const report = {
    canary: {
      organizationInternalId: org.internal_id,
      organizationPublicId: Number(org.public_id),
      organizationName: org.name,
      organizationType: org.type,
      consortiumTypeKey: org.consortium_type_key,
      leaderInternalId: leader.internalId,
      leaderPublicId: leader.publicId,
      builderInternalId: builder.internalId,
      builderPublicId: builder.publicId,
    },
    validations: {},
    evidence: {},
    touched: {
      tables: [
        "users",
        "player_state",
        "organizations",
        "organization_roles",
        "organization_members",
        "organization_bases",
        "organization_base_events",
        "organization_base_payments",
        "organization_base_storage",
        "organization_logs",
      ],
    },
  };

  await setUserLevel(leader, 14);
  let levelGateBlocked = false;
  try {
    await acquireOrganizationBaseForUser(leader, org.internal_id, { mode: "plot_construction", plotKey: CANARY.plotKey });
  } catch (error) {
    if (error instanceof HttpError && error.code === "PROPERTY_OFFICE_LEVEL_REQUIRED") levelGateBlocked = true;
  }
  assert(levelGateBlocked, "Property Office level gate did not block a level-14 director.");

  await setUserLevel(leader, 25);
  const beforeGold = await getOrgGold(org.internal_id);
  const acquiredPlot = await acquireOrganizationBaseForUser(leader, org.internal_id, {
    mode: "plot_construction",
    plotKey: CANARY.plotKey,
  });
  assert(Number(acquiredPlot.base?.monthlyUpkeepGold ?? 0) === 0, "Unbuilt consortium plot has upkeep.");

  const sold = await sellbackOrganizationPlotForUser(leader, org.internal_id);
  const sellbackGold = Number(sold.sellback?.sellbackGold ?? 0);
  const acquisitionCostGold = Number(sold.sellback?.acquisitionCostGold ?? 0);
  assert(sellbackGold < acquisitionCostGold, "Plot sellback did not return less than purchase cost.");

  const reacquiredPlot = await acquireOrganizationBaseForUser(leader, org.internal_id, {
    mode: "plot_construction",
    plotKey: CANARY.plotKey,
  });
  assert(Number(reacquiredPlot.base?.monthlyUpkeepGold ?? 0) === 0, "Reacquired unbuilt plot has upkeep.");

  const startMainForCancel = await startOrganizationMainBuildForUser(leader, org.internal_id, {
    buildingKey: CANARY.mainBuildingKey,
    materials: { timber: 0, stone: 0, iron: 0 },
    laborSource: "player_pool",
    rushBuild: false,
  });
  assert(startMainForCancel?.construction?.activeJob?.labor?.source === "player_pool", "Canary player builder was not assigned to main build.");
  const goldAfterMainStartForCancel = await getOrgGold(org.internal_id);
  await cancelOrganizationMainBuildForUser(leader, org.internal_id, { reason: "canary_main_cancel_probe" });
  const goldAfterMainCancel = await getOrgGold(org.internal_id);
  assert(goldAfterMainCancel === goldAfterMainStartForCancel, "Main-build cancel refunded treasury unexpectedly.");

  const startMain = await startOrganizationMainBuildForUser(leader, org.internal_id, {
    buildingKey: CANARY.mainBuildingKey,
    materials: { timber: 0, stone: 0, iron: 0 },
    laborSource: "player_pool",
    rushBuild: false,
  });
  const mainJob = startMain?.construction?.activeJob;
  assert(mainJob?.jobId && mainJob?.completesAt, "Main build did not create an active job.");
  const mainSweep = await runOrganizationBaseLifecycleSweep({ now: Number(mainJob.completesAt) + 2000, actorInternalId: leader.internalId });

  const afterMain = await getOrganizationBaseOwnershipForUser(leader, org.internal_id);
  assert(afterMain.base?.buildingState === "main_building_complete", "Main build did not complete.");
  assert(Number(afterMain.base?.monthlyUpkeepGold ?? 0) > 0, "Upkeep did not begin after main completion.");
  assert(Boolean(afterMain.base?.buildQuality?.tier), "Main build quality did not persist.");

  const upkeepSweep = await runOrganizationBaseLifecycleSweep({ now: Date.now() + (2 * 24 * 60 * 60 * 1000), actorInternalId: leader.internalId });
  const afterAccrual = await getOrganizationBaseOwnershipForUser(leader, org.internal_id);
  assert(Number(afterAccrual.base?.periodDueGold ?? 0) >= 1, "Upkeep did not accrue after completion.");

  const startRoomForCancel = await startOrganizationRoomBuildForUser(leader, org.internal_id, {
    roomKey: "office",
    materials: { timber: 0, stone: 0, iron: 0 },
    laborSource: "player_pool",
  });
  assert(startRoomForCancel?.construction?.activeJob?.labor?.source === "player_pool", "Canary player builder was not assigned to room build.");
  const goldAfterRoomStartForCancel = await getOrgGold(org.internal_id);
  const cancelledRoom = await cancelOrganizationRoomBuildForUser(leader, org.internal_id, { reason: "canary_room_cancel_probe" });
  const goldAfterRoomCancel = await getOrgGold(org.internal_id);
  assert(cancelledRoom.cancelled?.noRefund === true, "Room cancel did not report no-refund mode.");
  assert(goldAfterRoomCancel === goldAfterRoomStartForCancel, "Room-build cancel refunded treasury unexpectedly.");

  const room1 = await startOrganizationRoomBuildForUser(leader, org.internal_id, {
    roomKey: "office",
    materials: { timber: 0, stone: 0, iron: 0 },
    laborSource: "npc_contractor",
  });
  assert(room1?.construction?.activeJob?.labor?.source === "npc_contractor", "NPC fallback room build did not use NPC labor.");
  await runOrganizationBaseLifecycleSweep({ now: Number(room1.construction.activeJob.completesAt) + 2000, actorInternalId: leader.internalId });

  const room2 = await startOrganizationRoomBuildForUser(leader, org.internal_id, {
    roomKey: "vault",
    materials: { timber: 0, stone: 0, iron: 0 },
    laborSource: "npc_contractor",
  });
  await runOrganizationBaseLifecycleSweep({ now: Number(room2.construction.activeJob.completesAt) + 2000, actorInternalId: leader.internalId });

  let capacityBlocked = false;
  try {
    await startOrganizationRoomBuildForUser(leader, org.internal_id, {
      roomKey: "archive",
      materials: { timber: 0, stone: 0, iron: 0 },
      laborSource: "npc_contractor",
    });
  } catch (error) {
    if (error instanceof HttpError && error.code === "ORG_BASE_ROOM_CAPACITY_REACHED") capacityBlocked = true;
  }
  assert(capacityBlocked, "Small plot capacity did not block the third completed room.");

  const goldBeforeRoomRemove = await getOrgGold(org.internal_id);
  const removedRoom = await removeOrganizationBaseRoomForUser(leader, org.internal_id, { roomKey: "office" });
  const goldAfterRoomRemove = await getOrgGold(org.internal_id);
  assert(goldAfterRoomRemove === goldBeforeRoomRemove - Number(removedRoom.removed?.removalCostGold ?? 0), "Room removal treasury math mismatch.");

  await setStaleBuilderAssignment(builder, org.internal_id, leader);
  const staleSweep = await runOrganizationBaseLifecycleSweep({ now: Date.now(), actorInternalId: leader.internalId });
  assert(Number(staleSweep.staleBuilderReservationCount ?? 0) >= 1, "Stale builder reservation sweep did not release the canary assignment.");

  const builderTrack = await getBuilderTrack(builder.internalId);
  const reservationHistory = Array.isArray(builderTrack.reservationHistory) ? builderTrack.reservationHistory : [];
  const hasReleaseReason = (reason) => reservationHistory.some((entry) => entry?.eventType === "released" && entry?.reason === reason);
  assert(!builderTrack.activeAssignment, "Builder active assignment remained after stale sweep.");
  assert(hasReleaseReason("main_build_cancelled"), "Builder history missing main-build cancel release reason.");
  assert(hasReleaseReason("main_build_completed"), "Builder history missing main-build completion release reason.");
  assert(hasReleaseReason("room_build_cancelled"), "Builder history missing room-build cancel release reason.");
  assert(hasReleaseReason("base_lifecycle_sweep_expired"), "Builder history missing stale sweep release reason.");

  const consortiumView = await getMyOrganization(leader, "consortium");
  const myOrg = consortiumView?.organization;
  const effects = asRecord(myOrg?.baseMechanicalEffects?.effects);
  const logisticsBoard = await getConsortiumLogisticsBoardForUser(leader, org.internal_id);
  const logisticsEffects = asRecord(logisticsBoard.logistics?.baseMechanicalEffects?.effects);
  assert(Number(effects.logisticsRewardPct ?? 0) > 0, "Consortium base logistics reward effect did not surface on organization view.");
  assert(Number(logisticsEffects.logisticsRewardPct ?? 0) > 0, "Consortium logistics board did not receive base effects.");

  const ownershipFinal = await getOrganizationBaseOwnershipForUser(leader, org.internal_id);
  const evidenceRows = await listEvidenceRows(org.internal_id);

  report.validations = {
    levelGate: levelGateBlocked,
    plotPurchase: Boolean(reacquiredPlot?.base?.baseId),
    sellbackLoss: sellbackGold < acquisitionCostGold,
    noUpkeepOnUnbuiltPlot: Number(reacquiredPlot.base?.monthlyUpkeepGold ?? 0) === 0,
    mainBuildStarted: Boolean(mainJob?.jobId),
    playerBuilderAssignment: startMain?.construction?.activeJob?.labor?.source === "player_pool",
    mainCancelNoRefund: goldAfterMainCancel === goldAfterMainStartForCancel,
    mainCompletionSweep: afterMain.base?.buildingState === "main_building_complete",
    qualityPersistence: Boolean(afterMain.base?.buildQuality?.tier),
    upkeepAfterCompletion: Number(afterMain.base?.monthlyUpkeepGold ?? 0) > 0,
    upkeepAccrual: Number(afterAccrual.base?.periodDueGold ?? 0) >= 1,
    roomCancelSupport: cancelledRoom.cancelled?.noRefund === true,
    roomCancelNoRefund: goldAfterRoomCancel === goldAfterRoomStartForCancel,
    npcFallback: room1?.construction?.activeJob?.labor?.source === "npc_contractor",
    roomConstruction: Boolean(room2?.construction?.activeJob?.jobId),
    roomCapacityEnforced: capacityBlocked,
    roomRemovalNoRefund: goldAfterRoomRemove === goldBeforeRoomRemove - Number(removedRoom.removed?.removalCostGold ?? 0),
    staleReservationSweep: Number(staleSweep.staleBuilderReservationCount ?? 0) >= 1,
    reservationReleaseReasons: ["main_build_cancelled", "main_build_completed", "room_build_cancelled", "base_lifecycle_sweep_expired"].every(hasReleaseReason),
    consortiumMechanicalEffects: Number(effects.logisticsRewardPct ?? 0) > 0,
    logisticsBoardEffects: Number(logisticsEffects.logisticsRewardPct ?? 0) > 0,
  };

  report.evidence = {
    treasury: {
      beforeGold,
      afterMainStartForCancel: goldAfterMainStartForCancel,
      afterMainCancel: goldAfterMainCancel,
      afterRoomStartForCancel: goldAfterRoomStartForCancel,
      afterRoomCancel: goldAfterRoomCancel,
      beforeRoomRemove: goldBeforeRoomRemove,
      afterRoomRemove: goldAfterRoomRemove,
    },
    sellback: { acquisitionCostGold, sellbackGold },
    sweeps: {
      mainSweep: {
        completedMainBuildCount: mainSweep.completedMainBuildCount,
        completedRoomBuildCount: mainSweep.completedRoomBuildCount,
        staleBuilderReservationCount: mainSweep.staleBuilderReservationCount,
      },
      upkeepSweep: {
        accruedCount: upkeepSweep.accruedCount,
        reviewCount: upkeepSweep.reviewCount,
        staleBuilderReservationCount: upkeepSweep.staleBuilderReservationCount,
      },
      staleSweep: {
        staleBuilderReservationCount: staleSweep.staleBuilderReservationCount,
        staleBuilderReservations: staleSweep.staleBuilderReservations,
      },
    },
    baseSnapshots: {
      afterPlot: reacquiredPlot.base,
      afterMain: afterMain.base,
      afterAccrual: afterAccrual.base,
      final: ownershipFinal.base,
    },
    mechanicalEffects: myOrg.baseMechanicalEffects,
    logisticsBoardEffects: logisticsBoard.logistics?.baseMechanicalEffects,
    builderReservationHistory: reservationHistory,
    eventTypes: evidenceRows.events.map((entry) => entry.event_type),
    logTypes: evidenceRows.logs.map((entry) => entry.action_type),
    eventRows: evidenceRows.events,
    baseRows: evidenceRows.bases,
  };

  console.log(JSON.stringify(report, null, 2));
}

let failed = false;

main()
  .catch((error) => {
    failed = true;
    console.error("CONSORTIUM_PROPERTY_OFFICE_CANARY_FAILED");
    console.error(error?.stack || error);
  })
  .finally(async () => {
    await closePool();
    if (failed) process.exit(1);
  });
