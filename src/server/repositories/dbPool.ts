/**
 * Centralized Database Connection Pool for PostgreSQL / Neon
 * Reusable across repositories to prevent connection exhaustion.
 */

import { Pool } from 'pg';

let poolInstance: Pool | null = null;

export function getDbPool(connectionString?: string): Pool {
  if (!poolInstance) {
    const connStr = connectionString || process.env.DATABASE_URL?.trim();
    if (!connStr) {
      throw new Error('[Storage Architecture] DATABASE_URL is not configured');
    }

    poolInstance = new Pool({
      connectionString: connStr,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[Neon Pool Idle Error]', err?.message || err);
    });
  }

  return poolInstance;
}

export function setDbPoolForTesting(pool: Pool | null): void {
  poolInstance = pool;
}

export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
