import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TENANT_SERVICE_PATH = path.join(
  ROOT,
  'services/ehr-service/src/services/tenant.service.ts',
);
const PROVISIONING_SERVICE_PATH = path.join(
  ROOT,
  'services/tenant-service/src/services/database-provisioning.service.ts',
);

function stripQuotes(identifier) {
  return identifier.replace(/^"+|"+$/g, '');
}

function normalizeTableName(input) {
  const raw = stripQuotes(input.trim().replace(/;$/, ''));
  const withoutSchema = raw.includes('.') ? raw.split('.').pop() : raw;
  return withoutSchema.toLowerCase();
}

function normalizeColumnName(input) {
  return stripQuotes(input.trim().replace(/[,;]$/, '')).toLowerCase();
}

function unquoteLiteral(input) {
  return input.replace(/^['"`]|['"`]$/g, '');
}

function isQuotedIdentifier(input) {
  return input.trim().startsWith('"') && input.trim().endsWith('"');
}

function stripSqlComments(statement) {
  return statement
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*--.*$/gm, '')
    .trim();
}

function splitTopLevelSegments(input) {
  const segments = [];
  let current = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let angleDepth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const prev = input[i - 1];

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble) {
      if (char === '(') parenDepth += 1;
      if (char === ')') parenDepth = Math.max(parenDepth - 1, 0);
      if (char === '{') braceDepth += 1;
      if (char === '}') braceDepth = Math.max(braceDepth - 1, 0);
      if (char === '[') bracketDepth += 1;
      if (char === ']') bracketDepth = Math.max(bracketDepth - 1, 0);
      if (char === '<') angleDepth += 1;
      if (char === '>') angleDepth = Math.max(angleDepth - 1, 0);
      if (
        char === ',' &&
        parenDepth === 0 &&
        braceDepth === 0 &&
        bracketDepth === 0 &&
        angleDepth === 0
      ) {
        if (current.trim()) segments.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) segments.push(current.trim());
  return segments;
}

function findTopLevelDelimiter(input, delimiter) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const prev = input[i - 1];

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) continue;

    if (char === '(' || char === '{' || char === '[' || char === '<') depth += 1;
    if (char === ')' || char === '}' || char === ']' || char === '>') {
      depth = Math.max(depth - 1, 0);
    }

    if (char === delimiter && depth === 0) {
      return i;
    }
  }

  return -1;
}

function readBalancedParentheses(input, openIndex) {
  if (input[openIndex] !== '(') {
    return null;
  }

  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = openIndex; i < input.length; i += 1) {
    const char = input[i];
    const prev = input[i - 1];

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble) {
      if (char === '(') depth += 1;
      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          return {
            raw: input.slice(openIndex, i + 1),
            inner: input.slice(openIndex + 1, i),
            endIndex: i,
          };
        }
      }
    }
  }

  return null;
}

function findLastSupportedDecorator(segment) {
  const uncommentedSegment = segment
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '');
  const decoratorRegex =
    /@(PrimaryGeneratedColumn|PrimaryColumn|Column|CreateDateColumn|UpdateDateColumn|DeleteDateColumn|VersionColumn)\b/g;
  const matches = [...uncommentedSegment.matchAll(decoratorRegex)];
  const match = matches.at(-1);
  if (!match || match.index === undefined) {
    return null;
  }

  const decoratorName = match[1];
  let cursor = match.index + match[0].length;
  while (cursor < uncommentedSegment.length && /\s/.test(uncommentedSegment[cursor])) {
    cursor += 1;
  }

  if (uncommentedSegment[cursor] === '(') {
    const balanced = readBalancedParentheses(uncommentedSegment, cursor);
    return {
      decoratorName,
      decoratorArgs: balanced?.inner ?? '',
    };
  }

  return {
    decoratorName,
    decoratorArgs: '',
  };
}

function splitSqlStatements(input) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let dollarQuoteTag = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const prev = input[i - 1];

    if (!inSingle && !inDouble) {
      const dollarMatch = input.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        if (dollarQuoteTag === null) {
          dollarQuoteTag = tag;
        } else if (dollarQuoteTag === tag) {
          dollarQuoteTag = null;
        }
        current += tag;
        i += tag.length - 1;
        continue;
      }
    }

    if (!dollarQuoteTag) {
      if (char === "'" && !inDouble && prev !== '\\') {
        inSingle = !inSingle;
      } else if (char === '"' && !inSingle && prev !== '\\') {
        inDouble = !inDouble;
      } else if (char === ';' && !inSingle && !inDouble) {
        const statement = stripSqlComments(current);
        if (statement) statements.push(statement);
        current = '';
        continue;
      }
    }

    current += char;
  }

  const trailingStatement = stripSqlComments(current);
  if (trailingStatement) statements.push(trailingStatement);
  return statements;
}

function parseCreateTableStatement(statement, tables) {
  const cleaned = stripSqlComments(statement);
  const match = cleaned.match(
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+("?[\w.]+"?)\s*\(([\s\S]*)\)\s*;?$/i,
  );
  if (!match) return;

  const tableName = normalizeTableName(match[1]);
  const body = match[2];
  const table = tables.get(tableName) ?? {
    created: false,
    columns: new Set(),
  };

  for (const segment of splitTopLevelSegments(body)) {
    if (
      /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)\b/i.test(segment)
    ) {
      continue;
    }
    const columnMatch = segment.match(/^("?[a-zA-Z_][\w$]*"?)/);
    if (!columnMatch) continue;
    table.columns.add(normalizeColumnName(columnMatch[1]));
  }

  table.created = true;
  tables.set(tableName, table);
}

function parseAlterTableStatement(statement, tables) {
  const cleaned = stripSqlComments(statement);
  const match = cleaned.match(/ALTER\s+TABLE(?:\s+ONLY)?\s+("?[\w.]+"?)\s+([\s\S]*)$/i);
  if (!match) return;

  const tableName = normalizeTableName(match[1]);
  const table = tables.get(tableName) ?? {
    created: false,
    columns: new Set(),
  };

  for (const addColumnMatch of match[2].matchAll(/ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+("?[a-zA-Z_][\w$]*"?)/gi)) {
    table.columns.add(normalizeColumnName(addColumnMatch[1]));
  }

  tables.set(tableName, table);
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
    classBlock: source.slice(classIndex, classBodyEnd + 1),
  };
}

function findTopLevelClassProperties(classBlock) {
  const masked = [];
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let braceDepth = 0;

  for (let i = 0; i < classBlock.length; i += 1) {
    const char = classBlock[i];
    const prev = classBlock[i - 1];
    const next = classBlock[i + 1];

    if (!inSingle && !inDouble && !inTemplate && !inLineComment && !inBlockComment) {
      if (char === '/' && next === '/') {
        inLineComment = true;
      } else if (char === '/' && next === '*') {
        inBlockComment = true;
      }
    }

    if (inLineComment) {
      masked.push(' ');
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      masked.push(' ');
      if (prev === '*' && char === '/') {
        inBlockComment = false;
      }
      continue;
    }

    if (char === "'" && !inDouble && !inTemplate && prev !== '\\') {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && !inTemplate && prev !== '\\') {
      inDouble = !inDouble;
    } else if (char === '`' && !inSingle && !inDouble && prev !== '\\') {
      inTemplate = !inTemplate;
    } else if (!inSingle && !inDouble && !inTemplate) {
      if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth = Math.max(braceDepth - 1, 0);
      }
    }

    masked.push(!inSingle && !inDouble && !inTemplate && braceDepth === 1 ? char : ' ');
  }

  const matches = [];
  const propertyRegex = /([A-Za-z_]\w*)\??\s*:\s*([^;=\n]+)/g;
  const maskedSource = masked.join('');

  for (const propertyMatch of maskedSource.matchAll(propertyRegex)) {
    if (propertyMatch.index === undefined) continue;
    matches.push({
      propertyName: propertyMatch[1],
      propertyType: propertyMatch[2].trim(),
      index: propertyMatch.index,
      length: propertyMatch[0].length,
    });
  }

  return matches;
}

function extractEnumValues(source) {
  const values = new Map();

  for (const match of source.matchAll(/export\s+enum\s+(\w+)\s*\{([\s\S]*?)\}/g)) {
    const enumName = match[1];
    const body = match[2];
    for (const entry of splitTopLevelSegments(body)) {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) continue;
      const memberName = entry.slice(0, separatorIndex).trim();
      const rawValue = entry.slice(separatorIndex + 1).trim();
      if (!memberName || !/^['"`].*['"`]$/.test(rawValue)) continue;
      values.set(`${enumName}.${memberName}`, unquoteLiteral(rawValue));
    }
  }

  return values;
}

function parseObjectLiteral(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return {};
  }

  const values = {};
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return values;

  for (const segment of splitTopLevelSegments(inner)) {
    const delimiterIndex = findTopLevelDelimiter(segment, ':');
    if (delimiterIndex === -1) continue;
    const key = segment.slice(0, delimiterIndex).trim();
    const rawValue = segment.slice(delimiterIndex + 1).trim();
    if (!key) continue;
    values[key] = rawValue;
  }

  return values;
}

function parseDecoratorArgs(rawArgs) {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return {
      explicitType: null,
      options: {},
    };
  }

  const parts = splitTopLevelSegments(trimmed);
  let explicitType = null;
  let options = {};

  for (const part of parts) {
    const candidate = part.trim();
    if (!candidate) continue;
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      options = { ...options, ...parseObjectLiteral(candidate) };
      continue;
    }
    if (explicitType === null) {
      explicitType = candidate;
    }
  }

  return {
    explicitType,
    options,
  };
}

function parseLiteralValue(rawValue, enumValues) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('() =>')) {
    let expression = trimmed.replace(/^\(\)\s*=>\s*/, '').trim();
    if (/^['"`].*['"`]$/.test(expression)) {
      expression = unquoteLiteral(expression);
    }
    return { kind: 'sql', value: expression };
  }

  if (/^['"`].*['"`]$/.test(trimmed)) {
    return { kind: 'string', value: unquoteLiteral(trimmed) };
  }

  if (trimmed === 'true' || trimmed === 'false') {
    return { kind: 'boolean', value: trimmed === 'true' };
  }

  if (trimmed === '[]') {
    return { kind: 'array', value: [] };
  }

  if (trimmed === '{}') {
    return { kind: 'object', value: {} };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { kind: 'number', value: Number(trimmed) };
  }

  if (enumValues.has(trimmed)) {
    return { kind: 'string', value: enumValues.get(trimmed) };
  }

  return { kind: 'raw', value: trimmed };
}

function resolveColumnName(propertyName, options) {
  if (options.name) {
    return unquoteLiteral(options.name);
  }
  return propertyName;
}

function mapColumnType(decoratorName, explicitType, options, propertyType, defaultValue) {
  const rawType = options.type ? unquoteLiteral(options.type) : explicitType ? unquoteLiteral(explicitType) : null;
  const normalizedType = rawType?.toLowerCase();
  const normalizedPropertyType = propertyType
    ? propertyType
        .replace(/\[\]$/g, '')
        .replace(/\s*\|\s*null/g, '')
        .replace(/\s*\|\s*undefined/g, '')
        .trim()
        .toLowerCase()
    : null;
  const isArray = options.array === 'true';
  const length = options.length ? Number(options.length) : null;
  const precision = options.precision ? Number(options.precision) : null;
  const scale = options.scale ? Number(options.scale) : null;

  if (decoratorName === 'PrimaryGeneratedColumn') {
    if (!normalizedType || normalizedType === 'uuid') {
      return 'UUID';
    }
    if (normalizedType === 'increment' || normalizedType === 'int' || normalizedType === 'integer') {
      return 'INTEGER';
    }
  }

  if (decoratorName === 'PrimaryColumn' && !normalizedType) {
    return 'TEXT';
  }

  if (decoratorName === 'CreateDateColumn' || decoratorName === 'UpdateDateColumn' || decoratorName === 'DeleteDateColumn') {
    if (normalizedType === 'date') return 'DATE';
    if (normalizedType === 'timestamp' || normalizedType === 'timestamp without time zone') {
      return 'TIMESTAMP';
    }
    return 'TIMESTAMP WITH TIME ZONE';
  }

  if (decoratorName === 'VersionColumn') {
    return 'INTEGER';
  }

  let sqlType;
  switch (normalizedType) {
    case 'uuid':
      sqlType = 'UUID';
      break;
    case 'varchar':
    case 'character varying':
      sqlType = `VARCHAR(${length || 255})`;
      break;
    case 'text':
      sqlType = 'TEXT';
      break;
    case 'int':
    case 'integer':
      sqlType = 'INTEGER';
      break;
    case 'bigint':
      sqlType = 'BIGINT';
      break;
    case 'smallint':
      sqlType = 'SMALLINT';
      break;
    case 'decimal':
    case 'numeric':
      if (precision && scale !== null) {
        sqlType = `NUMERIC(${precision}, ${scale})`;
      } else if (precision) {
        sqlType = `NUMERIC(${precision})`;
      } else {
        sqlType = 'NUMERIC';
      }
      break;
    case 'float':
    case 'double precision':
      sqlType = 'DOUBLE PRECISION';
      break;
    case 'real':
      sqlType = 'REAL';
      break;
    case 'boolean':
    case 'bool':
      sqlType = 'BOOLEAN';
      break;
    case 'json':
    case 'jsonb':
    case 'simple-json':
      sqlType = 'JSONB';
      break;
    case 'date':
      sqlType = 'DATE';
      break;
    case 'time':
      sqlType = 'TIME';
      break;
    case 'timestamp':
    case 'timestamp without time zone':
      sqlType = 'TIMESTAMP';
      break;
    case 'timestamp with time zone':
    case 'timestamptz':
    case 'datetime':
      sqlType = 'TIMESTAMP WITH TIME ZONE';
      break;
    case 'enum':
    case 'simple-enum':
      sqlType = length ? `VARCHAR(${length})` : 'TEXT';
      break;
    default:
      if (normalizedPropertyType === 'boolean' || defaultValue?.kind === 'boolean') {
        sqlType = 'BOOLEAN';
      } else if (normalizedPropertyType === 'number' || defaultValue?.kind === 'number') {
        sqlType = 'INTEGER';
      } else if (normalizedPropertyType === 'date') {
        sqlType = 'TIMESTAMP WITH TIME ZONE';
      } else if (normalizedPropertyType === 'string') {
        sqlType = length ? `VARCHAR(${length})` : 'TEXT';
      } else if (
        normalizedPropertyType === 'object' ||
        normalizedPropertyType?.startsWith('record<') ||
        defaultValue?.kind === 'object' ||
        defaultValue?.kind === 'array'
      ) {
        sqlType = 'JSONB';
      } else if (length) {
        sqlType = `VARCHAR(${length})`;
      } else if (!normalizedType) {
        sqlType = 'TEXT';
      } else {
        sqlType = normalizedType.toUpperCase();
      }
  }

  return isArray ? `${sqlType}[]` : sqlType;
}

function buildColumnDefinition({ decoratorName, propertyName, propertyType, rawArgs }, enumValues) {
  const { explicitType, options } = parseDecoratorArgs(rawArgs);
  const rawColumnName = resolveColumnName(propertyName, options);
  const defaultValue =
    options.default !== undefined
      ? parseLiteralValue(options.default, enumValues)
      : decoratorName === 'CreateDateColumn' || decoratorName === 'UpdateDateColumn'
        ? { kind: 'sql', value: 'NOW()' }
        : decoratorName === 'VersionColumn'
          ? { kind: 'number', value: 1 }
          : null;

  return {
    propertyName,
    propertyType,
    rawColumnName,
    normalizedColumnName: rawColumnName.toLowerCase(),
    quoted: rawColumnName !== rawColumnName.toLowerCase(),
    decoratorName,
    sqlType: mapColumnType(decoratorName, explicitType, options, propertyType, defaultValue),
    nullable: options.nullable === 'true' || decoratorName === 'DeleteDateColumn',
    defaultValue,
    primary:
      decoratorName === 'PrimaryGeneratedColumn' || decoratorName === 'PrimaryColumn',
    generated: decoratorName === 'PrimaryGeneratedColumn',
    generatedStrategy: explicitType ? unquoteLiteral(explicitType).toLowerCase() : null,
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

function extractEntityColumnsDetailed(classBlock, enumValues) {
  const columns = new Map();

  let previousPropertyIndex = 0;

  for (const propertyMatch of findTopLevelClassProperties(classBlock)) {
    const { propertyName, propertyType } = propertyMatch;
    const segment = classBlock.slice(previousPropertyIndex, propertyMatch.index);
    previousPropertyIndex = propertyMatch.index + propertyMatch.length;

    const decoratorMatch = findLastSupportedDecorator(segment);
    if (!decoratorMatch) {
      continue;
    }

    const { decoratorName, decoratorArgs } = decoratorMatch;
    const definition = buildColumnDefinition(
        {
          decoratorName,
          propertyName,
          propertyType,
          rawArgs: decoratorArgs,
        },
        enumValues,
    );
    columns.set(definition.rawColumnName, definition);
  }

  return [...columns.values()].sort((a, b) => a.normalizedColumnName.localeCompare(b.normalizedColumnName));
}

export async function extractEntityTables() {
  const { entityNames, importMap } = await getTenantEntityRegistry();
  const tables = new Map();

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) {
      throw new Error(`Missing import path for entity ${entityName}`);
    }

    const source = await fs.readFile(filePath, 'utf8');
    const enumValues = extractEnumValues(source);
    const { decoratorBlock, classBlock } = findEntityClassBlock(source, entityName);
    const tableName = extractEntityTableName(decoratorBlock, entityName);
    const columns = extractEntityColumnsDetailed(classBlock, enumValues);
    const existing = tables.get(tableName) ?? {
      tableName,
      entityNames: [],
      columns: [],
      columnDefinitions: [],
    };

    if (!existing.entityNames.includes(entityName)) {
      existing.entityNames.push(entityName);
    }

    const nextColumns = new Map(existing.columnDefinitions.map((definition) => [definition.rawColumnName, definition]));
    for (const definition of columns) {
      nextColumns.set(definition.rawColumnName, definition);
    }
    existing.columnDefinitions = [...nextColumns.values()].sort((a, b) =>
      a.normalizedColumnName.localeCompare(b.normalizedColumnName),
    );
    existing.columns = existing.columnDefinitions.map((definition) => definition.normalizedColumnName);
    tables.set(tableName, existing);
  }

  return tables;
}

export async function extractProvisionedSchema(options = {}) {
  const ignoredSourcePaths = new Set(
    (options.ignoredSourcePaths ?? []).map((sourcePath) => path.resolve(sourcePath)),
  );
  const sourcesToScan = [PROVISIONING_SERVICE_PATH];
  const visited = new Set();
  const tables = new Map();

  while (sourcesToScan.length > 0) {
    const sourcePath = sourcesToScan.pop();
    if (!sourcePath || visited.has(sourcePath)) continue;
    if (ignoredSourcePaths.has(path.resolve(sourcePath))) continue;
    visited.add(sourcePath);

    let source;
    try {
      source = await fs.readFile(sourcePath, 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    const importRegex = /import\s+[^'"]+\s+from\s+['"](\.[^'"]+)['"];?/g;
    for (const match of source.matchAll(importRegex)) {
      const importPath = path.resolve(path.dirname(sourcePath), `${match[1]}.ts`);
      sourcesToScan.push(importPath);
    }

    for (const templateLiteral of source.matchAll(/`([\s\S]*?)`/g)) {
      for (const statement of splitSqlStatements(templateLiteral[1])) {
        if (!/(CREATE\s+TABLE|ALTER\s+TABLE)/i.test(statement)) continue;
        parseCreateTableStatement(statement, tables);
        parseAlterTableStatement(statement, tables);
      }
    }
  }

  return tables;
}

export async function runAudit(options = {}) {
  const entityTables = await extractEntityTables();
  const provisionedTables = await extractProvisionedSchema(options);

  const missingTables = [];
  const tablesWithMissingColumns = [];

  for (const [tableName, entityTable] of entityTables.entries()) {
    const provisionedTable = provisionedTables.get(tableName);
    if (!provisionedTable || !provisionedTable.created) {
      missingTables.push({
        tableName,
        entityNames: [...entityTable.entityNames].sort(),
        missingColumns: [...entityTable.columns].sort(),
      });
      continue;
    }

    const missingColumns = entityTable.columns.filter(
      (column) => !provisionedTable.columns.has(column),
    );
    if (missingColumns.length > 0) {
      tablesWithMissingColumns.push({
        tableName,
        entityNames: [...entityTable.entityNames].sort(),
        missingColumns: missingColumns.sort(),
      });
    }
  }

  const result = {
    ok: missingTables.length === 0 && tablesWithMissingColumns.length === 0,
    tableCount: entityTables.size,
    missingTableCount: missingTables.length,
    missingColumnTableCount: tablesWithMissingColumns.length,
    missingTables: missingTables.sort((a, b) => a.tableName.localeCompare(b.tableName)),
    tablesWithMissingColumns: tablesWithMissingColumns.sort((a, b) =>
      a.tableName.localeCompare(b.tableName),
    ),
  };

  return result;
}

async function main() {
  const result = await runAudit();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
