#!/usr/bin/env ts-node
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import childProcess from 'node:child_process';
import readline from 'node:readline';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const execFile = promisify(childProcess.execFile);

interface ImportArgs {
  zip?: string;
  connection?: string;
  releaseLabel?: string;
  truncate?: boolean;
  chunkSize: number;
}

interface MappingRow {
  conceptId: string;
  targetCode: string;
  targetDisplay?: string;
  mapGroup: number;
  mapPriority: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  mapCategoryId?: string;
  moduleId?: string;
  effectiveTime?: string;
  active: boolean;
  mapSource: string;
}

const argv = yargs(hideBin(process.argv))
  .option('zip', {
    type: 'string',
    describe: 'Path to SNOMED→ICD-10 RF2 ZIP (defaults to snowstorm/imports/...zip)',
  })
  .option('connection', {
    type: 'string',
    describe: 'Tenant database connection string. Falls back to TENANT_DATABASE_URL/DB_URL env vars.',
  })
  .option('releaseLabel', {
    type: 'string',
    describe: 'Label to store in icd10_mapping_metadata (defaults to ZIP filename).',
  })
  .option('truncate', {
    type: 'boolean',
    default: true,
    describe: 'Remove existing rows before import.',
  })
  .option('chunkSize', {
    type: 'number',
    default: 1000,
    describe: 'Rows per insert batch.',
  })
  .help()
  .alias('help', 'h').argv as unknown as ImportArgs;

async function main() {
  const zipPath =
    argv.zip ||
    path.resolve(
      process.cwd(),
      'snowstorm',
      'imports',
      'SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip',
    );

  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP not found at ${zipPath}. Provide --zip <path>.`);
  }

  const connectionString =
    argv.connection ||
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DB_URL;

  if (!connectionString) {
    throw new Error(
      'Provide a tenant DB URL via --connection or TENANT_DATABASE_URL/DATABASE_URL/DB_URL env vars',
    );
  }

  const releaseLabel = argv.releaseLabel || path.basename(zipPath, '.zip');
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icd10-map-'));
  const startTime = new Date();

  try {
    await unzip(zipPath, tempDir);
    const mapFiles = await findMapFiles(tempDir);
    if (!mapFiles.length) {
      throw new Error('No ExtendedMap or SimpleMap RF2 files found in archive.');
    }

    const client = new Client({ connectionString });
    await client.connect();
    let totalRows = 0;

    try {
      await client.query('BEGIN');
      if (argv.truncate) {
        await client.query('TRUNCATE TABLE snomed_icd10_mappings RESTART IDENTITY');
      }

      for (const filePath of mapFiles) {
        const rows = await streamRf2File(filePath);
        totalRows += await insertRows(client, rows, argv.chunkSize);
      }

      await upsertMetadata(client, {
        releaseLabel,
        effectiveTime: deriveLatestEffective(mapFiles),
        sourceZip: zipPath,
        totalRows,
        startedAt: startTime,
        completedAt: new Date(),
      });

      await client.query('COMMIT');
      console.log(
        `✅ Imported ${totalRows} ICD-10 mappings from ${mapFiles.length} file(s) into ${sanitizeConnection(
          connectionString,
        )}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function unzip(zipPath: string, destination: string) {
  try {
    await execFile('unzip', ['-oq', zipPath, '-d', destination]);
  } catch (error) {
    throw new Error(
      `Failed to unzip ${zipPath}. Ensure 'unzip' CLI is available. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function findMapFiles(baseDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        (/MapSnapshot.*\.txt$/i.test(entry.name) && /Map/.test(entry.name)) ||
        (/Icd10cm.*\.tsv$/i.test(entry.name) && /Map/.test(entry.name))
      ) {
        files.push(fullPath);
      }
    }
  }

  await walk(baseDir);
  return files;
}

async function streamRf2File(filePath: string): Promise<MappingRow[]> {
  const rows: MappingRow[] = [];
  const mapSource = path.basename(filePath);
  const isExtended = /ExtendedMap/i.test(mapSource);
  const isTsv = /\.tsv$/i.test(filePath);

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let headerMap: Record<string, number> | null = null;

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) {
      continue;
    }
    const columns = line.split('\t');

    // Handle TSV format with header row
    if (isTsv && lineNumber === 1) {
      headerMap = {};
      columns.forEach((col, idx) => {
        headerMap![col.trim()] = idx;
      });
      continue;
    }

    if (isTsv && headerMap) {
      // TSV format: id, effectiveTime, active, moduleId, refsetId, referencedComponentId, referencedComponentName, mapGroup, mapPriority, mapRule, mapAdvice, mapTarget, mapTargetName, correlationId, mapCategoryId, mapCategoryName
      const conceptId = columns[headerMap['referencedComponentId']] || columns[headerMap['referencedComponentId']];
      const targetCode = columns[headerMap['mapTarget']] || columns[headerMap['mapTarget']];
      const targetDisplay = columns[headerMap['mapTargetName']] || '';
      const mapGroup = columns[headerMap['mapGroup']] || '1';
      const mapPriority = columns[headerMap['mapPriority']] || '1';
      const mapRule = columns[headerMap['mapRule']] || '';
      const mapAdvice = columns[headerMap['mapAdvice']] || '';
      const mapCategoryId = columns[headerMap['mapCategoryId']] || '';
      const moduleId = columns[headerMap['moduleId']] || '';
      const effectiveTime = columns[headerMap['effectiveTime']] || '';
      const active = columns[headerMap['active']] === '1';
      const mapStatus = columns[headerMap['mapCategoryName']] || '';

      if (!conceptId || !targetCode) {
        continue;
      }

      rows.push({
        conceptId: conceptId.trim(),
        targetCode: targetCode.trim(),
        targetDisplay: targetDisplay.trim() || undefined,
        mapGroup: Number(mapGroup) || 1,
        mapPriority: Number(mapPriority) || 1,
        mapRule: mapRule.trim() || undefined,
        mapAdvice: mapAdvice.trim() || undefined,
        mapStatus: mapStatus.trim() || undefined,
        mapCategoryId: mapCategoryId.trim() || undefined,
        moduleId: moduleId.trim() || undefined,
        active,
        effectiveTime: normalizeDate(effectiveTime),
        mapSource,
      });
      continue;
    }

    if (isExtended && columns.length < 13) {
      console.warn(`Skipping malformed extended row ${lineNumber} in ${mapSource}`);
      continue;
    }
    if (!isExtended && columns.length < 7) {
      console.warn(`Skipping malformed simple row ${lineNumber} in ${mapSource}`);
      continue;
    }

    if (!isExtended) {
      const [id, effectiveTime, active, moduleId, , conceptId, mapTarget] = columns;
      rows.push({
        conceptId,
        targetCode: mapTarget,
        mapGroup: 1,
        mapPriority: 1,
        active: active === '1',
        mapSource,
        moduleId,
        effectiveTime: normalizeDate(effectiveTime),
        mapStatus: 'simple',
      });
      continue;
    }

    const [
      ,
      effectiveTime,
      active,
      moduleId,
      refsetId,
      conceptId,
      mapGroup,
      mapPriority,
      mapRule,
      mapAdvice,
      mapTarget,
      correlationId,
      mapCategoryId,
    ] = columns;

    rows.push({
      conceptId,
      targetCode: mapTarget,
      mapGroup: Number(mapGroup) || 1,
      mapPriority: Number(mapPriority) || 1,
      mapRule,
      mapAdvice,
      mapStatus: correlationId || refsetId,
      mapCategoryId,
      moduleId,
      active: active === '1',
      effectiveTime: normalizeDate(effectiveTime),
      mapSource,
    });
  }

  return rows;
}

async function insertRows(client: Client, rows: MappingRow[], chunkSize: number): Promise<number> {
  if (!rows.length) return 0;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: string[] = [];
    const params: any[] = [];

    chunk.forEach((row, idx) => {
      const base = idx * 13;
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`,
      );
      params.push(
        row.conceptId,
        row.targetCode,
        row.targetDisplay ?? null,
        row.mapGroup,
        row.mapPriority,
        row.mapRule ?? null,
        row.mapAdvice ?? null,
        row.mapStatus ?? null,
        row.mapCategoryId ?? null,
        row.moduleId ?? null,
        row.effectiveTime ?? null,
        row.active,
        row.mapSource,
      );
    });

    const sql = `
      INSERT INTO snomed_icd10_mappings (
        concept_id,
        target_code,
        target_display,
        map_group,
        map_priority,
        map_rule,
        map_advice,
        map_status,
        map_category_id,
        module_id,
        effective_time,
        active,
        map_source
      ) VALUES ${values.join(', ')}
      ON CONFLICT (concept_id, target_code, map_group, map_priority)
      DO UPDATE SET
        target_display = EXCLUDED.target_display,
        map_rule = EXCLUDED.map_rule,
        map_advice = EXCLUDED.map_advice,
        map_status = EXCLUDED.map_status,
        map_category_id = EXCLUDED.map_category_id,
        module_id = EXCLUDED.module_id,
        effective_time = EXCLUDED.effective_time,
        active = EXCLUDED.active,
        map_source = EXCLUDED.map_source,
        updated_at = NOW()
    `;

    await client.query(sql, params);
    inserted += chunk.length;
  }

  return inserted;
}

async function upsertMetadata(
  client: Client,
  params: {
    releaseLabel: string;
    effectiveTime?: string;
    sourceZip: string;
    totalRows: number;
    startedAt: Date;
    completedAt: Date;
  },
) {
  await client.query(
    `
      INSERT INTO icd10_mapping_metadata (
        release_label,
        effective_time,
        source_zip,
        total_rows,
        import_started_at,
        import_completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (release_label) DO UPDATE SET
        effective_time = EXCLUDED.effective_time,
        source_zip = EXCLUDED.source_zip,
        total_rows = EXCLUDED.total_rows,
        import_started_at = EXCLUDED.import_started_at,
        import_completed_at = EXCLUDED.import_completed_at
    `,
    [
      params.releaseLabel,
      params.effectiveTime ?? null,
      params.sourceZip,
      params.totalRows,
      params.startedAt.toISOString(),
      params.completedAt.toISOString(),
    ],
  );
}

function deriveLatestEffective(files: string[]): string | undefined {
  const matches = files
    .map((file) => file.match(/(\d{8})/g))
    .flat()
    .filter(Boolean) as string[];

  if (!matches.length) {
    return undefined;
  }

  const latest = matches.sort().pop();
  return latest ? normalizeDate(latest) : undefined;
}

function normalizeDate(value?: string): string | undefined {
  if (!value || value.length !== 8) return undefined;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function sanitizeConnection(connection: string): string {
  return connection.replace(/:\/\/.*@/, '://***@');
}

main().catch((error) => {
  console.error('ICD-10 mapping import failed:', error);
  process.exit(1);
});


