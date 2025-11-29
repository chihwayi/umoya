#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createHash } from 'crypto';
import { StorageService } from '../services/ehr-service/src/services/storage.service';

type TenantRow = {
  id: string;
  clinic_name: string;
  subdomain: string;
  database_name: string;
  status: string;
};

type ImagingFileRow = {
  id: string;
  imaging_study_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  content_type: string | null;
};

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'array',
    describe: 'Limit backfill to specific tenant slugs (subdomains)',
  })
  .option('batchSize', {
    type: 'number',
    default: 20,
    describe: 'Number of files to migrate per batch per tenant',
  })
  .option('limit', {
    type: 'number',
    describe: 'Maximum number of files to migrate per tenant (optional)',
  })
  .option('dryRun', {
    type: 'boolean',
    default: false,
    describe: 'Scan and log records without uploading to object storage',
  })
  .option('continueOnError', {
    type: 'boolean',
    default: true,
    describe: 'Continue with other tenants if one fails',
  })
  .help()
  .alias('help', 'h').argv as {
  tenant?: string[];
  batchSize: number;
  limit?: number;
  dryRun: boolean;
  continueOnError: boolean;
};

async function main() {
  const storageService = new StorageService();
  if (!storageService.isEnabled()) {
    throw new Error('Object storage driver is disabled. Set STORAGE_DRIVER=minio|s3 and credentials before running.');
  }

  const adminDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL;

  if (!adminDbUrl) {
    throw new Error('Set TENANT_SERVICE_DATABASE_URL or DATABASE_URL to the master tenant registry database.');
  }

  const adminClient = new Client({ connectionString: adminDbUrl });
  await adminClient.connect();

  try {
    const tenants = await fetchTenants(adminClient, argv.tenant);
    if (tenants.length === 0) {
      console.log('No tenants matched the criteria. Nothing to migrate.');
      return;
    }

    console.log(
      `Starting imaging blob backfill for ${tenants.length} tenant(s) (batchSize=${argv.batchSize}, limit=${argv.limit ?? '∞'}, dryRun=${argv.dryRun}).`,
    );

    let grandTotal = 0;
    const failures: Array<{ tenant: string; error: string }> = [];

    for (const tenant of tenants) {
      console.log(`\n→ Tenant ${tenant.clinic_name} (${tenant.subdomain})`);
      try {
        const migrated = await backfillTenant(tenant, storageService);
        grandTotal += migrated;
        console.log(`✓ Migrated ${migrated} file(s) for ${tenant.subdomain}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ tenant: tenant.subdomain, error: message });
        console.error(`✗ Failed to migrate ${tenant.subdomain}: ${message}`);
        if (!argv.continueOnError) {
          break;
        }
      }
    }

    console.log('\nBackfill summary:');
    console.log(`  Files migrated: ${grandTotal}`);
    console.log(`  Tenants failed: ${failures.length}`);
    if (failures.length > 0) {
      failures.forEach((failure) => console.log(`    - ${failure.tenant}: ${failure.error}`));
    }

    if (failures.length > 0 && !argv.continueOnError) {
      process.exitCode = 1;
    }
  } finally {
    await adminClient.end();
  }
}

async function fetchTenants(adminClient: Client, tenantFilter?: string[]) {
  const targetingSpecific = tenantFilter && tenantFilter.length > 0;
  const query = targetingSpecific
    ? `
        SELECT id, clinic_name, subdomain, database_name, status
        FROM tenants
        WHERE status = 'active'
          AND subdomain = ANY($1)
        ORDER BY clinic_name
      `
    : `
        SELECT id, clinic_name, subdomain, database_name, status
        FROM tenants
        WHERE status = 'active'
        ORDER BY clinic_name
      `;

  const result = await adminClient.query<TenantRow>(query, targetingSpecific ? [tenantFilter] : []);
  return result.rows;
}

async function backfillTenant(tenant: TenantRow, storageService: StorageService) {
  let processed = 0;
  const connectionString = buildTenantConnectionString(tenant.database_name);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    while (true) {
      if (argv.limit && processed >= argv.limit) {
        break;
      }

      const fetchSize = argv.limit ? Math.min(argv.batchSize, argv.limit - processed) : argv.batchSize;
      const { rows } = await client.query<ImagingFileRow>(
        `
          SELECT id, imaging_study_id, file_name, file_type, file_path, content_type
          FROM imaging_files
          WHERE storage_mode = 'db'
            AND file_path IS NOT NULL
            AND (object_key IS NULL OR object_key = '')
          ORDER BY uploaded_at
          LIMIT $1
        `,
        [fetchSize],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        if (argv.limit && processed >= argv.limit) {
          break;
        }

        const decoded = decodeBase64Payload(row.file_path);
        if (!decoded.buffer || decoded.buffer.length === 0) {
          console.warn(`  • Skipping ${row.id}: empty payload`);
          continue;
        }

        const contentType = decoded.contentType || resolveContentType(row.file_type, row.content_type);
        const checksum = createHash('sha256').update(decoded.buffer).digest('hex');

        if (argv.dryRun) {
          console.log(
            `  • [dry-run] Would upload ${row.file_name} (${decoded.buffer.length} bytes) for study ${row.imaging_study_id}`,
          );
          processed += 1;
          continue;
        }

        const objectKey = await storageService.uploadStudyAsset({
          tenantId: tenant.subdomain,
          studyId: row.imaging_study_id,
          filename: row.file_name,
          buffer: decoded.buffer,
          contentType,
        });

        if (!objectKey) {
          throw new Error(`Object storage upload returned empty key for file ${row.id}`);
        }

        await client.query(
          `
            UPDATE imaging_files
            SET object_key = $1,
                content_type = COALESCE(content_type, $2),
                storage_mode = 'object',
                file_checksum = $3,
                file_size = COALESCE($4, file_size),
                updated_at = NOW()
            WHERE id = $5
          `,
          [objectKey, contentType, checksum, decoded.buffer.length, row.id],
        );

        processed += 1;
        console.log(`  • Migrated ${row.file_name} (${decoded.buffer.length} bytes) → ${objectKey}`);
      }
    }
  } finally {
    await client.end();
  }

  return processed;
}

function buildTenantConnectionString(databaseName: string): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';
  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
}

function decodeBase64Payload(dataUri: string): { buffer: Buffer; contentType?: string } {
  if (!dataUri) {
    return { buffer: Buffer.alloc(0) };
  }

  const matches = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (matches && matches.length === 3) {
    return {
      buffer: Buffer.from(matches[2], 'base64'),
      contentType: matches[1],
    };
  }

  return {
    buffer: Buffer.from(dataUri, 'base64'),
  };
}

function resolveContentType(fileType?: string, fallback?: string | null) {
  if (fallback) {
    return fallback;
  }

  switch ((fileType || '').toUpperCase()) {
    case 'DICOM':
      return 'application/dicom';
    case 'JPEG':
      return 'image/jpeg';
    case 'PNG':
      return 'image/png';
    case 'PDF':
      return 'application/pdf';
    case 'TIFF':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});





