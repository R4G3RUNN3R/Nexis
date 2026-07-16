import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { query, withTransaction, closePool } from "../server/db/pool.js";
import { createUser } from "../server/repositories/usersRepository.js";
import { createDefaultPlayerState } from "../server/repositories/playerStateRepository.js";
import {
  PLAYER_PUBLIC_ID_BASE,
  FIRST_PLAYER_NUMERIC_ID,} from "../server/config/env.js";

const staffAccounts = [
  { publicId: 1000000, username: "Hennet",   email: "ragerunner__gr@hotmail.com",  firstName: "Hennet",   lastName: "Uthellien", password: "Thanos13Melina!", role: "owner" },
  { publicId: 1000001, username: "Staff01",  email: "rageruner@gmail.com",  firstName: "Dianna",    lastName: "Uthellien",        password: "Thanos13Melina!", role: "admin" },
  { publicId: 1000002, username: "Staff02",  email: "georgioszoumplias@gmail.com",  firstName: "Varkon",    lastName: "Sternhammer",        password: "Thanos13Melina!", role: "admin" },
  { publicId: 1000003, username: "Staff03",  email: "gzoumplias@gmail.com",  firstName: "Faelar",    lastName: "Splintersong",        password: "Thanos13Melina!", role: "admin" },
  { publicId: 1000004, username: "Staff04",  email: "patsianmarina@gmail.com",  firstName: "Solon",    lastName: "Ashcroft",        password: "Thanos13Melina!", role: "admin" },
  { publicId: 1000005, username: "Staff05",  email: "thanoszoumplias@gmail.com",  firstName: "Nyx",    lastName: "Caelestra",        password: "Thanos13Melina!", role: "admin" },
  { publicId: 1000006, username: "Staff06",  email: "replace7@example.com",  firstName: "Staff",    lastName: "06",        password: "ChangeMe_1000006!", role: "moderator" },
  { publicId: 1000007, username: "Staff07",  email: "replace8@example.com",  firstName: "Staff",    lastName: "07",        password: "ChangeMe_1000007!", role: "moderator" },
  { publicId: 1000008, username: "Staff08",  email: "replace9@example.com",  firstName: "Staff",    lastName: "08",        password: "ChangeMe_1000008!", role: "moderator" },
  { publicId: 1000009, username: "Staff09",  email: "replace10@example.com", firstName: "Staff",    lastName: "09",        password: "ChangeMe_1000009!", role: "moderator" },
  { publicId: 1000010, username: "Staff10",  email: "replace11@example.com", firstName: "Staff",    lastName: "10",        password: "ChangeMe_1000010!", role: "moderator" },
  { publicId: 1000011, username: "Staff11",  email: "replace12@example.com", firstName: "Staff",    lastName: "11",        password: "ChangeMe_1000011!", role: "moderator" },
  { publicId: 1000012, username: "Staff12",  email: "replace13@example.com", firstName: "Staff",    lastName: "12",        password: "ChangeMe_1000012!", role: "moderator" },
  { publicId: 1000013, username: "Staff13",  email: "replace14@example.com", firstName: "Staff",    lastName: "13",        password: "ChangeMe_1000013!", role: "moderator" },
  { publicId: 1000014, username: "Staff14",  email: "replace15@example.com", firstName: "Staff",    lastName: "14",        password: "ChangeMe_1000014!", role: "moderator" },
  { publicId: 1000015, username: "Staff15",  email: "replace16@example.com", firstName: "Staff",    lastName: "15",        password: "ChangeMe_1000015!", role: "moderator" },
  { publicId: 1000016, username: "Staff16",  email: "replace17@example.com", firstName: "Staff",    lastName: "16",        password: "ChangeMe_1000016!", role: "moderator" },
  { publicId: 1000017, username: "Staff17",  email: "replace18@example.com", firstName: "Staff",    lastName: "17",        password: "ChangeMe_1000017!", role: "moderator" },
  { publicId: 1000018, username: "Staff18",  email: "replace19@example.com", firstName: "Staff",    lastName: "18",        password: "ChangeMe_1000018!", role: "moderator" },
  { publicId: 1000019, username: "Staff19",  email: "replace20@example.com", firstName: "Staff",    lastName: "19",        password: "ChangeMe_1000019!", role: "moderator" },
];

function fail(message) {
  throw new Error(message);
}

function validateAccounts(accounts) {
  const publicIds = new Set();
  const usernames = new Set();
  const emails = new Set();

  for (const account of accounts) {
    if (!Number.isInteger(account.publicId)) {
      fail(`Invalid publicId for ${account.username}`);
    }
    if (account.publicId < PLAYER_PUBLIC_ID_BASE || account.publicId >= FIRST_PLAYER_NUMERIC_ID) {
      fail(
        `publicId ${account.publicId} is outside reserved range ${PLAYER_PUBLIC_ID_BASE}-${FIRST_PLAYER_NUMERIC_ID - 1}`,
      );
    }
    if (!account.username || !account.email || !account.firstName || !account.lastName || !account.password) {
      fail(`Missing required field on account ${JSON.stringify(account)}`);
    }
    if (!["owner", "admin", "moderator"].includes(account.role)) {
      fail(`Invalid role "${account.role}" for ${account.username}`);
    }
    if (publicIds.has(account.publicId)) fail(`Duplicate publicId ${account.publicId}`);
    if (usernames.has(account.username.toLowerCase())) fail(`Duplicate username ${account.username}`);
    if (emails.has(account.email.toLowerCase())) fail(`Duplicate email ${account.email}`);

    publicIds.add(account.publicId);
    usernames.add(account.username.toLowerCase());
    emails.add(account.email.toLowerCase());
  }
}

async function main() {
  validateAccounts(staffAccounts);

  await query(`
    CREATE TABLE IF NOT EXISTS user_staff_roles (
      user_internal_id TEXT PRIMARY KEY REFERENCES users(internal_id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existingUsers = await query(`SELECT public_id, username, email FROM users ORDER BY public_id`);
  if (existingUsers.rows.length > 0) {
    fail(`users table is not empty. Found ${existingUsers.rows.length} existing users. Aborting.`);
  }

  await withTransaction(async (client) => {
    for (const account of staffAccounts) {
      const internalId = `usr_${randomUUID()}`;
      const passwordHash = await bcrypt.hash(account.password, 10);

      await createUser(client, {
        internalId,
        publicId: account.publicId,
        username: account.username,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        passwordHash,
      });

      await createDefaultPlayerState(client, internalId);

      await client.query(
        `
          INSERT INTO user_staff_roles (user_internal_id, role)
          VALUES ($1, $2)
        `,
        [internalId, account.role],
      );
    }

    await client.query(
      `
        UPDATE public_id_allocators
        SET next_numeric_id = GREATEST(next_numeric_id, $2),
            updated_at = NOW()
        WHERE entity_type = $1
      `,
      ["player", FIRST_PLAYER_NUMERIC_ID],
    );
  });

  const result = await query(`
    SELECT
      u.public_id,
      u.username,
      u.email,
      r.role
    FROM users u
    LEFT JOIN user_staff_roles r
      ON r.user_internal_id = u.internal_id
    ORDER BY u.public_id ASC
  `);

  console.table(result.rows);
  console.log(`Next normal player ID remains ${FIRST_PLAYER_NUMERIC_ID}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
