import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';

export function createDrizzleClient(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 });
  return drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' });
}

export function resolveMigrationsFolder() {
  const candidates = [
    join(__dirname, 'migrations'),
    join(__dirname, '../src/migrations'),
  ];

  const folder = candidates.find((candidate) => existsSync(candidate));

  if (!folder) {
    throw new Error(`Drizzle migrations folder not found. Tried: ${candidates.join(', ')}`);
  }

  return folder;
}

const MIGRATIONS_TABLE = '__moments_migrations';

async function applySqlMigrations(pool: Pool, migrationsFolder: string) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      "filename" varchar(255) PRIMARY KEY,
      "applied_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  const appliedResult = await pool.query<{ filename: string }>(
    `SELECT "filename" FROM "${MIGRATIONS_TABLE}"`,
  );
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  const files = readdirSync(migrationsFolder)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationsFolder, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    await pool.query('BEGIN');

    try {
      for (const statement of statements) {
        await pool.query(statement);
      }

      await pool.query(`INSERT INTO "${MIGRATIONS_TABLE}" ("filename") VALUES ($1)`, [file]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }
}

export async function createMigratedDrizzleClient(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 });
  await applySqlMigrations(pool, resolveMigrationsFolder());
  const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' });
  return db;
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
