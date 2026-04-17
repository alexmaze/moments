import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDrizzleClient(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 });
  return drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
