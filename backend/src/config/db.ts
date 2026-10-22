import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
    });
  }
  return pool;
};

export const query = async <R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> => {
  const p = getPool();
  return p.query<R>(text, params);
};

/** Run `fn` inside a single transaction; rolls back on any error. */
export const withTransaction = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const connectDatabase = async (): Promise<pg.Pool> => {
  try {
    const p = getPool();
    const res = await p.query('SELECT current_database() as db, current_user as user');
    logger.info(`PostgreSQL (Neon) connected to ${res.rows[0]?.db} as ${res.rows[0]?.user}`);
    return p;
  } catch (err) {
    logger.error({ err }, 'Failed to connect to Neon PostgreSQL database');
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw err;
  }
};

export const isDatabaseHealthy = async (): Promise<boolean> => {
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL (Neon) disconnected');
  }
};
