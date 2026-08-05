import { withTransaction } from "../db/pool.js";
import { searchUsers } from "../repositories/usersRepository.js";
import { listOrganizationsByType } from "../repositories/organizationRepository.js";
import { listMarketplaceListings } from "../repositories/marketplaceRepository.js";
import { getItemDisplayName } from "../data/itemData.js";

// Matches formatPlayerPublicId() in src/lib/publicIds.ts (7-digit
// zero-padded, "P" prefix). No backend equivalent existed - every other
// service returns raw publicId and lets the frontend format it, but this
// endpoint's results are rendered directly without a client-side formatting
// pass, so the route is built here instead.
function playerProfileRoute(publicId) {
  return `/profile/P${String(publicId).padStart(7, "0")}`;
}

const CATEGORIES = ["user", "faction", "company", "market"];

function matches(haystack, needle) {
  return String(haystack ?? "").toLowerCase().includes(needle);
}

async function searchUserDirectory(client, term, limit) {
  const rows = await searchUsers(client, term, limit);
  // searchUsers() returns the full mapUserRow() shape (includes email) for
  // the admin panel's own use - never forward that to this player-facing
  // endpoint. Name, public ID, and a profile route only.
  return rows.map((row) => ({
    id: `user-${row.publicId}`,
    label: `${row.firstName}${row.lastName ? ` ${row.lastName}` : ""}`.trim(),
    hint: `Citizen P${row.publicId}`,
    to: playerProfileRoute(row.publicId),
  }));
}

async function searchOrganizations(client, type, term, limit) {
  const rows = await listOrganizationsByType(client, type);
  const lowerTerm = term.toLowerCase();
  return rows
    .filter((row) => matches(row.name, lowerTerm) || matches(row.tag, lowerTerm))
    .slice(0, limit)
    .map((row) => ({
      id: `${type}-${row.publicId}`,
      label: row.name,
      hint: row.tag ? `[${row.tag}]` : type === "guild" ? "Guild" : (row.consortiumTypeName ?? "Consortium"),
      to: type === "guild" ? `/guilds/G${row.publicId}` : `/consortiums/C${row.publicId}`,
    }));
}

async function searchMarket(client, term, limit) {
  const listings = await listMarketplaceListings(client, { status: "active" });
  const lowerTerm = term.toLowerCase();
  return listings
    .map((listing) => ({ listing, itemName: getItemDisplayName(listing.itemId) }))
    .filter(({ itemName }) => matches(itemName, lowerTerm))
    .slice(0, limit)
    .map(({ listing, itemName }) => ({
      id: `market-${listing.id}`,
      label: itemName,
      hint: `${listing.quantity}x at ${listing.unitPrice.toLocaleString("en-GB")} gold each`,
      to: "/city#market",
    }));
}

export async function searchDirectory(category, queryText, limit = 8) {
  const term = String(queryText ?? "").trim();
  const boundedLimit = Math.max(1, Math.min(20, Number(limit) || 8));
  if (!term || !CATEGORIES.includes(category)) return { results: [] };

  return withTransaction(async (client) => {
    if (category === "user") return { results: await searchUserDirectory(client, term, boundedLimit) };
    if (category === "faction") return { results: await searchOrganizations(client, "guild", term, boundedLimit) };
    if (category === "company") return { results: await searchOrganizations(client, "consortium", term, boundedLimit) };
    if (category === "market") return { results: await searchMarket(client, term, boundedLimit) };
    return { results: [] };
  });
}
