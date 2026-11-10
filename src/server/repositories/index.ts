/**
 * Repository Factory & Infrastructure Detector
 * Selects PostgreSQL or Memory Adapter based on environment variables.
 * Enforces strict fail-fast validation in production without credential leaks.
 */

import type { IAuthRepository, ICreatorsRepository } from './interfaces.ts';
import { MemoryCreatorsRepository } from './memoryCreatorsRepository.ts';
import { PostgresCreatorsRepository } from './postgresCreatorsRepository.ts';

let authRepoInstance: IAuthRepository | null = null;
let creatorsRepoInstance: ICreatorsRepository | null = null;
let activeDatabaseAdapter: PostgresCreatorsRepository | MemoryCreatorsRepository | null = null;

export function isValidPostgresUrl(rawUrl: string): boolean {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
      return false;
    }
    const parsed = new URL(trimmed);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

function getSanitizedHost(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl.trim());
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return 'PostgreSQL Endpoint';
  }
}

export function validateDatabaseConfig(): void {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!databaseUrl) {
      throw new Error(
        '[Storage Architecture] FATAL: DATABASE_URL is missing in production environment. Refusing to start without persistent PostgreSQL.'
      );
    }
    if (!isValidPostgresUrl(databaseUrl)) {
      throw new Error(
        '[Storage Architecture] FATAL: DATABASE_URL has an invalid PostgreSQL format in production environment.'
      );
    }
  } else {
    if (databaseUrl && !isValidPostgresUrl(databaseUrl)) {
      console.warn(
        `[Storage Architecture] WARNING: DATABASE_URL provided is not a valid PostgreSQL URL (${databaseUrl.slice(0, 12)}...). Falling back to development In-Memory Adapter.`
      );
    }
  }
}

function initializeRepositories(): {
  auth: IAuthRepository;
  creators: ICreatorsRepository;
  adapter: PostgresCreatorsRepository | MemoryCreatorsRepository;
} {
  validateDatabaseConfig();

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (databaseUrl) {
    if (!isValidPostgresUrl(databaseUrl)) {
      if (isProduction) {
        throw new Error(
          '[Storage Architecture] FATAL: DATABASE_URL has an invalid PostgreSQL format in production environment.'
        );
      }
      console.warn(
        '[Storage Architecture] WARNING: DATABASE_URL provided is not a valid PostgreSQL URL. Falling back to development In-Memory Adapter.'
      );
    } else {
      const sanitized = getSanitizedHost(databaseUrl);
      console.log(`[Storage Architecture] Activating PostgreSQL RDBMS adapter (${sanitized}).`);
      const postgresAdapter = new PostgresCreatorsRepository(databaseUrl);

      // Lazily initialize persistent Postgres place catalog adapter
      try {
        const { getDbPool } = require('./dbPool.ts');
        const { PostgresPlaceRepository } = require('./postgresPlaceRepository.ts');
        const { setPlaceRepositoryInstance } = require('./placeRepository.ts');
        const pool = getDbPool(databaseUrl);
        setPlaceRepositoryInstance(new PostgresPlaceRepository(pool));
      } catch {
        // Dynamic import fallback for ESM environments
        import('./dbPool.ts').then(({ getDbPool }) => {
          import('./postgresPlaceRepository.ts').then(({ PostgresPlaceRepository }) => {
            import('./placeRepository.ts').then(({ setPlaceRepositoryInstance }) => {
              const pool = getDbPool(databaseUrl);
              setPlaceRepositoryInstance(new PostgresPlaceRepository(pool));
            });
          });
        }).catch(() => {});
      }

      return {
        auth: postgresAdapter,
        creators: postgresAdapter,
        adapter: postgresAdapter,
      };
    }
  }

  // Strictly forbid in-memory fallback in production
  if (isProduction) {
    throw new Error(
      '[Storage Architecture] FATAL: Silent in-memory fallback is strictly forbidden in production. DATABASE_URL must be configured.'
    );
  }

  console.log(
    '[Storage Architecture] DATABASE_URL is not set. Operating in development In-Memory Adapter. All interfaces match PostgreSQL 1:1.'
  );
  const memoryAdapter = new MemoryCreatorsRepository();
  return {
    auth: memoryAdapter,
    creators: memoryAdapter,
    adapter: memoryAdapter,
  };
}

export function getAuthRepository(): IAuthRepository {
  if (!authRepoInstance) {
    const initialized = initializeRepositories();
    authRepoInstance = initialized.auth;
    creatorsRepoInstance = initialized.creators;
    activeDatabaseAdapter = initialized.adapter;
  }
  return authRepoInstance;
}

export function getCreatorsRepository(): ICreatorsRepository {
  if (!creatorsRepoInstance) {
    const initialized = initializeRepositories();
    authRepoInstance = initialized.auth;
    creatorsRepoInstance = initialized.creators;
    activeDatabaseAdapter = initialized.adapter;
  }
  return creatorsRepoInstance;
}

export async function verifyDatabaseConnectivity(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  // Ensure repositories are initialized
  getCreatorsRepository();

  if (isProduction && (!activeDatabaseAdapter || !(activeDatabaseAdapter instanceof PostgresCreatorsRepository))) {
    // If it's a mock with testConnection, allow it only if testConnection exists
    if (!activeDatabaseAdapter || typeof (activeDatabaseAdapter as { testConnection?: unknown }).testConnection !== 'function') {
      throw new Error(
        '[Storage Architecture] FATAL: Persistent PostgreSQL adapter is mandatory in production. Silent in-memory fallback is strictly forbidden.'
      );
    }
  }

  if (activeDatabaseAdapter && typeof activeDatabaseAdapter.testConnection === 'function') {
    try {
      await activeDatabaseAdapter.testConnection();
      console.log('[Storage Architecture] Database connectivity verified successfully with PostgreSQL.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[Storage Architecture] Database connectivity test failed: ${message}`
      );
      if (isProduction) {
        throw new Error(
          `[Storage Architecture] FATAL: Unable to establish PostgreSQL connection in production (${message}). Server startup aborted.`
        );
      } else {
        console.warn(
          `[Storage Architecture] WARNING: Database connection failed in development (${message}). Operating with in-memory adapter.`
        );
        const memoryAdapter = new MemoryCreatorsRepository();
        authRepoInstance = memoryAdapter;
        creatorsRepoInstance = memoryAdapter;
        activeDatabaseAdapter = memoryAdapter;
        try {
          const { setPlaceRepositoryInstance } = await import('./placeRepository.ts');
          setPlaceRepositoryInstance(null);
        } catch {
          // ignore
        }
      }
    }
  } else if (isProduction) {
    throw new Error(
      '[Storage Architecture] FATAL: Persistent PostgreSQL adapter is mandatory in production. In-memory adapter cannot be used.'
    );
  }
}

/**
 * Real-time health check for database connection
 * Returns connectivity status without exposing credentials or secrets.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  adapter: 'postgres' | 'memory' | 'none';
  error?: string;
}> {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl || !isValidPostgresUrl(databaseUrl)) {
    return {
      connected: false,
      adapter: isProduction ? 'none' : 'memory',
      error: 'DATABASE_URL is not configured or invalid',
    };
  }

  try {
    getCreatorsRepository();
  } catch {
    return {
      connected: false,
      adapter: isProduction ? 'none' : 'memory',
      error: 'Failed to initialize database adapter',
    };
  }

  if (activeDatabaseAdapter && typeof activeDatabaseAdapter.testConnection === 'function') {
    try {
      await activeDatabaseAdapter.testConnection();
      return {
        connected: true,
        adapter: 'postgres',
      };
    } catch {
      return {
        connected: false,
        adapter: isProduction ? 'none' : 'memory',
        error: 'Database ping failed',
      };
    }
  }

  return {
    connected: false,
    adapter: isProduction ? 'none' : 'memory',
    error: 'No active persistent database adapter',
  };
}

/**
 * Test isolation helpers
 */
export function setActiveDatabaseAdapterForTesting(
  adapter: PostgresCreatorsRepository | MemoryCreatorsRepository | null
): void {
  activeDatabaseAdapter = adapter;
  if (adapter) {
    authRepoInstance = adapter as unknown as IAuthRepository;
    creatorsRepoInstance = adapter as unknown as ICreatorsRepository;
  } else {
    authRepoInstance = null;
    creatorsRepoInstance = null;
  }
}

export function resetRepositoriesForTesting(): void {
  authRepoInstance = null;
  creatorsRepoInstance = null;
  activeDatabaseAdapter = null;
}

export async function closeDatabaseConnections(): Promise<void> {
  try {
    const { closeDbPool } = await import('./dbPool.ts');
    await closeDbPool();
  } catch {
    // ignore
  }

  if (activeDatabaseAdapter && typeof activeDatabaseAdapter.close === 'function') {
    await activeDatabaseAdapter.close();
    console.log('[Storage Architecture] Database connections closed cleanly.');
  }
}

export type { IAuthRepository, ICreatorsRepository };
