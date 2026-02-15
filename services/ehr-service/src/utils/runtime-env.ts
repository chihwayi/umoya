export interface DbEnvConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function parsePort(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMasterDbConfig(databaseOverride?: string): DbEnvConfig {
  return {
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'postgres-master',
    port: parsePort(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseOverride || process.env.MASTER_POSTGRES_DB || process.env.POSTGRES_DB || 'medicore',
  };
}

export function getJwtSecretOrThrow(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required.');
  }
  return secret;
}
