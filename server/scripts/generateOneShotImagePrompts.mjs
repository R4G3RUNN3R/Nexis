// Generates ChatGPT-ready image prompts for every DMOS one-shot image slot
// (thumb / opening / decision / outcome-1 / outcome-2 - 5 per campaign) and
// writes them to a CSV the user works through by hand: copy prompt -> ChatGPT
// -> save PNG at filePath -> flip status to "done". Re-running the script is
// safe - it keeps whatever status you've already recorded for a given
// (campaignId, slot) and only refreshes filePath/prompt.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOneShotCampaigns, getOneShotCampaign } from "../data/nexisOneShotData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_OUT = path.join(__dirname, "..", "data", "oneShotImagePrompts.csv");
const HANDWRITTEN_CAMPAIGN_IDS = new Set([
  "nexis-registry-door",
  "blackharbor-salt-writ",
  "silverbough-root-bell",
  "ironhall-furnace-ledger",
  "highcourt-sealed-petition",
]);

const STYLE_ANCHOR = "Painted dark-fantasy illustration in a restrained gold-and-sage palette over deep charcoal shadow, moody directional lighting, textured brushwork, cinematic widescreen composition, no text, no watermark, no UI elements, no borders.";

const CSV_COLUMNS = ["campaignId", "campaignTitle", "cityId", "slot", "filePath", "status", "prompt"];
const SLOT_ORDER = ["thumb", "opening", "decision", "outcome-1", "outcome-2"];

function parseArgs(argv) {
  const args = { pilot: false, campaignId: null, out: DEFAULT_OUT };
  for (const raw of argv) {
    if (raw === "--pilot") args.pilot = true;
    else if (raw.startsWith("--campaign=")) args.campaignId = raw.slice("--campaign=".length);
    else if (raw.startsWith("--out=")) args.out = path.resolve(process.cwd(), raw.slice("--out=".length));
  }
  return args;
}

function truncate(value, maxLength) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function getScene(campaign, sceneId) {
  return campaign.scenes?.[sceneId] ?? null;
}

function briefForSlot(campaign, slot) {
  const startSceneId = campaign.startSceneId;
  const decisionSceneId = `${campaign.id}-decision`;
  const openingScene = getScene(campaign, startSceneId);
  const decisionScene = getScene(campaign, decisionSceneId);
  const cityLine = `Setting: ${campaign.region}, in the world of Nexis.`;
  const isCombat = campaign.kind === "combat";
  const subjectLine = isCombat && campaign.encounterSubject ? `Focal subject the player must actually see: ${campaign.encounterSubject}.` : null;

  if (slot === "thumb") {
    return [
      `Cover illustration for the DMOS one-shot contract "${campaign.title}".`,
      cityLine,
      subjectLine,
      isCombat
        ? "A single striking image of the threat itself, mid-action or looming, establishing danger at a glance."
        : "A single striking image of the mystery's central object, document, or scene, establishing intrigue at a glance.",
    ].filter(Boolean).join(" ");
  }

  if (slot === "opening") {
    return [
      `Opening scene of "${campaign.title}".`,
      cityLine,
      subjectLine,
      openingScene?.narration ? `Scene: ${truncate(openingScene.narration, 260)}` : null,
    ].filter(Boolean).join(" ");
  }

  if (slot === "decision") {
    return [
      `Decision scene of "${campaign.title}" - the moment the crew commits to a plan of action.`,
      cityLine,
      subjectLine,
      decisionScene?.narration ? `Scene: ${truncate(decisionScene.narration, 260)}` : null,
    ].filter(Boolean).join(" ");
  }

  const outcomeIndex = slot === "outcome-1" ? 0 : 1;
  const choice = decisionScene?.choices?.[outcomeIndex] ?? null;
  const outcomeText = choice?.conclusion?.outcome ?? choice?.conclusion?.chronicleSummary ?? null;
  return [
    `Outcome illustration ${outcomeIndex + 1} of "${campaign.title}", depicting how the crew's choice resolves.`,
    cityLine,
    subjectLine,
    outcomeText ? `Outcome: ${truncate(outcomeText, 260)}` : null,
  ].filter(Boolean).join(" ");
}

function buildRows(campaigns) {
  const rows = [];
  for (const campaign of campaigns) {
    for (const slot of SLOT_ORDER) {
      const filePath = path.posix.join("public", "one-shot-images", campaign.id, `${campaign.id}-${slot}.png`);
      const prompt = `${STYLE_ANCHOR} ${briefForSlot(campaign, slot)}`;
      rows.push({ campaignId: campaign.id, campaignTitle: campaign.title, cityId: campaign.cityId, slot, filePath, status: "pending", prompt });
    }
  }
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) lines.push(CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  return lines.join("\n") + "\n";
}

// Minimal RFC4180-style parser - handles quoted fields with embedded commas,
// escaped quotes ("") and embedded newlines, which a spreadsheet re-save of
// this CSV could plausibly produce.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ",") { row.push(field); field = ""; i += 1; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = []; i += 1; continue;
    }
    field += char; i += 1;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""])));
}

function loadExistingStatuses(outPath) {
  const statuses = new Map();
  if (!fs.existsSync(outPath)) return statuses;
  const parsed = parseCsv(fs.readFileSync(outPath, "utf8"));
  for (const record of parsed) {
    if (!record.campaignId || !record.slot) continue;
    statuses.set(`${record.campaignId}::${record.slot}`, record.status || "pending");
  }
  return statuses;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let campaigns;
  if (args.campaignId) {
    const campaign = getOneShotCampaign(args.campaignId);
    if (!campaign) throw new Error(`Unknown campaign id: ${args.campaignId}`);
    campaigns = [campaign];
  } else if (args.pilot) {
    campaigns = getOneShotCampaigns().filter((campaign) => HANDWRITTEN_CAMPAIGN_IDS.has(campaign.id));
  } else {
    campaigns = getOneShotCampaigns();
  }

  const rows = buildRows(campaigns);
  const existingStatuses = loadExistingStatuses(args.out);
  for (const row of rows) {
    const preserved = existingStatuses.get(`${row.campaignId}::${row.slot}`);
    if (preserved) row.status = preserved;
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, toCsv(rows), "utf8");

  const doneCount = rows.filter((row) => row.status === "done").length;
  console.log(`Wrote ${rows.length} image prompt rows (${campaigns.length} campaigns x ${SLOT_ORDER.length} slots) to ${path.relative(REPO_ROOT, args.out)}.`);
  console.log(`Status carried over from previous run: ${doneCount} marked done, ${rows.length - doneCount} pending.`);
}

main();
