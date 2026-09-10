#!/usr/bin/env node
/*
  Loads the full UK SNOMED CT Snapshot releases (properly connected, unlike
  the earlier partial delta load) on top of the freshly-refreshed
  International Edition (2026-02-01, loaded via the real import API
  immediately before this script runs):

    - UK Edition (999000041000000102)      - use the newer 2026-08-26 copy
    - UK Clinical (999000021000000109-ish) - 2026-07-29
    - UK Clinical Refsets                  - 2026-07-29
    - UK Drug Extension (999000011000001104) - 2026-08-26

  Also re-loads snomed_stated_relationships and snomed_owl_axioms for the
  International Edition itself, since the real-API import that just
  refreshed snomed_concepts/descriptions/relationships/snomed_to_icd10_map
  TRUNCATE...CASCADEd snomed_stated_relationships (it has an FK to
  snomed_concepts) down to empty, and left snomed_owl_axioms holding stale
  rows from the prior (November 2025) release.

  Same upsert-with-FK-existence-filtering pattern as
  import-uk-snomed-deltas.mjs, just pointed at Snapshot files (full current
  state) instead of Delta files (monthly changes only) — this time properly
  connected, since the International base + all UK modules are loaded
  together consistently.
*/
import { execSync } from 'node:child_process';

const BASE = '/tmp/uk_full_extracted';

function psql(sql) {
  execSync(`docker exec -i umoya-postgres-master psql -U postgres -d medicore -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
function psqlValue(sql) {
  return execSync(`docker exec -i umoya-postgres-master psql -U postgres -d medicore -v ON_ERROR_STOP=1 -At`, {
    input: sql,
    encoding: 'utf8',
  }).trim();
}

function copyIntoStaging(containerPath, stagingTable, columns) {
  psql(`
    DROP TABLE IF EXISTS ${stagingTable};
    CREATE TABLE ${stagingTable} (${columns.map((c) => `${c} text`).join(', ')});
  `);
  execSync(
    `docker exec -i umoya-postgres-master psql -U postgres -d medicore -v ON_ERROR_STOP=1 -c "\\copy ${stagingTable} FROM '${containerPath}' WITH (FORMAT csv, DELIMITER E'\\t', HEADER true, QUOTE E'\\x01')"`,
    { stdio: 'inherit' },
  );
}

function loadConcepts(file) {
  copyIntoStaging(file, '_stg_concept', ['id', 'effective_time', 'active', 'module_id', 'definition_status_id']);
  psql(`
    INSERT INTO snomed_concepts (concept_id, effective_time, active, module_id, definition_status_id)
    SELECT id, to_date(effective_time,'YYYYMMDD'), active='1', module_id, definition_status_id FROM _stg_concept
    ON CONFLICT (concept_id) DO UPDATE SET
      effective_time = EXCLUDED.effective_time, active = EXCLUDED.active,
      module_id = EXCLUDED.module_id, definition_status_id = EXCLUDED.definition_status_id
      WHERE EXCLUDED.effective_time >= snomed_concepts.effective_time;
  `);
  const n = Number(psqlValue('SELECT count(*) FROM _stg_concept;'));
  psql('DROP TABLE _stg_concept;');
  return n;
}

function loadDescriptions(file) {
  copyIntoStaging(file, '_stg_desc', ['id', 'effective_time', 'active', 'module_id', 'concept_id', 'language_code', 'type_id', 'term', 'case_significance_id']);
  psql(`
    INSERT INTO snomed_descriptions (description_id, effective_time, active, module_id, concept_id, language_code, type_id, term, case_significance_id)
    SELECT s.id, to_date(s.effective_time,'YYYYMMDD'), s.active='1', s.module_id, s.concept_id, s.language_code, s.type_id, s.term, s.case_significance_id
    FROM _stg_desc s WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.concept_id)
    ON CONFLICT (description_id) DO UPDATE SET
      effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, term = EXCLUDED.term
      WHERE EXCLUDED.effective_time >= snomed_descriptions.effective_time;
  `);
  const n = Number(psqlValue('SELECT count(*) FROM _stg_desc;'));
  psql('DROP TABLE _stg_desc;');
  return n;
}

function loadRelationships(file) {
  copyIntoStaging(file, '_stg_rel', ['id', 'effective_time', 'active', 'module_id', 'source_id', 'destination_id', 'relationship_group', 'type_id', 'characteristic_type_id', 'modifier_id']);
  psql(`
    INSERT INTO snomed_relationships (relationship_id, effective_time, active, module_id, source_id, destination_id, relationship_group, type_id, characteristic_type_id, modifier_id)
    SELECT s.id, to_date(s.effective_time,'YYYYMMDD'), s.active='1', s.module_id, s.source_id, s.destination_id, s.relationship_group::int, s.type_id, s.characteristic_type_id, s.modifier_id
    FROM _stg_rel s
    WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.source_id)
      AND EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.destination_id)
    ON CONFLICT (relationship_id) DO UPDATE SET
      effective_time = EXCLUDED.effective_time, active = EXCLUDED.active
      WHERE EXCLUDED.effective_time >= snomed_relationships.effective_time;
  `);
  const total = Number(psqlValue('SELECT count(*) FROM _stg_rel;'));
  const loaded = Number(psqlValue(`
    SELECT count(*) FROM _stg_rel s
    WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.source_id)
      AND EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.destination_id);
  `));
  psql('DROP TABLE _stg_rel;');
  return { total, loaded };
}

function loadStatedRelationships(file) {
  copyIntoStaging(file, '_stg_srel', ['id', 'effective_time', 'active', 'module_id', 'source_id', 'destination_id', 'relationship_group', 'type_id', 'characteristic_type_id', 'modifier_id']);
  psql(`
    INSERT INTO snomed_stated_relationships (relationship_id, effective_time, active, module_id, source_id, destination_id, relationship_group, type_id, characteristic_type_id, modifier_id)
    SELECT s.id, to_date(s.effective_time,'YYYYMMDD'), s.active='1', s.module_id, s.source_id, s.destination_id, s.relationship_group::int, s.type_id, s.characteristic_type_id, s.modifier_id
    FROM _stg_srel s
    WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.source_id)
      AND EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.destination_id)
    ON CONFLICT (relationship_id) DO UPDATE SET
      effective_time = EXCLUDED.effective_time, active = EXCLUDED.active;
  `);
  const n = Number(psqlValue('SELECT count(*) FROM _stg_srel;'));
  psql('DROP TABLE _stg_srel;');
  return n;
}

function loadOwl(file) {
  copyIntoStaging(file, '_stg_owl', ['id', 'effective_time', 'active', 'module_id', 'refset_id', 'concept_id', 'owl_expression']);
  psql(`
    INSERT INTO snomed_owl_axioms (id, effective_time, active, module_id, refset_id, concept_id, owl_expression, stated_parent_id)
    SELECT id, to_date(effective_time,'YYYYMMDD'), active='1', module_id, refset_id, concept_id, owl_expression,
      COALESCE(
        (regexp_match(owl_expression, 'SubClassOf\\(:\\d+\\s+:(\\d+)\\)'))[1],
        (regexp_match(owl_expression, 'SubClassOf\\(:\\d+\\s+ObjectIntersectionOf\\(:(\\d+)'))[1]
      )
    FROM _stg_owl
    ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active, owl_expression = EXCLUDED.owl_expression, stated_parent_id = EXCLUDED.stated_parent_id;
  `);
  const n = Number(psqlValue('SELECT count(*) FROM _stg_owl;'));
  psql('DROP TABLE _stg_owl;');
  return n;
}

async function main() {
  // Step 1: International Edition's stated relationships + OWL axioms, wiped
  // (stated rels, cascaded) or stale (OWL, from the Nov 2025 release) by the
  // real-API concept/description/relationship/map refresh that already ran.
  console.log('=== International Edition 2026-02-01: stated relationships + OWL axioms ===');
  const intDir = `${BASE}/clinical/SnomedCT_InternationalRF2_PRODUCTION_20260201T120000Z/Snapshot/Terminology`;
  psql('TRUNCATE snomed_owl_axioms;'); // stale Nov-2025 data; no FK, won't cascade-clear on its own
  const intSRel = loadStatedRelationships(`${intDir}/sct2_StatedRelationship_Snapshot_INT_20260201.txt`);
  const intOwl = loadOwl(`${intDir}/sct2_sRefset_OWLExpressionSnapshot_INT_20260201.txt`);
  console.log(`  stated relationships: ${intSRel}, OWL axioms: ${intOwl}`);

  // Step 2: UK modules, in dependency order (Edition -> Clinical -> Clinical
  // Refsets -> Drug), each a full Snapshot (complete current state, not a delta).
  const packages = [
    { label: 'UK Edition', dir: `${BASE}/drug/SnomedCT_UKEditionRF2_PRODUCTION_20260826T000001Z/Snapshot/Terminology`, infix: 'UKED', gb: '', date: '20260826' },
    { label: 'UK Clinical', dir: `${BASE}/clinical/SnomedCT_UKClinicalRF2_PRODUCTION_20260729T000001Z/Snapshot/Terminology`, infix: 'UKCL', gb: '1000000', date: '20260729' },
    { label: 'UK Clinical Refsets', dir: `${BASE}/clinical/SnomedCT_UKClinicalRefsetsRF2_PRODUCTION_20260729T000001Z/Snapshot/Terminology`, infix: 'UKCR', gb: '1000000', date: '20260729' },
    { label: 'UK Drug Extension', dir: `${BASE}/drug/SnomedCT_UKDrugRF2_PRODUCTION_20260826T000001Z/Snapshot/Terminology`, infix: 'UKDG', gb: '1000001', date: '20260826' },
  ];

  let grandConcepts = 0, grandDescriptions = 0, grandRelationships = 0, grandStated = 0, grandOwl = 0;

  for (const pkg of packages) {
    console.log(`\n=== ${pkg.label} (${pkg.date}) ===`);
    const f = (kind, hasLang = false) =>
      `${pkg.dir}/sct2_${kind}_${pkg.infix}Snapshot${hasLang ? '-en' : ''}_GB${pkg.gb}_${pkg.date}.txt`;

    const c = loadConcepts(f('Concept'));
    console.log(`  concepts: ${c}`);
    grandConcepts += c;

    const d = loadDescriptions(f('Description', true));
    console.log(`  descriptions: ${d}`);
    grandDescriptions += d;

    const r = loadRelationships(f('Relationship'));
    console.log(`  relationships: ${r.loaded}/${r.total} loaded`);
    grandRelationships += r.loaded;

    const sr = loadStatedRelationships(f('StatedRelationship'));
    console.log(`  stated relationships: ${sr}`);
    grandStated += sr;

    const owlFile = `${pkg.dir}/sct2_sRefset_OWLExpression${pkg.infix}Snapshot_GB${pkg.gb}_${pkg.date}.txt`;
    const o = loadOwl(owlFile);
    console.log(`  OWL axioms: ${o}`);
    grandOwl += o;
  }

  psql(`
    INSERT INTO terminology_releases (terminology, release_effective_time, source_file, row_count) VALUES
    ('snomed', '2026-02-01', 'SnomedCT_InternationalRF2_PRODUCTION_20260201T120000Z (refresh, bundled in UK Clinical Edition release)', ${529392}),
    ('snomed-uk-full', '2026-08-26', 'UK Clinical Edition (42.4.0, 2026-07-29) + UK Drug Extension (42.5.0, 2026-08-26) full Snapshot releases', ${grandConcepts});
  `);

  console.log(`\n=== TOTALS (UK modules) ===`);
  console.log(`concepts: ${grandConcepts}, descriptions: ${grandDescriptions}, relationships: ${grandRelationships}, stated relationships: ${grandStated}, OWL axioms: ${grandOwl}`);
  console.log(`International Edition stated relationships: ${intSRel}, OWL axioms: ${intOwl}`);
}

main().catch((err) => {
  console.error('UK SNOMED full-snapshot import failed:', err.message);
  process.exit(1);
});
