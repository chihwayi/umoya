#!/usr/bin/env node
// R1 / FX-001 CI drift gate, part 2 (part 1 = audit-tenant-provisioning.mjs).
//
// Part 1 is blind to raw-SQL-only references (Class B/C: `diagnoses`, `mrn`,
// camelCase identifiers). This gate scans services/ehr-service/src for raw
// SQL (query(`...`), .query('...'), .query("...")) and checks:
//   (a) every table in FROM/JOIN/INSERT INTO/UPDATE exists in the bundle schema;
//   (b) every double-quoted identifier resolves to a column of a queried table
//       (catches F-004-class camelCase vs snake_case);
//   (c) every bare identifier in a SELECT list resolves to a column of a
//       queried table, a query-defined alias, or the keyword/function stoplist
//       (catches P-001-class phantom `mrn`).
//
// SELECT * skips the column check (logged). DDL statements in the bundle file
// itself are out of scope (part 1 covers them).
//
// Usage: node scripts/audit-rawsql-drift.mjs [--self-test]
// Exit 1 with a JSON report when drift is found.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProvisionedSchema } from './audit-tenant-provisioning.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'services', 'ehr-service', 'src');

const STOPLIST = new Set(
  ('select,from,where,and,or,not,as,on,join,inner,left,right,full,outer,group,by,' +
    'order,having,limit,offset,distinct,union,all,case,when,then,else,end,cast,' +
    'count,sum,avg,min,max,coalesce,nullif,now,current_date,current_timestamp,' +
    'interval,desc,asc,into,values,returning,conflict,do,update,delete,insert,' +
    'set,true,false,null,is,like,ilike,in,between,exists,any,some,extract,epoch,' +
    'date_part,age,jsonb_build_object,jsonb_agg,unnest,gen_random_uuid,uuid_generate_v4,' +
    'substring,position,trim,upper,lower,length,round,floor,ceil,abs,row_number,' +
    'rank,over,partition,order by,today,yesterday,text,integer,int,bigint,boolean,' +
    'varchar,timestamptz,timestamp,date,jsonb,json,numeric,decimal,uuid,serial,' +
    'primary,key,references,default,not,check,constraint,unique,current_user,' +
    'on,using,btree,gist,gin,if,elseif,elsif,begin,do,raise,perform,select into,' +
    'a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,' +
    'dow,month,year,day,hour,minute,second,quarter,week,microseconds,milliseconds,' +
    'decade,century,millennium,timezone,isodow,isoyear,julian,epoch'
  ).split(','),
);

function listTsFiles(dir, out = []) {
  return fs.readdir(dir, { withFileTypes: true }).then(async (ents) => {
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.endsWith('.spec.ts')) continue;
        await listTsFiles(p, out);
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p);
    }
    return out;
  });
}

function extractQueries(source) {
  // template literals and string literals passed to .query(
  const out = [];
  const re = /\.query\(\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    let s = m[1];
    const q = s[0];
    s = s.slice(1, -1);
    if (q === '`') s = s.replace(/\\\`/g, '`').replace(/\$\{[^}]*\}/g, ' ? ');
    out.push(s);
  }
  return out;
}

function tablesOf(sql, cteNames = new Set()) {
  const tables = new Map(); // alias-or-name -> table
  const bare = (n) => n.toLowerCase().split('.').pop();
  const re = /\b(?:from|join)\s+([a-z_][a-z0-9_.]*)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const table = bare(m[1]);
    const alias = (m[2] || table).toLowerCase();
    if (STOPLIST.has(table)) continue;
    tables.set(alias, table);
    tables.set(table, table);
  }
  const bare2 = (n) => n.toLowerCase().split('.').pop();
  const ins = sql.match(/\binsert\s+into\s+([a-z_][a-z0-9_.]*)/i);
  if (ins) tables.set(bare2(ins[1]), bare2(ins[1]));
  const upd = sql.match(/^\s*update\s+([a-z_][a-z0-9_.]*)/i);
  if (upd) tables.set(bare2(upd[1]), bare2(upd[1]));
  // CTE names (WITH [RECURSIVE] x AS (...), y AS (...)) are query-local.
  for (const m of sql.matchAll(/\b(?:with(?:\s+recursive)?|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)) {
    tables.delete(m[1].toLowerCase());
    cteNames.add(m[1].toLowerCase());
  }
  return { tables, cteNames };
}

// Tables created by sanctioned scripts outside the bundle (documented, not drift):
// scripts/import-uk-snomed-*.mjs create the RF2 tables; the bundle intentionally
// does not duplicate the multi-GB terminology load path. R7 may fold them in.
// Master `tenants` is likewise bundle-external: its DDL lives in TypeORM sync /
// tenant-service ensureSubscriptionSchema, and only the R1 policy-column patch
// is bundle-managed. ehr-service master-tenant reads are checked for table
// presence only, never columns (owner: SCHEMA_SOURCE_OF_TRUTH follow-up).
const EXTERNAL_TABLES = new Set([
  'snomed_concepts', 'snomed_descriptions', 'snomed_relationships',
  'snomed_to_icd10_map',
]);
const MASTER_EXTERNAL_TABLES = new Set(['tenants']);

function checkQuery(sql, file, schema) {
  const problems = [];
  const cteNames = new Set();
  const { tables } = tablesOf(sql, cteNames);
  for (const t of new Set(tables.values())) {
    if (!schema.has(t) && !EXTERNAL_TABLES.has(t)) {
      problems.push({ file, sql: sql.slice(0, 160), kind: 'unknown-table', detail: t });
    }
  }
  const touchesExternal = [...new Set(tables.values())].some(
    (t) => EXTERNAL_TABLES.has(t) || MASTER_EXTERNAL_TABLES.has(t),
  );
  if (touchesExternal) return problems; // column checks need out-of-bundle DDL; table check above suffices
  const knownCols = new Set();
  for (const t of new Set(tables.values())) {
    const e = schema.get(t);
    if (e) for (const c of e.columns) knownCols.add(c);
  }
  // (b) quoted identifiers must be real columns (aliases stripped first)
  const dealiased = sql.replace(/\s+[Aa][Ss]\s+"[A-Za-z_][A-Za-z0-9_]*"/g, '');
  for (const m of dealiased.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)) {
    const ident = m[1];
    const snake = ident.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (!knownCols.has(snake) && !knownCols.has(ident)) {
      problems.push({ file, sql: sql.slice(0, 160), kind: 'unknown-quoted-column', detail: ident });
    }
  }
  // (c) bare identifiers in the SELECT list
  const sel = sql.match(/^\s*select\s+([\s\S]*?)\s+from\s/i);
  if (!sel || /^\s*\*\s*$/.test(sel[1].trim())) return problems;
  let list = sel[1]
    .replace(/'[^']*'/g, "''")
    .replace(/\b[a-z_][a-z0-9_]*\s*\([^)]*\)/gi, ' ')
    .replace(/::\s*[a-z_][a-z0-9_ ]*/gi, ' ')
    .replace(/\s+[Aa][Ss]\s+"[A-Za-z_][A-Za-z0-9_]*"/g, ' ')
    .replace(/\s+[Aa][Ss]\s+[a-z_][a-z0-9_]*/g, ' ');
  const aliases = new Set([...tables.keys(), ...cteNames]);
  for (const m of list.matchAll(/\s+[Aa][Ss]\s+([a-z_][a-z0-9_]*)/g)) aliases.add(m[1].toLowerCase());
  for (const m of list.matchAll(/([a-z_][a-z0-9_]*)/gi)) {
    const w = m[1].toLowerCase();
    if (STOPLIST.has(w) || aliases.has(w) || /^\d+$/.test(w)) continue;
    // dotted ref: check the base table if the qualifier is a known alias
    const parts = w.split('.');
    if (parts.length > 1) continue; // qualifier handling is best-effort; quoted check covers it
    if (!knownCols.has(w)) {
      problems.push({ file, sql: sql.slice(0, 160), kind: 'unknown-column', detail: m[1] });
    }
  }
  return problems;
}

export async function loadDriftBaseline() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'scripts', 'rawsql-drift-baseline.json'), 'utf8');
    return new Set(JSON.parse(raw).map((e) => `${e.file}|${e.kind}|${e.detail}`));
  } catch {
    return new Set();
  }
}

export async function runRawSqlAudit(options = {}) {
  const schema = await extractProvisionedSchema(options);
  const baseline = options.ignoreBaseline ? new Set() : await loadDriftBaseline();
  const files = options.files ?? (await listTsFiles(SRC));
  const problems = [];
  const selfTest = options.selfTestPayloads ?? null;
  if (selfTest) {
    for (const sql of selfTest) problems.push(...checkQuery(sql, '<self-test>', schema));
    return { ok: problems.length === 0, problemCount: problems.length, problems };
  }
  for (const f of files) {
    const src = await fs.readFile(f, 'utf8');
    for (const sql of extractQueries(src)) {
      if (!/\b(select|insert|update|delete)\b/i.test(sql)) continue;
      problems.push(...checkQuery(sql, path.relative(ROOT, f), schema));
    }
  }
  // de-duplicate identical findings, then subtract the curated known-drift
  // baseline (each entry names its owning fix). The gate fails on NEW drift.
  const seen = new Set();
  const uniq = problems.filter((p) => {
    const k = `${p.file}|${p.kind}|${p.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const fresh = uniq.filter((p) => !baseline.has(`${p.file}|${p.kind}|${p.detail}`));
  const baselined = uniq.length - fresh.length;
  return { ok: fresh.length === 0, problemCount: fresh.length, baselinedCount: baselined, problems: fresh };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    // Negative control: must FAIL on deliberately reintroduced drift.
    const bad = await runRawSqlAudit({
      selfTestPayloads: [
        'SELECT id, first_name, mrn FROM patients WHERE id = $1',
        'SELECT id, "patientId" FROM medical_records WHERE "patientId" = $1',
        'SELECT zzz FROM phantom_table_xyz WHERE id = $1',
      ],
    });
    if (bad.ok || bad.problemCount < 3) {
      console.error('SELF-TEST FAILED: gate did not catch reintroduced drift', JSON.stringify(bad, null, 2));
      process.exit(2);
    }
    console.log(`self-test OK: gate catches reintroduced drift (${bad.problemCount} findings on phantom SQL)`);
    return;
  }
  const result = await runRawSqlAudit();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('audit-rawsql-drift.mjs')) main().catch((e) => { console.error(e); process.exit(1); });
