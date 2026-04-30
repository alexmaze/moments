import { defineConfig } from 'drizzle-kit';
import { loadConfig } from '@moments/config';

const cfg = loadConfig();

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: cfg.database.url,
  },
});
