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

const CONTENT_CHANGE_REQUESTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS content_change_requests (
    id SERIAL PRIMARY KEY,
    created_by VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    changes JSONB NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(64)
  );
  CREATE INDEX IF NOT EXISTS idx_content_change_requests_status
    ON content_change_requests (status, created_at);
`;

const EVENT_LOGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS event_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(40) NOT NULL,
    actor VARCHAR(64) NOT NULL,
    actor_role VARCHAR(20) NOT NULL DEFAULT 'admin',
    target_user VARCHAR(64),
    submission_id INTEGER,
    title TEXT,
    category VARCHAR(20),
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs (created_at);
  CREATE INDEX IF NOT EXISTS idx_event_logs_actor ON event_logs (actor);
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
  await client.query(
    `ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'Events'`
  );
  await client.query(
    `ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS start_date DATE`
  );
  await client.query(
    `ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS end_date DATE`
  );
  await client.query(
    `ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS start_time TIME`
  );
  await client.query(
    `ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS end_time TIME`
  );

  // Older installs stored end_date as a non-null VARCHAR. Normalize it to a
  // nullable DATE so a missing end date means "single day".
  const endDateColumn = await client.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_submissions'
       AND column_name = 'end_date'`
  );
  if (endDateColumn.rows[0]?.data_type === 'character varying') {
    await client.query(
      `ALTER TABLE event_submissions ALTER COLUMN end_date DROP DEFAULT`
    );
    await client.query(
      `ALTER TABLE event_submissions ALTER COLUMN end_date DROP NOT NULL`
    );
    await client.query(
      `ALTER TABLE event_submissions
       ALTER COLUMN end_date TYPE DATE USING NULLIF(end_date, '')::date`
    );
  }

  await client.query(EVENT_LOGS_TABLE_SQL);
  await client.query(CONTENT_CHANGE_REQUESTS_TABLE_SQL);

  const hashed = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await client.query(
    `INSERT INTO admin_users (username, hashed_password, role)
     VALUES ($1, $2, 'super_admin')
     ON CONFLICT (username)
     DO UPDATE SET role = 'super_admin'`,
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
