import { withTransaction } from "../db/pool.js";
import { listConsortiumRankings, listGuildRankings, listPendingRankings } from "../repositories/siteRepository.js";

function buildPendingTitle(level, battleScore, workingScore) {
  if (level >= 25 || battleScore >= 220) return "Provisional war-tier citizen";
  if (workingScore >= 150) return "Provisional builder of consequence";
  if (level >= 12) return "Provisional rising operator";
  return "Provisional shard entrant";
}

function buildSummary(level, battleScore, workingScore) {
  if (battleScore > workingScore + 25) {
    return `Leaning combat-first with level ${level} footing and a sharper battle scan than work scan.`;
  }
  if (workingScore > battleScore + 25) {
    return `Leaning craft and discipline with level ${level} growth and a stronger working scan than battle scan.`;
  }
  return `Balanced progression signature with level ${level} growth and pressure visible on both sides of the scan.`;
}

function createPlayerEntry(row, rank) {
  return {
    rank,
    name: `${row.firstName}${row.lastName ? ` ${row.lastName}` : ""}`.trim(),
    publicId: row.publicId,
    level: row.level,
    battleScore: row.battleScore,
    workingScore: row.workingScore,
    overallScore: row.level * 10 + row.battleScore + row.workingScore,
    pendingTitle: buildPendingTitle(row.level, row.battleScore, row.workingScore),
    summary: buildSummary(row.level, row.battleScore, row.workingScore),
  };
}

function buildPlayerBoards(rows, limit) {
  const overallRows = [...rows]
    .sort((left, right) => (right.level * 10 + right.battleScore + right.workingScore) - (left.level * 10 + left.battleScore + left.workingScore))
    .slice(0, limit)
    .map((row, index) => createPlayerEntry(row, index + 1));
  const combatRows = [...rows]
    .sort((left, right) => right.battleScore - left.battleScore || right.level - left.level)
    .slice(0, limit)
    .map((row, index) => ({ ...createPlayerEntry(row, index + 1), summary: `Battle scan ${row.battleScore}. Built for direct pressure, which is a polite way to say trouble.` }));
  const workingRows = [...rows]
    .sort((left, right) => right.workingScore - left.workingScore || right.level - left.level)
    .slice(0, limit)
    .map((row, index) => ({ ...createPlayerEntry(row, index + 1), summary: `Working scan ${row.workingScore}. Quiet competence, terrifying persistence, and probably ledgers.` }));

  return [
    { key: "overall", title: "Overall", metricLabel: "Overall scan", entries: overallRows },
    { key: "combat", title: "Combat", metricLabel: "Battle scan", entries: combatRows },
    { key: "working", title: "Working", metricLabel: "Working scan", entries: workingRows },
  ];
}

export async function getPendingRankings(limit = 6) {
  return withTransaction(async (client) => {
    const playerRows = await listPendingRankings(client, Math.max(limit * 3, 18));
    const guildRows = await listGuildRankings(client, limit);
    const consortiumRows = await listConsortiumRankings(client, limit);
    const playerBoards = buildPlayerBoards(playerRows, limit);
    const playerRankings = playerBoards[0]?.entries ?? [];

    const guildRankings = guildRows.map((row, index) => ({
      rank: index + 1,
      name: row.name,
      publicId: row.publicId,
      tag: row.tag,
      reputationTotal: row.reputationTotal,
      memberCount: row.memberCount,
      summary: `${row.memberCount} member${row.memberCount === 1 ? "" : "s"} holding ${row.reputationTotal.toLocaleString("en-GB")} guild reputation.`,
    }));

    const consortiumRankings = consortiumRows.map((row, index) => ({
      rank: index + 1,
      name: row.name,
      publicId: row.publicId,
      consortiumTypeName: row.consortiumTypeName,
      earningsTotal: row.earningsTotal,
      stars: row.stars,
      memberCount: row.memberCount,
      summary: `${row.consortiumTypeName} with ${row.memberCount} employee${row.memberCount === 1 ? "" : "s"} and ${row.earningsTotal.toLocaleString("en-GB")} gold in retained earnings.`,
    }));

    return {
      statusLabel: playerRankings.length ? "Live player scan online" : "Pending",
      rankings: playerRankings,
      playerRankings: {
        statusLabel: playerRankings.length ? "Live player scan online" : "Pending",
        methodLabel: "Overall, combat, and working scans",
        entries: playerRankings,
        boards: playerBoards,
      },
      guildRankings: {
        statusLabel: guildRankings.length ? "Live guild charter standings" : "Pending",
        methodLabel: "Guild reputation totals",
        entries: guildRankings,
      },
      consortiumRankings: {
        statusLabel: consortiumRankings.length ? "Live consortium ledgers" : "Pending",
        methodLabel: "Retained earnings",
        entries: consortiumRankings,
      },
    };
  });
}
