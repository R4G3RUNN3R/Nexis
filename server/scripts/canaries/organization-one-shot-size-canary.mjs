import assert from "node:assert/strict";
import {
  ORGANIZATION_ONE_SHOT_CAMPAIGNS,
  ORGANIZATION_ONE_SHOT_TOKEN_COST,
  ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
  getOrganizationOneShotCampaigns,
} from "../../data/organizationOneShotData.js";
import { canResolveOrganizationOneShot } from "../../services/organizationOneShotService.js";

const REQUIRED_SIZES = [1, 2, 3, 5, 10, 15, 20];

function assertOk(condition, message) {
  assert.equal(Boolean(condition), true, message);
  console.log(`ok - ${message}`);
}

function tokenSignup(index) {
  return {
    publicId: 1000000 + index,
    tokenCommitment: { source: "sealed", cost: ORGANIZATION_ONE_SHOT_TOKEN_COST, consumedAt: 1000 + index, refundChance: ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE, refundedAt: null },
  };
}

assertOk(ORGANIZATION_ONE_SHOT_CAMPAIGNS.length >= REQUIRED_SIZES.length * 2, "organization one-shot catalog has enough runs for a full size ladder per org type");

for (const type of ["guild", "consortium"]) {
  const campaigns = getOrganizationOneShotCampaigns(type);
  const sizes = new Set(campaigns.map((campaign) => Number(campaign.minimumSignups)));
  for (const size of REQUIRED_SIZES) {
    assertOk(sizes.has(size), `${type} catalog includes a ${size}-token run`);
  }
  assertOk(campaigns.every((campaign) => Number.isInteger(campaign.minimumSignups) && campaign.minimumSignups >= 1 && campaign.minimumSignups <= 20), `${type} campaigns declare bounded integer signup requirements`);
}

const soloState = { status: "recruiting", signups: [tokenSignup(1)] };
assertOk(canResolveOrganizationOneShot(soloState, 1), "one-token organization campaign can resolve with one committed token");
assertOk(!canResolveOrganizationOneShot(soloState, 2), "two-token organization campaign does not resolve with one committed token");

const twentyState = { status: "recruiting", signups: Array.from({ length: 20 }, (_, index) => tokenSignup(index + 1)) };
assertOk(canResolveOrganizationOneShot(twentyState, 20), "twenty-token organization campaign can resolve at twenty committed tokens");

console.log("organization one-shot size canary passed");
