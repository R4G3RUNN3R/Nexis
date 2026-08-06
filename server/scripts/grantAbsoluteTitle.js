// One-off operator script: grants "The Absolute" to the single allowlisted
// account (public ID 1,000,000 / ABSOLUTE_OWNER_PUBLIC_ID - "Hennet
// Uthellien" per server/lib/userIdentity.js and scripts/seed-staff-accounts.mjs).
//
// This script takes NO target argument on purpose. It only ever calls
// grantAbsoluteTitleToAllowlistedAccount(), which itself only ever looks up
// ABSOLUTE_OWNER_PUBLIC_ID - there is no way to point this at a different
// account. Run it once, against the real database, by someone who has
// confirmed which row that public ID resolves to in production:
//
//   DATABASE_URL=postgres://... node server/scripts/grantAbsoluteTitle.js
//
// It is safe to re-run: grantAbsoluteTitleToAllowlistedAccount() is
// idempotent (it checks grantedTitleIds before granting again).

import { closePool } from "../db/pool.js";
import { grantAbsoluteTitleToAllowlistedAccount } from "../services/titleService.js";

async function main() {
  const actor = process.env.USER || process.env.LOGNAME || "manual-seed";
  const result = await grantAbsoluteTitleToAllowlistedAccount({ actor });

  if (result.alreadyGranted) {
    console.log(`The Absolute was already granted to publicId=${result.publicId} internalId=${result.internalId}. No changes made.`);
    return;
  }

  console.log(
    `Granted The Absolute to publicId=${result.publicId} internalId=${result.internalId} at ${new Date(result.grantedAt).toISOString()}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
