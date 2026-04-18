import { createApp } from "./app.js";
import { API_PORT } from "./config/env.js";
import { ensureDatabaseSchema } from "./db/migrate.js";
import { getDatabaseMode } from "./db/pool.js";

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

app.listen(API_PORT, "127.0.0.1", () => {
  console.log(
    `Nexis API listening on http://127.0.0.1:${API_PORT} (${databaseReady ? `${databaseMode} ready` : "database unavailable"})`,
  );
});
