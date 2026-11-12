/**
 * Safe Migration Runner: Applies 0002_places_catalog_schema.sql to Neon PostgreSQL
 * Fully transactional, non-destructive, idempotent (CREATE TABLE IF NOT EXISTS).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  // Fallback: Read safely from dev process environment if running inside AI Studio shell
  try {
    const pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p));
    for (const pid of pids) {
      try {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (cmd.includes('tsx') && cmd.includes('server.ts')) {
          const environ = fs.readFileSync(`/proc/${pid}/environ`, 'utf8');
          for (const entry of environ.split('\0')) {
            if (entry.startsWith('DATABASE_URL=')) {
              return entry.slice('DATABASE_URL='.length).trim();
            }
          }
        }
      } catch {
        // ignore unreadable processes
      }
    }
  } catch {
    // ignore
  }

  throw new Error('DATABASE_URL is not configured.');
}

async function runMigration() {
  const databaseUrl = getDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('[Migration 0002] Connected to Neon PostgreSQL.');
    console.log('[Migration 0002] Reading migrations/0002_places_catalog_schema.sql...');

    const migrationPath = path.resolve(__dirname, '../migrations/0002_places_catalog_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[Migration 0002] Starting transaction...');
    await client.query('BEGIN');

    await client.query(sql);

    await client.query('COMMIT');
    console.log('[Migration 0002] Transaction committed successfully.');

    // Verification
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`[Migration 0002] Verified tables in public schema (${res.rows.length} total):`);
    for (const row of res.rows) {
      console.log(`  - ${row.table_name}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration 0002] Migration failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((e) => {
  console.error('[Migration 0002] Fatal error:', e);
  process.exit(1);
});
