import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { appConfig } from "../config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: appConfig.databaseUrl,
      ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}
