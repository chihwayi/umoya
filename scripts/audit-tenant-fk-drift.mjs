import fs from 'node:fs/promises';

import {
  extractEntityTables,
  getTenantEntityRegistry,
  findEntityClassBlock,
  findTopLevelClassProperties,
} from './audit-tenant-provisioning.mjs';

// Detects the uuid/text FK mismatch bug class: a @JoinColumn-backed relation
// whose own @Column was declared without `type: 'uuid'` (so it renders as
// TEXT/VARCHAR) while the relation target's primary key is UUID. Postgres
// can't compare uuid = text, so any JOIN across such a column throws at
// query-plan time, even on empty tables.
function extractEntityRelations(classBlock) {
  const relations = [];
  const properties = findTopLevelClassProperties(classBlock);
  let previousPropertyIndex = 0;

  for (const propertyMatch of properties) {
    const segment = classBlock.slice(previousPropertyIndex, propertyMatch.index);
    previousPropertyIndex = propertyMatch.index + propertyMatch.length;

    const relationMatch = segment.match(/@(?:ManyToOne|OneToOne)\(\s*\(\)\s*=>\s*(\w+)/);
    const joinColumnMatch = segment.match(/@JoinColumn\(\s*\{[^}]*name\s*:\s*['"`](\w+)['"`]/);
    if (!relationMatch || !joinColumnMatch) continue;

    relations.push({
      propertyName: propertyMatch.propertyName,
      targetEntityName: relationMatch[1],
      joinColumnName: joinColumnMatch[1].toLowerCase(),
    });
  }

  return relations;
}

function findPrimaryColumn(columnDefinitions) {
  return columnDefinitions.find((column) => column.primary) ?? null;
}

async function buildEntityToTableMap(entityTables) {
  const map = new Map();
  for (const table of entityTables.values()) {
    for (const entityName of table.entityNames) {
      map.set(entityName, table.tableName);
    }
  }
  return map;
}

export async function runFkDriftAudit() {
  const entityTables = await extractEntityTables();
  const entityToTable = await buildEntityToTableMap(entityTables);
  const { entityNames, importMap } = await getTenantEntityRegistry();

  const mismatches = [];
  const unresolvedTargets = [];

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) continue;

    const source = await fs.readFile(filePath, 'utf8');
    const { classBlock } = findEntityClassBlock(source, entityName);
    const relations = extractEntityRelations(classBlock);
    if (relations.length === 0) continue;

    const ownTableName = entityToTable.get(entityName);
    const ownTable = ownTableName ? entityTables.get(ownTableName) : null;

    for (const relation of relations) {
      const targetTableName = entityToTable.get(relation.targetEntityName);
      if (!targetTableName) {
        // Relation points at an entity outside the tenant registry (e.g. a
        // master-DB-only entity) — nothing in the tenant schema to compare.
        unresolvedTargets.push({
          entityName,
          propertyName: relation.propertyName,
          targetEntityName: relation.targetEntityName,
        });
        continue;
      }

      const targetTable = entityTables.get(targetTableName);
      const targetPrimaryColumn = targetTable ? findPrimaryColumn(targetTable.columnDefinitions) : null;
      if (!targetPrimaryColumn) continue;

      const ownColumn = ownTable?.columnDefinitions.find(
        (column) => column.normalizedColumnName === relation.joinColumnName,
      );
      // No standalone @Column for the FK — nothing to compare (TypeORM would
      // infer the column type itself in that case, so there's no drift risk).
      if (!ownColumn) continue;

      const targetIsUuid = targetPrimaryColumn.sqlType.toUpperCase() === 'UUID';
      const ownIsUuid = ownColumn.sqlType.toUpperCase() === 'UUID';

      if (targetIsUuid && !ownIsUuid) {
        mismatches.push({
          entityName,
          propertyName: relation.propertyName,
          tableName: ownTableName,
          columnName: relation.joinColumnName,
          columnType: ownColumn.sqlType,
          targetEntityName: relation.targetEntityName,
          targetTableName,
          targetPrimaryKeyType: targetPrimaryColumn.sqlType,
        });
      }
    }
  }

  const sortByTableThenColumn = (a, b) =>
    a.tableName.localeCompare(b.tableName) || a.columnName.localeCompare(b.columnName);

  return {
    ok: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches: mismatches.sort(sortByTableThenColumn),
    unresolvedTargetCount: unresolvedTargets.length,
    unresolvedTargets,
  };
}

async function main() {
  const result = await runFkDriftAudit();
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
