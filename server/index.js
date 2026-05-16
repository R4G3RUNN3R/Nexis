import { createApp } from "./app.js";
import { API_PORT, ORG_BASE_SWEEP_ENABLED, ORG_BASE_SWEEP_INTERVAL_MS } from "./config/env.js";
import { ensureDatabaseSchema } from "./db/migrate.js";
import { getDatabaseMode } from "./db/pool.js";
import { runOrganizationBaseLifecycleSweep } from "./services/organizationBaseSafetyService.js";

const app = createApp();

let databaseReady = false;
let databaseMode = "postgres";

try {
  databaseReady = await ensureDatabaseSchema();
  databaseMode = await getDatabaseMode();
} catch (error) {
  console.warn(
    `Backend started without persistent database storage: ${
      error instanceof Error ? error.message : "Unknown database error."
    }`,
  );
}

function startOrganizationBaseSweepLoop() {
  if (!databaseReady || !ORG_BASE_SWEEP_ENABLED) {
    return;
  }

  const runSweep = async () => {
    try {
      const result = await runOrganizationBaseLifecycleSweep();
      if (result.dueReviewCount > 0 || result.expiredBuybackCount > 0) {
        console.log(
          `[org-base-sweep] dueReviews=${result.dueReviewCount} expiredBuybacks=${result.expiredBuybackCount}`,
        );
      }
    } catch (error) {
      console.warn(
        `[org-base-sweep] failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  };

  setInterval(runSweep, ORG_BASE_SWEEP_INTERVAL_MS);
  void runSweep();
}

app.listen(API_PORT, "127.0.0.1", () => {
  console.log(
    `Nexis API listening on http://127.0.0.1:${API_PORT} (${databaseReady ? `${databaseMode} ready` : "database unavailable"})`,
  );
  startOrganizationBaseSweepLoop();
});
