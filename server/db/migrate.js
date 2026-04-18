import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIRST_PLAYER_NUMERIC_ID,
  PLAYER_PUBLIC_ID_BASE,
} from "../config/env.js";
import { executeSql, query } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "schema.sql");

export async function ensureDatabaseSchema() {
  const sql = await readFile(schemaPath, "utf8");
  await executeSql(sql);

  await query(
    `
      INSERT INTO public_id_allocators (entity_type, next_numeric_id)
      VALUES
        ('player', $1),
        ('guild', $2),
        ('consortium', $3)
      ON CONFLICT (entity_type) DO NOTHING
    `,
    [FIRST_PLAYER_NUMERIC_ID, PLAYER_PUBLIC_ID_BASE + 20, PLAYER_PUBLIC_ID_BASE + 20],
  );

  return true;
}
