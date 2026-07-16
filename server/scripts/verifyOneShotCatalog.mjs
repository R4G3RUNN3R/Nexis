import assert from "node:assert/strict";
import { getOneShotCampaigns } from "../data/nexisOneShotData.js";

const campaigns = getOneShotCampaigns();
assert.equal(campaigns.length >= 100, true, "Nexis should expose a large one-shot catalog");
assert.equal(campaigns.every((campaign) => Number.isInteger(campaign.durationMinutes) && campaign.durationMinutes > 0), true, "Every campaign should expose estimated duration");
assert.equal(campaigns.every((campaign) => Array.isArray(campaign.rewardTags) && campaign.rewardTags.length > 0), true, "Every campaign should expose reward tags for filtering");
assert.equal(campaigns.some((campaign) => campaign.rewardTags.includes("covert")), true, "Catalog should include covert reward filtering");
assert.equal(campaigns.some((campaign) => campaign.rewardTags.includes("travel")), true, "Catalog should include travel reward filtering");
console.log("one-shot catalog verification passed");
