import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { DATABASE_URL } from "../config/env.js";
import { DatabaseUnavailableError, HttpError } from "../lib/errors.js";

let databaseDriverPromise = null;

function wrapDatabaseError(error) {
  if (error instanceof DatabaseUnavailableError || error instanceof HttpError) {
    return error;
  }

  return new DatabaseUnavailableError(
    error instanceof Error && error.message
      ? `Database is unavailable: ${error.message}`
      : "Database is unavailable.",
  );
}

function createPglitePath() {
  return path.join(process.cwd(), ".data", "pglite");
}

async function createDatabaseDriver() {
  if (DATABASE_URL) {
    return {
      mode: "postgres",
      client: new Pool({ connectionString: DATABASE_URL }),
    };
  }

  await mkdir(path.join(process.cwd(), ".data"), { recursive: true });

  return {
    mode: "pglite",
    client: new PGlite(createPglitePath()),
  };
}

async function getDatabaseDriver() {
  if (!databaseDriverPromise) {
    databaseDriverPromise = createDatabaseDriver();
  }

  return databaseDriverPromise;
}

export function hasDatabaseConfig() {
  return Boolean(DATABASE_URL);
}

export async function getDatabaseMode() {
  const driver = await getDatabaseDriver();
  return driver.mode;
}

export async function query(text, params = []) {
  try {
    const driver = await getDatabaseDriver();
    return await driver.client.query(text, params);
  } catch (error) {
    throw wrapDatabaseError(error);
  }
}

export async function executeSql(sql) {
  try {
    const driver = await getDatabaseDriver();
    if (driver.mode === "postgres") {
      return await driver.client.query(sql);
    }

    return await driver.client.exec(sql);
  } catch (error) {
    throw wrapDatabaseError(error);
  }
}

export async function withTransaction(work) {
  const driver = await getDatabaseDriver();

  if (driver.mode === "postgres") {
    let client;

    try {
      client = await driver.client.connect();
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client?.query("ROLLBACK");
      } catch {
        // Ignore rollback failures while preserving the original database error.
      }

      throw wrapDatabaseError(error);
    } finally {
      client?.release();
    }
  }

  try {
    return await driver.client.transaction(async (transaction) =>
      work({
        query: (text, params = []) => transaction.query(text, params),
      }),
    );
  } catch (error) {
    throw wrapDatabaseError(error);
  }
}

export async function closePool() {
  if (!databaseDriverPromise) return;

  const driver = await databaseDriverPromise;
  databaseDriverPromise = null;

  if (driver.mode === "postgres") {
    await driver.client.end();
    return;
  }

  if (typeof driver.client.close === "function") {
    await driver.client.close();
  }
}
