import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const TENANT_SERVICE_PATH = path.join(
  ROOT,
  'services/ehr-service/src/services/tenant.service.ts',
);
const OUTPUT_PATH = path.join(
  ROOT,
  'services/tenant-service/src/generated/tenant-entity-structure-alignment.statements.ts',
);
const BUNDLE_VERSION = '2026.06.10.1';

function stripQuotes(identifier) {
  return identifier.replace(/^"+|"+$/g, '');
}

function normalizeTableName(input) {
  const raw = stripQuotes(input.trim().replace(/;$/, ''));
  const withoutSchema = raw.includes('.') ? raw.split('.').pop() : raw;
  return withoutSchema.toLowerCase();
}

function unquoteLiteral(input) {
  return input.replace(/^['"`]|['"`]$/g, '');
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
            inner: input.slice(openIndex + 1, i),
            endIndex: i,
          };
        }
      }
    }
  }

  return null;
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

function parseArrayLiteral(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }

  return splitTopLevelSegments(trimmed.slice(1, -1))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => unquoteLiteral(value));
}

function extractDecorators(block, names = null) {
  const decorators = [];
  const wanted = names ? new Set(names) : null;

  for (let i = 0; i < block.length; i += 1) {
    if (block[i] !== '@') continue;
    const rest = block.slice(i + 1);
    const nameMatch = rest.match(/^([A-Za-z_]\w*)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (wanted && !wanted.has(name)) continue;

    let cursor = i + 1 + name.length;
    while (cursor < block.length && /\s/.test(block[cursor])) {
      cursor += 1;
    }

    let args = '';
    if (block[cursor] === '(') {
      const balanced = readBalancedParentheses(block, cursor);
      args = balanced?.inner ?? '';
      cursor = balanced?.endIndex ?? cursor;
    }

    decorators.push({ name, args });
    i = cursor;
  }

  return decorators;
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

  let decoratorBlockStart = entityDecoratorIndex;
  let cursor = entityDecoratorIndex;

  while (cursor > 0) {
    const lineEnd = cursor;
    const previousNewline = source.lastIndexOf('\n', lineEnd - 1);
    const lineStart = previousNewline === -1 ? 0 : previousNewline + 1;
    const line = source.slice(lineStart, lineEnd).trim();

    if (!line.startsWith('@')) {
      break;
    }

    decoratorBlockStart = lineStart;
    cursor = lineStart - 1;
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
    decoratorBlock: source.slice(decoratorBlockStart, classIndex),
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
  const propertyRegex = /([A-Za-z_]\w*)\??\s*:/g;
  const maskedSource = masked.join('');

  for (const propertyMatch of maskedSource.matchAll(propertyRegex)) {
    if (propertyMatch.index === undefined) continue;
    matches.push({
      propertyName: propertyMatch[1],
      index: propertyMatch.index,
      length: propertyMatch[0].length,
    });
  }

  return matches;
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

function parseIndexArgs(rawArgs, fallbackPropertyName) {
  const parts = splitTopLevelSegments(rawArgs).map((part) => part.trim()).filter(Boolean);
  let name = null;
  let unique = false;
  let propertyNames = fallbackPropertyName ? [fallbackPropertyName] : [];

  if (parts.length > 0 && /^['"`].*['"`]$/.test(parts[0])) {
    name = unquoteLiteral(parts.shift());
  }

  if (parts.length > 0 && parts[0].startsWith('[')) {
    propertyNames = parseArrayLiteral(parts.shift());
  }

  const optionsPart = parts.find((part) => part.startsWith('{') && part.endsWith('}'));
  if (optionsPart) {
    const options = parseObjectLiteral(optionsPart);
    unique = options.unique === 'true';
  }

  return {
    name,
    unique,
    propertyNames,
  };
}

function parseUniqueArgs(rawArgs) {
  const parts = splitTopLevelSegments(rawArgs).map((part) => part.trim()).filter(Boolean);
  let name = null;
  let propertyNames = [];

  if (parts.length > 0 && /^['"`].*['"`]$/.test(parts[0])) {
    name = unquoteLiteral(parts.shift());
  }

  if (parts.length > 0 && parts[0].startsWith('[')) {
    propertyNames = parseArrayLiteral(parts.shift());
  }

  return {
    name,
    propertyNames,
  };
}

function buildGeneratedName(prefix, tableName, columns, referencedTable = '') {
  const base = [prefix, tableName, ...columns, referencedTable].filter(Boolean).join('_');
  if (base.length <= 55) {
    return base;
  }
  const digest = crypto.createHash('sha1').update(base).digest('hex').slice(0, 8);
  return `${base.slice(0, 46)}_${digest}`;
}

function renderIdentifier(name) {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function renderTextArray(values) {
  return `ARRAY[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
}

function escapeTemplateLiteral(input) {
  return input.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function defaultJoinColumnName(propertyName) {
  return `${propertyName}Id`;
}

async function getTenantEntityRegistry() {
  const source = await fs.readFile(TENANT_SERVICE_PATH, 'utf8');
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'(\.[^']+\.entity)';/g;
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

export async function extractEntityStructure() {
  const { entityNames, importMap } = await getTenantEntityRegistry();
  const entities = new Map();

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) {
      throw new Error(`Missing import path for entity ${entityName}`);
    }

    const source = await fs.readFile(filePath, 'utf8');
    const { decoratorBlock, classBlock } = findEntityClassBlock(source, entityName);
    const tableName = extractEntityTableName(decoratorBlock, entityName);
    const properties = new Map();
    let previousPropertyIndex = 0;

    for (const propertyMatch of findTopLevelClassProperties(classBlock)) {
      const segment = classBlock.slice(previousPropertyIndex, propertyMatch.index);
      previousPropertyIndex = propertyMatch.index + propertyMatch.length;

      const decorators = extractDecorators(segment);
      if (decorators.length === 0 && properties.has(propertyMatch.propertyName)) {
        continue;
      }
      const columnDecorator = decorators.find((decorator) =>
        [
          'PrimaryGeneratedColumn',
          'PrimaryColumn',
          'Column',
          'CreateDateColumn',
          'UpdateDateColumn',
          'DeleteDateColumn',
          'VersionColumn',
        ].includes(decorator.name),
      );
      const joinColumnDecorator = decorators.find((decorator) => decorator.name === 'JoinColumn');
      const relationDecorator = decorators.find((decorator) =>
        ['ManyToOne', 'OneToOne'].includes(decorator.name),
      );

      let columnName = propertyMatch.propertyName;
      let columnUnique = false;
      if (columnDecorator) {
        const parts = splitTopLevelSegments(columnDecorator.args)
          .map((part) => part.trim())
          .filter(Boolean);
        const objectPart = parts.find((part) => part.startsWith('{') && part.endsWith('}'));
        if (objectPart) {
          const options = parseObjectLiteral(objectPart);
          if (options.name) {
            columnName = unquoteLiteral(options.name);
          }
          // Column-level `unique: true` declares a single-column unique index.
          columnUnique = options.unique === 'true';
        }
      } else if (joinColumnDecorator) {
        const parts = splitTopLevelSegments(joinColumnDecorator.args)
          .map((part) => part.trim())
          .filter(Boolean);
        const objectPart = parts.find((part) => part.startsWith('{') && part.endsWith('}'));
        if (objectPart) {
          const options = parseObjectLiteral(objectPart);
          columnName = options.name
            ? unquoteLiteral(options.name)
            : defaultJoinColumnName(propertyMatch.propertyName);
        } else {
          columnName = defaultJoinColumnName(propertyMatch.propertyName);
        }
      }

      let relation = null;
      if (relationDecorator) {
        const parts = splitTopLevelSegments(relationDecorator.args)
          .map((part) => part.trim())
          .filter(Boolean);
        const targetMatch = parts[0]?.match(/=>\s*(\w+)/);
        const optionsPart = parts.find((part) => part.startsWith('{') && part.endsWith('}'));
        const options = optionsPart ? parseObjectLiteral(optionsPart) : {};
        relation = {
          targetEntity: targetMatch?.[1] ?? null,
          onDelete: options.onDelete ? unquoteLiteral(options.onDelete) : null,
        };
      }

      const joinColumn =
        joinColumnDecorator
          ? (() => {
              const parts = splitTopLevelSegments(joinColumnDecorator.args)
                .map((part) => part.trim())
                .filter(Boolean);
              const objectPart = parts.find((part) => part.startsWith('{') && part.endsWith('}'));
              const options = objectPart ? parseObjectLiteral(objectPart) : {};
              return {
                name: options.name
                  ? unquoteLiteral(options.name)
                  : defaultJoinColumnName(propertyMatch.propertyName),
                referencedColumnName: options.referencedColumnName
                  ? unquoteLiteral(options.referencedColumnName)
                  : 'id',
              };
            })()
          : null;

      const propertyIndexes = decorators
        .filter((decorator) => decorator.name === 'Index')
        .map((decorator) => parseIndexArgs(decorator.args, propertyMatch.propertyName));

      properties.set(propertyMatch.propertyName, {
        propertyName: propertyMatch.propertyName,
        columnName,
        columnUnique,
        relation,
        joinColumn,
        propertyIndexes,
      });
    }

    entities.set(entityName, {
      entityName,
      tableName,
      decoratorBlock,
      properties,
    });
  }

  const entityByName = entities;
  const structure = [];

  for (const entity of entities.values()) {
    const indexSet = new Map();
    const uniqueSet = new Map();
    const foreignKeySet = new Map();

    for (const decorator of extractDecorators(entity.decoratorBlock, ['Index', 'Unique'])) {
      if (decorator.name === 'Index') {
        const index = parseIndexArgs(decorator.args, null);
        const columns = index.propertyNames
          .map((propertyName) => entity.properties.get(propertyName)?.columnName)
          .filter(Boolean);
        if (columns.length > 0) {
          const key = `${index.unique ? 'unique' : 'index'}:${columns.join(',')}`;
          indexSet.set(key, {
            name:
              index.name ||
              buildGeneratedName(index.unique ? 'uidx' : 'idx', entity.tableName, columns),
            columns,
            unique: index.unique,
          });
        }
      } else if (decorator.name === 'Unique') {
        const unique = parseUniqueArgs(decorator.args);
        const columns = unique.propertyNames
          .map((propertyName) => entity.properties.get(propertyName)?.columnName)
          .filter(Boolean);
        if (columns.length > 0) {
          const key = `unique:${columns.join(',')}`;
          uniqueSet.set(key, {
            name:
              unique.name || buildGeneratedName('uq', entity.tableName, columns),
            columns,
          });
        }
      }
    }

    for (const property of entity.properties.values()) {
      for (const propertyIndex of property.propertyIndexes) {
        const columns = [property.columnName];
        const key = `${propertyIndex.unique ? 'unique' : 'index'}:${columns.join(',')}`;
        indexSet.set(key, {
          name:
            propertyIndex.name ||
            buildGeneratedName(
              propertyIndex.unique ? 'uidx' : 'idx',
              entity.tableName,
              columns,
            ),
          columns,
          unique: propertyIndex.unique,
        });
      }

      // Column-level `@Column({ unique: true })` declares a single-column unique
      // index that ON CONFLICT seeds and entity contracts rely on.
      if (property.columnUnique) {
        const columns = [property.columnName];
        const key = `unique:${columns.join(',')}`;
        if (!indexSet.has(key)) {
          indexSet.set(key, {
            name: buildGeneratedName('uidx', entity.tableName, columns),
            columns,
            unique: true,
          });
        }
      }

      if (property.relation?.targetEntity && property.joinColumn) {
        const targetEntity = entityByName.get(property.relation.targetEntity);
        if (targetEntity) {
          const localColumns = [property.joinColumn.name];
          const referencedColumns = [property.joinColumn.referencedColumnName || 'id'];
          const key = `${localColumns.join(',')}=>${targetEntity.tableName}:${referencedColumns.join(',')}`;
          foreignKeySet.set(key, {
            name: buildGeneratedName('fk', entity.tableName, localColumns, targetEntity.tableName),
            localColumns,
            referencedTable: targetEntity.tableName,
            referencedColumns,
            onDelete: property.relation.onDelete,
          });
        }
      }
    }

    structure.push({
      entityName: entity.entityName,
      tableName: entity.tableName,
      indexes: [...indexSet.values()],
      uniques: [...uniqueSet.values()],
      foreignKeys: [...foreignKeySet.values()],
    });
  }

  return structure.sort((a, b) => a.tableName.localeCompare(b.tableName));
}

export async function extractEntityStructureDebug() {
  const { entityNames, importMap } = await getTenantEntityRegistry();
  const debugRows = [];

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) continue;
    const source = await fs.readFile(filePath, 'utf8');
    const { decoratorBlock, classBlock } = findEntityClassBlock(source, entityName);
    const tableName = extractEntityTableName(decoratorBlock, entityName);
    const properties = [];
    let previousPropertyIndex = 0;

    for (const propertyMatch of findTopLevelClassProperties(classBlock)) {
      const segment = classBlock.slice(previousPropertyIndex, propertyMatch.index);
      previousPropertyIndex = propertyMatch.index + propertyMatch.length;
      const decorators = extractDecorators(segment);
      if (
        decorators.length === 0 &&
        properties.some((property) => property.propertyName === propertyMatch.propertyName)
      ) {
        continue;
      }
      properties.push({
        propertyName: propertyMatch.propertyName,
        decorators,
      });
    }

    debugRows.push({
      entityName,
      tableName,
      properties,
    });
  }

  return debugRows;
}

function renderIndexStatement(tableName, index) {
  const uniqueSql = index.unique ? 'UNIQUE ' : '';
  const columnsSql = index.columns.map(renderIdentifier).join(', ');
  const indexName = renderIdentifier(index.name);

  return `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relname = '${tableName}'
      AND i.indpred IS NULL
      AND i.indisunique = ${index.unique ? 'TRUE' : 'FALSE'}
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(i.indkey) WITH ORDINALITY cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = t.oid
         AND att.attnum = cols.attnum
      ) = ${renderTextArray(index.columns)}
  ) THEN
    CREATE ${uniqueSql}INDEX IF NOT EXISTS ${indexName}
      ON ${renderIdentifier(tableName)} (${columnsSql});
  END IF;
END $$;`;
}

function renderUniqueConstraintStatement(tableName, unique) {
  const columnsSql = unique.columns.map(renderIdentifier).join(', ');

  return `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relname = '${tableName}'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(c.conkey) WITH ORDINALITY cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = t.oid
         AND att.attnum = cols.attnum
      ) = ${renderTextArray(unique.columns)}
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relname = '${tableName}'
      AND i.indpred IS NULL
      AND i.indisunique = TRUE
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(i.indkey) WITH ORDINALITY cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = t.oid
         AND att.attnum = cols.attnum
      ) = ${renderTextArray(unique.columns)}
  ) THEN
    ALTER TABLE ${renderIdentifier(tableName)}
      ADD CONSTRAINT ${renderIdentifier(unique.name)}
      UNIQUE (${columnsSql});
  END IF;
END $$;`;
}

function renderForeignKeyStatement(tableName, foreignKey) {
  const localColumnsSql = foreignKey.localColumns.map(renderIdentifier).join(', ');
  const referencedColumnsSql = foreignKey.referencedColumns.map(renderIdentifier).join(', ');
  const onDeleteSql = foreignKey.onDelete ? ` ON DELETE ${foreignKey.onDelete}` : '';

  return `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_class rt ON rt.oid = c.confrelid
    WHERE ns.nspname = 'public'
      AND t.relname = '${tableName}'
      AND rt.relname = '${foreignKey.referencedTable}'
      AND c.contype = 'f'
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(c.conkey) WITH ORDINALITY cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = t.oid
         AND att.attnum = cols.attnum
      ) = ${renderTextArray(foreignKey.localColumns)}
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(c.confkey) WITH ORDINALITY cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = rt.oid
         AND att.attnum = cols.attnum
      ) = ${renderTextArray(foreignKey.referencedColumns)}
  ) THEN
    ALTER TABLE ${renderIdentifier(tableName)}
      ADD CONSTRAINT ${renderIdentifier(foreignKey.name)}
      FOREIGN KEY (${localColumnsSql})
      REFERENCES ${renderIdentifier(foreignKey.referencedTable)} (${referencedColumnsSql})${onDeleteSql};
  END IF;
END $$;`;
}

async function main() {
  const structure = await extractEntityStructure();
  const statements = [];

  for (const entity of structure) {
    for (const index of entity.indexes) {
      statements.push(renderIndexStatement(entity.tableName, index));
    }
    for (const unique of entity.uniques) {
      statements.push(renderUniqueConstraintStatement(entity.tableName, unique));
    }
    for (const foreignKey of entity.foreignKeys) {
      statements.push(renderForeignKeyStatement(entity.tableName, foreignKey));
    }
  }

  const fileContents = `// Generated by scripts/generate-tenant-structure-alignment.mjs
// This bundle backfills entity-declared structural objects such as indexes, unique constraints, and foreign keys.

export const TENANT_ENTITY_STRUCTURE_ALIGNMENT_BUNDLE_VERSION = '${BUNDLE_VERSION}';

export const TENANT_ENTITY_STRUCTURE_ALIGNMENT_STATEMENTS = [
${statements.map((statement) => `  \`${escapeTemplateLiteral(statement)}\`,`).join('\n')}
];
`;

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, fileContents, 'utf8');

  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        bundleVersion: BUNDLE_VERSION,
        statementCount: statements.length,
        tableCount: structure.length,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
