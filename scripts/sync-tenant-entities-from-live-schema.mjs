import fs from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

import { extractEntityTables } from './audit-tenant-provisioning.mjs';

const ROOT = process.cwd();
const TENANT_SERVICE_PATH = path.join(
  ROOT,
  'services/ehr-service/src/services/tenant.service.ts',
);

function stripQuotes(identifier) {
  return identifier.replace(/^"+|"+$/g, '');
}

function normalizeTableName(input) {
  const raw = stripQuotes(input.trim().replace(/;$/, ''));
  const withoutSchema = raw.includes('.') ? raw.split('.').pop() : raw;
  return withoutSchema.toLowerCase();
}

function toCamelCase(input) {
  return input.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function mapColumnType(column) {
  if (column.isArray) {
    switch (column.baseType) {
      case 'uuid':
      case 'varchar':
      case 'text':
      case 'bpchar':
        return { tsType: 'string[]', decoratorType: 'text', array: true };
      case 'int2':
      case 'int4':
      case 'int8':
      case 'numeric':
      case 'float4':
      case 'float8':
        return { tsType: 'number[]', decoratorType: 'int', array: true };
      case 'bool':
        return { tsType: 'boolean[]', decoratorType: 'boolean', array: true };
      case 'json':
      case 'jsonb':
        return { tsType: 'any[]', decoratorType: 'jsonb', array: false };
      default:
        return { tsType: 'string[]', decoratorType: 'text', array: true };
    }
  }

  switch (column.baseType) {
    case 'uuid':
      return { tsType: 'string', decoratorType: 'uuid' };
    case 'varchar':
    case 'bpchar':
      return { tsType: 'string', decoratorType: 'varchar' };
    case 'text':
      return { tsType: 'string', decoratorType: 'text' };
    case 'bool':
      return { tsType: 'boolean', decoratorType: 'boolean' };
    case 'int2':
    case 'int4':
      return { tsType: 'number', decoratorType: 'int' };
    case 'int8':
      return { tsType: 'number', decoratorType: 'bigint' };
    case 'numeric':
      return { tsType: 'number', decoratorType: 'numeric' };
    case 'float4':
      return { tsType: 'number', decoratorType: 'real' };
    case 'float8':
      return { tsType: 'number', decoratorType: 'double precision' };
    case 'date':
      return { tsType: 'Date', decoratorType: 'date' };
    case 'timestamp':
      return { tsType: 'Date', decoratorType: 'timestamp' };
    case 'timestamptz':
      return { tsType: 'Date', decoratorType: 'timestamptz' };
    case 'json':
    case 'jsonb':
      return { tsType: 'any', decoratorType: 'jsonb' };
    default:
      return { tsType: 'string', decoratorType: 'text' };
  }
}

function parseDefaultExpression(column) {
  const raw = column.defaultValue;
  if (!raw) return null;

  if (/^false(?:::.*)?$/i.test(raw)) {
    return { decorator: 'false', initializer: 'false' };
  }
  if (/^true(?:::.*)?$/i.test(raw)) {
    return { decorator: 'true', initializer: 'true' };
  }
  if (/^-?\d+(?:\.\d+)?(?:::.*)?$/.test(raw)) {
    const value = raw.replace(/::.*$/, '');
    return { decorator: value, initializer: value };
  }
  if (/^now\(\)$/i.test(raw) || /^CURRENT_TIMESTAMP$/i.test(raw)) {
    return { decorator: "() => 'NOW()'" };
  }
  if (/^'{}'::jsonb$/i.test(raw)) {
    return { decorator: '{}', initializer: '{}' };
  }
  if (/^'\[\]'::jsonb$/i.test(raw)) {
    return { decorator: '[]', initializer: '[]' };
  }
  if (/^'\{\}'::.*\[\]$/i.test(raw)) {
    return { decorator: "'{}'", initializer: '[]' };
  }
  if (/^'.*'$/.test(raw) && !raw.includes('::')) {
    return { decorator: raw };
  }

  return null;
}

function buildDecorator(column, propertyName) {
  const typeInfo = mapColumnType(column);
  const options = [];

  if (propertyName !== column.columnName) {
    options.push(`name: '${column.columnName}'`);
  }

  if (typeInfo.decoratorType && !['text'].includes(typeInfo.decoratorType)) {
    options.push(`type: '${typeInfo.decoratorType}'`);
  } else if (column.baseType === 'text' && column.isArray) {
    options.push(`type: 'text'`);
  } else if (column.baseType === 'text' && column.dataType === 'text' && propertyName !== column.columnName) {
    options.push(`type: 'text'`);
  }

  if (column.characterMaximumLength && typeInfo.decoratorType === 'varchar') {
    options.push(`length: ${column.characterMaximumLength}`);
  }

  if (column.numericPrecision && typeInfo.decoratorType === 'numeric') {
    options.push(`precision: ${column.numericPrecision}`);
  }

  if (column.numericScale !== null && column.numericScale !== undefined && typeInfo.decoratorType === 'numeric') {
    options.push(`scale: ${column.numericScale}`);
  }

  if (typeInfo.array) {
    options.push('array: true');
  }

  if (column.nullable) {
    options.push('nullable: true');
  }

  const defaultExpression = parseDefaultExpression(column);
  if (defaultExpression?.decorator) {
    options.push(`default: ${defaultExpression.decorator}`);
  }

  return {
    decorator: `@Column({ ${options.join(', ')} })`,
    tsType: typeInfo.tsType,
    initializer: defaultExpression?.initializer ?? null,
  };
}

function choosePropertyName(columnName, existingPropertyNames) {
  const base = toCamelCase(columnName);
  const candidates = [
    base,
    `${base}Id`,
    `${base}Value`,
    `${base}Field`,
  ];

  for (const candidate of candidates) {
    if (!existingPropertyNames.has(candidate)) {
      existingPropertyNames.add(candidate);
      return candidate;
    }
  }

  let index = 2;
  while (existingPropertyNames.has(`${base}Field${index}`)) {
    index += 1;
  }
  const resolved = `${base}Field${index}`;
  existingPropertyNames.add(resolved);
  return resolved;
}

function findEntityClassBlock(source, entityName) {
  const classMarker = `export class ${entityName}`;
  const classIndex = source.indexOf(classMarker);
  if (classIndex === -1) {
    throw new Error(`Could not locate class declaration for ${entityName}`);
  }

  const entityDecoratorIndex = source.lastIndexOf('@Entity', classIndex);
  if (entityDecoratorIndex === -1) {
    throw new Error(`Could not locate @Entity decorator for ${entityName}`);
  }

  const classBodyStart = source.indexOf('{', classIndex);
  if (classBodyStart === -1) {
    throw new Error(`Could not locate class body for ${entityName}`);
  }

  let depth = 0;
  let classBodyEnd = -1;
  for (let i = classBodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        classBodyEnd = i;
        break;
      }
    }
  }

  if (classBodyEnd === -1) {
    throw new Error(`Could not determine class end for ${entityName}`);
  }

  return {
    decoratorBlock: source.slice(entityDecoratorIndex, classIndex),
    classBodyStart,
    classBodyEnd,
    classBlock: source.slice(classIndex, classBodyEnd + 1),
  };
}

function extractEntityTableName(decoratorBlock, entityName) {
  const decoratorWithName =
    decoratorBlock.match(/@Entity\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/) ||
    decoratorBlock.match(/@Entity\s*\(\s*\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/);
  if (decoratorWithName) {
    return normalizeTableName(decoratorWithName[1]);
  }

  if (decoratorBlock.includes('@Entity')) {
    return normalizeTableName(entityName);
  }

  throw new Error(`Could not resolve @Entity table name for ${entityName}`);
}

async function getTenantEntityRegistry() {
  const source = await fs.readFile(TENANT_SERVICE_PATH, 'utf8');
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+'(\.\.\/entities\/[^']+)';/g;
  const importMap = new Map();

  for (const match of source.matchAll(importRegex)) {
    const importedNames = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const absolutePath = path.resolve(path.dirname(TENANT_SERVICE_PATH), `${match[2]}.ts`);
    for (const importedName of importedNames) {
      importMap.set(importedName, absolutePath);
    }
  }

  const entitiesBlockMatch = source.match(/entities:\s*\[([\s\S]*?)\]\s*,\s*logging:/);
  if (!entitiesBlockMatch) {
    throw new Error('Could not locate tenant entity registry in tenant.service.ts');
  }

  const entityNames = entitiesBlockMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z_]\w*$/.test(entry));

  return {
    entityNames: [...new Set(entityNames)],
    importMap,
  };
}

async function buildTableFileMap() {
  const { entityNames, importMap } = await getTenantEntityRegistry();
  const map = new Map();

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) {
      throw new Error(`Missing import path for entity ${entityName}`);
    }

    const source = await fs.readFile(filePath, 'utf8');
    const { decoratorBlock } = findEntityClassBlock(source, entityName);
    const tableName = extractEntityTableName(decoratorBlock, entityName);

    if (!map.has(tableName)) {
      map.set(tableName, { filePath, entityName });
    }
  }

  return map;
}

function getBaseConfig() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medicore');
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

async function loadTargetDatabases(master) {
  const { rows } = await master.query(
    `SELECT "databaseName"
     FROM tenants
     WHERE status = ANY($1)
     ORDER BY "databaseName"`,
    [['active', 'pending', 'suspended']],
  );
  return rows.map((row) => row.databaseName);
}

async function loadLiveColumns(config) {
  const client = new Client(config);
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT
         table_name,
         column_name,
         data_type,
         udt_name,
         is_nullable,
         column_default,
         character_maximum_length,
         numeric_precision,
         numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );

    const tables = new Map();
    for (const row of rows) {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, new Map());
      }

      tables.get(row.table_name).set(row.column_name, {
        tableName: row.table_name,
        columnName: row.column_name,
        dataType: row.data_type,
        baseType: row.udt_name?.replace(/^_/, '') ?? row.data_type,
        isArray: row.data_type === 'ARRAY',
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        characterMaximumLength: row.character_maximum_length
          ? Number(row.character_maximum_length)
          : null,
        numericPrecision: row.numeric_precision ? Number(row.numeric_precision) : null,
        numericScale:
          row.numeric_scale === null || row.numeric_scale === undefined
            ? null
            : Number(row.numeric_scale),
      });
    }

    return tables;
  } finally {
    await client.end();
  }
}

function findInsertOffset(source, classBodyStart, classBodyEnd) {
  const classBody = source.slice(classBodyStart, classBodyEnd);
  const markers = [
    '\n  @CreateDateColumn',
    '\n  @UpdateDateColumn',
    '\n  @DeleteDateColumn',
    '\n  @VersionColumn',
    '\n  get ',
  ];

  let best = classBodyEnd;
  for (const marker of markers) {
    const relativeIndex = classBody.indexOf(marker);
    if (relativeIndex !== -1) {
      best = Math.min(best, classBodyStart + relativeIndex);
    }
  }
  return best;
}

function collectExistingPropertyNames(classBlock) {
  return new Set(
    [...classBlock.matchAll(/\n\s{2}([A-Za-z_]\w*)\??\s*:/g)].map((match) => match[1]),
  );
}

async function main() {
  const entityTables = await extractEntityTables();
  const tableFileMap = await buildTableFileMap();
  const baseConfig = getBaseConfig();
  const master = new Client(baseConfig);
  await master.connect();

  try {
    const databases = await loadTargetDatabases(master);
    const unionLiveColumns = new Map();

    for (const databaseName of databases) {
      const liveColumns = await loadLiveColumns({ ...baseConfig, database: databaseName });
      for (const [tableName, columns] of liveColumns.entries()) {
        if (!unionLiveColumns.has(tableName)) {
          unionLiveColumns.set(tableName, new Map());
        }
        const target = unionLiveColumns.get(tableName);
        for (const [columnName, metadata] of columns.entries()) {
          if (!target.has(columnName)) {
            target.set(columnName, metadata);
          }
        }
      }
    }

    const updates = [];

    for (const [tableName, entityTable] of entityTables.entries()) {
      const liveColumns = unionLiveColumns.get(tableName);
      if (!liveColumns) continue;

      const existingColumnNames = new Set(
        entityTable.columnDefinitions.map((column) => column.rawColumnName),
      );
      const missingColumns = [...liveColumns.values()].filter(
        (column) => !existingColumnNames.has(column.columnName),
      );
      if (missingColumns.length === 0) continue;

      const tableFile = tableFileMap.get(tableName);
      if (!tableFile) continue;

      const source = await fs.readFile(tableFile.filePath, 'utf8');
      const { classBodyStart, classBodyEnd, classBlock } = findEntityClassBlock(
        source,
        tableFile.entityName,
      );
      const insertOffset = findInsertOffset(source, classBodyStart, classBodyEnd);
      const existingPropertyNames = collectExistingPropertyNames(classBlock);

      const generatedBlock = missingColumns
        .sort((a, b) => a.columnName.localeCompare(b.columnName))
        .map((column) => {
          const propertyName = choosePropertyName(column.columnName, existingPropertyNames);
          const { decorator, tsType, initializer } = buildDecorator(column, propertyName);
          const optional = column.nullable && !initializer ? '?' : '';
          const assignment = initializer ? ` = ${initializer}` : '';
          return `  ${decorator}\n  ${propertyName}${optional}: ${tsType}${assignment};`;
        })
        .join('\n\n');

      const nextSource =
        source.slice(0, insertOffset) +
        `${generatedBlock}\n\n` +
        source.slice(insertOffset);

      await fs.writeFile(tableFile.filePath, nextSource, 'utf8');
      updates.push({
        tableName,
        entityName: tableFile.entityName,
        filePath: tableFile.filePath,
        columnCount: missingColumns.length,
      });
    }

    console.log(JSON.stringify({ updatedTableCount: updates.length, updates }, null, 2));
  } finally {
    await master.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
