import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

// ─── Config type definitions ──────────────────────────────────────────────────

export type NodeEnv = 'development' | 'production' | 'test';

const VALID_NODE_ENVS: readonly string[] = ['development', 'production', 'test'];

export interface AppConfig {
  port: number;
  nodeEnv: NodeEnv;
}

export interface DatabaseConfig {
  url: string;
}

export interface AuthConfig {
  jwtSecret: string;
  adminUsernames: string[];
}

export interface CiConfig {
  enabled: boolean;
  feedImage: string;
  feedCover: string;
  smallThumb: string;
  avatar: string;
  spaceCover: string;
}

export interface TencentCosConfig {
  secretId: string;
  secretKey: string;
  region: string;
  bucket: string;
  useHttps: boolean;
  timeoutMs: number;
}

export interface StorageConfig {
  driver: 'tencent-cos';
  signedUrlTtlSeconds: number;
  keyPrefix: string;
  ci: CiConfig | null;
  tencentCos: TencentCosConfig;
}

export interface MediaCleanupConfig {
  enabled: boolean;
  dryRun: boolean;
  retentionDays: number;
  pendingMaxAgeHours: number;
  batchSize: number;
}

export interface MediaConfig {
  cleanup: MediaCleanupConfig;
}

export interface MomentsConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  storage: StorageConfig;
  media: MediaConfig;
}

// ─── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolves `config.yaml` at the monorepo root.
 * Works regardless of which package's cwd the process launches from.
 *
 * Search order (first existing path wins):
 *  1. process.cwd()/config.yaml                 (repo root)
 *  2. process.cwd()/../../config.yaml           (from apps/server or packages/db)
 *  3. __dirname/../../../config.yaml            (from compiled dist/)
 *  4. __dirname/../../../../config.yaml         (deeper dist nesting)
 */
export function resolveConfigPath(): string {
  const filename = 'config.yaml';

  const candidates = [
    path.resolve(process.cwd(), filename),
    path.resolve(process.cwd(), '..', '..', filename),
    path.resolve(__dirname, '..', '..', '..', filename),
    path.resolve(__dirname, '..', '..', '..', '..', filename),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `config.yaml not found. Searched:\n` +
        candidates.map((p) => `  - ${p}`).join('\n') +
        '\n\nCopy config.example.yaml to config.yaml and fill in your values.',
    );
  }
  return found;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function requireString(value: unknown, keyPath: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`config.yaml: "${keyPath}" must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInt(
  value: unknown,
  keyPath: string,
  fallback: number,
): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`config.yaml: "${keyPath}" must be a positive integer`);
  }
  return n;
}

function requireBoolean(
  value: unknown,
  keyPath: string,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`config.yaml: "${keyPath}" must be a boolean`);
  }
  return value;
}

// ─── Main loader ──────────────────────────────────────────────────────────────

/**
 * Load and validate config.yaml, returning a strongly-typed
 * MomentsConfig object.
 *
 * This is a pure function — callers may cache the result freely.
 * Call it once at startup.
 */
export function loadConfig(configPath?: string): MomentsConfig {
  const filePath = configPath ?? resolveConfigPath();
  const raw = fs.readFileSync(filePath, 'utf8');

  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${filePath}: ${(err as Error).message}`,
    );
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error('config.yaml is empty or not a YAML mapping');
  }

  const c = doc as Record<string, unknown>;

  // ── app ────────────────────────────────────────────────────────────────────
  const appRaw = (c.app ?? {}) as Record<string, unknown>;
  const rawNodeEnv =
    typeof appRaw.nodeEnv === 'string' ? appRaw.nodeEnv.trim() : 'development';
  if (!VALID_NODE_ENVS.includes(rawNodeEnv)) {
    throw new Error(
      `config.yaml: "app.nodeEnv" must be one of ${VALID_NODE_ENVS.join(', ')} (got "${rawNodeEnv}")`,
    );
  }
  const appConfig: AppConfig = {
    port: requirePositiveInt(appRaw.port, 'app.port', 3000),
    nodeEnv: rawNodeEnv as NodeEnv,
  };

  // ── database ───────────────────────────────────────────────────────────────
  const dbRaw = (c.database ?? {}) as Record<string, unknown>;
  const databaseConfig: DatabaseConfig = {
    url: requireString(dbRaw.url, 'database.url'),
  };

  // ── auth ───────────────────────────────────────────────────────────────────
  const authRaw = (c.auth ?? {}) as Record<string, unknown>;
  const rawAdminUsernames = authRaw.adminUsernames;
  let adminUsernames: string[];
  if (Array.isArray(rawAdminUsernames)) {
    for (let i = 0; i < rawAdminUsernames.length; i++) {
      if (typeof rawAdminUsernames[i] !== 'string') {
        throw new Error(
          `config.yaml: "auth.adminUsernames[${i}]" must be a string (got ${typeof rawAdminUsernames[i]})`,
        );
      }
    }
    adminUsernames = (rawAdminUsernames as string[])
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
  } else if (typeof rawAdminUsernames === 'string') {
    // Accept comma-separated string for convenience
    adminUsernames = rawAdminUsernames
      .split(',')
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
  } else {
    adminUsernames = [];
  }

  const jwtSecret = requireString(authRaw.jwtSecret, 'auth.jwtSecret');
  if (jwtSecret.length < 32) {
    throw new Error(
      `config.yaml: "auth.jwtSecret" must be at least 32 characters (got ${jwtSecret.length})`,
    );
  }

  const authConfig: AuthConfig = {
    jwtSecret,
    adminUsernames,
  };

  // ── storage ────────────────────────────────────────────────────────────────
  const storageRaw = (c.storage ?? {}) as Record<string, unknown>;
  if (storageRaw.driver !== 'tencent-cos') {
    throw new Error(
      'config.yaml: "storage.driver" must be "tencent-cos"',
    );
  }

  const cosRaw = (storageRaw.tencentCos ?? {}) as Record<string, unknown>;
  const ciRaw = (storageRaw.ci ?? {}) as Record<string, unknown>;

  const ciEnabled = ciRaw.enabled === true;
  const ciConfig: CiConfig | null = ciEnabled
    ? {
        enabled: true,
        feedImage: requireString(
          ciRaw.feedImage ??
            'imageMogr2/thumbnail/800x/format/webp/quality/80',
          'storage.ci.feedImage',
        ),
        feedCover: requireString(
          ciRaw.feedCover ??
            ciRaw.feedImage ??
            'imageMogr2/thumbnail/800x/format/webp/quality/80',
          'storage.ci.feedCover',
        ),
        smallThumb: requireString(
          ciRaw.smallThumb ??
            'imageMogr2/thumbnail/200x200/format/webp/quality/80',
          'storage.ci.smallThumb',
        ),
        avatar: requireString(
          ciRaw.avatar ??
            'imageMogr2/thumbnail/200x200/format/webp/quality/85',
          'storage.ci.avatar',
        ),
        spaceCover: requireString(
          ciRaw.spaceCover ??
            ciRaw.feedImage ??
            'imageMogr2/thumbnail/800x/format/webp/quality/80',
          'storage.ci.spaceCover',
        ),
      }
    : null;

  const storageConfig: StorageConfig = {
    driver: 'tencent-cos',
    signedUrlTtlSeconds: requirePositiveInt(
      storageRaw.signedUrlTtlSeconds,
      'storage.signedUrlTtlSeconds',
      604_800,
    ),
    keyPrefix: (
      typeof storageRaw.keyPrefix === 'string'
        ? storageRaw.keyPrefix
        : 'moments'
    )
      .trim()
      .replace(/^\/+|\/+$/g, ''),
    ci: ciConfig,
    tencentCos: {
      secretId: requireString(cosRaw.secretId, 'storage.tencentCos.secretId'),
      secretKey: requireString(
        cosRaw.secretKey,
        'storage.tencentCos.secretKey',
      ),
      region: requireString(cosRaw.region, 'storage.tencentCos.region'),
      bucket: requireString(cosRaw.bucket, 'storage.tencentCos.bucket'),
      useHttps: requireBoolean(
        cosRaw.useHttps,
        'storage.tencentCos.useHttps',
        true,
      ),
      timeoutMs: requirePositiveInt(
        cosRaw.timeoutMs,
        'storage.tencentCos.timeoutMs',
        30_000,
      ),
    },
  };

  // ── media ──────────────────────────────────────────────────────────────────
  const mediaRaw = (c.media ?? {}) as Record<string, unknown>;
  const cleanupRaw = (mediaRaw.cleanup ?? {}) as Record<string, unknown>;
  const mediaConfig: MediaConfig = {
    cleanup: {
      enabled: requireBoolean(
        cleanupRaw.enabled,
        'media.cleanup.enabled',
        true,
      ),
      dryRun: requireBoolean(
        cleanupRaw.dryRun,
        'media.cleanup.dryRun',
        false,
      ),
      retentionDays: requirePositiveInt(
        cleanupRaw.retentionDays,
        'media.cleanup.retentionDays',
        7,
      ),
      pendingMaxAgeHours: requirePositiveInt(
        cleanupRaw.pendingMaxAgeHours,
        'media.cleanup.pendingMaxAgeHours',
        24,
      ),
      batchSize: requirePositiveInt(
        cleanupRaw.batchSize,
        'media.cleanup.batchSize',
        100,
      ),
    },
  };

  return {
    app: appConfig,
    database: databaseConfig,
    auth: authConfig,
    storage: storageConfig,
    media: mediaConfig,
  };
}
