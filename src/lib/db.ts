import { Pool, type PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { setDefaultResultOrder } from 'dns';
dotenv.config({ path: '.env.local' });

// Some serverless runtimes lack IPv6 egress while hosted Postgres (Neon)
// returns AAAA records. Prefer IPv4 so cold starts reliably reach the DB.
setDefaultResultOrder('ipv4first');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://iem_uem:iem_uem_password@localhost:5432/iem_uem_kiosk",
  // Keep serverless instances from opening a large pool per function.
  max: process.env.VERCEL ? 1 : 10
});

// The single super-admin account. Overridable via env if the deployment
// wants to use different credentials.
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'sudipta.sahana@uem.edu.in';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Hod@aiml';

const ADMIN_USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const EVENT_SUBMISSIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS event_submissions (
    id SERIAL PRIMARY KEY,
    created_by VARCHAR(64) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(64)
  );
`;

/**
 * Creates the auth-related tables (idempotent) and makes sure the single
 * super-admin account exists. Safe to call against an existing database --
 * older installs get the `role` column added and existing users stay as
 * regular 'admin' accounts.
 */
async function ensureAdminAuthSchema(client: PoolClient) {
  await client.query(ADMIN_USERS_TABLE_SQL);
  await client.query(
    `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin'`
  );
  await client.query(EVENT_SUBMISSIONS_TABLE_SQL);

  const hashed = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await client.query(
    `INSERT INTO admin_users (username, hashed_password, role)
     VALUES ($1, $2, 'super_admin')
     ON CONFLICT (username)
     DO UPDATE SET hashed_password = EXCLUDED.hashed_password, role = 'super_admin'`,
    [SUPER_ADMIN_USERNAME, hashed]
  );
}

// Run the lazy migration once per server process. Routes call this before
// touching auth/approval tables so a deployment doesn't need a manual
// migration step just to log in.
let adminSchemaPromise: Promise<void> | null = null;
export function ensureAdminSchema(): Promise<void> {
  if (!adminSchemaPromise) {
    adminSchemaPromise = (async () => {
      const client = await pool.connect();
      try {
        await ensureAdminAuthSchema(client);
      } finally {
        client.release();
      }
    })().catch((err) => {
      adminSchemaPromise = null;
      throw err;
    });
  }
  return adminSchemaPromise;
}

export async function initDb() {
  const client = await pool.connect();
  try {
    await ensureAdminAuthSchema(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS kiosk_content (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id VARCHAR(255) PRIMARY KEY,
        mime_type VARCHAR(100) NOT NULL,
        data BYTEA NOT NULL
      );
    `);
  } finally {
    client.release();
  }
}
