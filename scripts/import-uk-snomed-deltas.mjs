#!/usr/bin/env node
/*
  Loads the UK SNOMED CT Drug Extension + Clinical/Edition Extension DELTA
  releases (v42.4.0 2026-07-29, v42.5.0 2026-08-26) into the SAME
  snomed_concepts/descriptions/relationships/owl_axioms tables the
  International Edition uses — UK national extensions coexist with the
  International Edition in one logical "edition" via module_id, which is
  exactly how real SNOMED implementations combine them.

  IMPORTANT — this is explicitly a PARTIAL load: these are Delta files (only
  what changed in each release month), not a Snapshot. There is no prior UK
  extension base loaded, so the UK drug hierarchy (VTM/VMP/AMP) and UK
  clinical parent concepts these deltas' relationships point to are largely
  NOT present — only concepts that happened to change in these two months
  are loaded, each still upserted correctly, but many will be "islands"
  disconnected from a fuller UK hierarchy until a full UK Clinical + Drug
  Extension Snapshot/Full release is obtained and loaded. Relationships
  whose source or destination concept isn't present in snomed_concepts are
  skipped (not inserted with a dangling FK), consistent with how the
  International Edition's stated-relationship load was handled.

  Applies both delta versions in chronological order (42.4.0 then 42.5.0)
  so later modifications correctly win via ON CONFLICT DO UPDATE.
*/
import { execSync } from 'node:child_process';

const BASE = '/tmp/uk_drug_extracted';
const RELEASES = [
  { version: '42.4.0', date: '20260729', dir: 'v42.4.0' },
  { version: '42.5.0', date: '20260826', dir: 'v42.5.0' },
];
const PACKAGES = [
  { name: 'UKEDDelta', pkgPrefix: 'SnomedCT_UKEditionRF2_PRODUCTION', label: 'UK Clinical/Edition Extension' },
  { name: 'UKDGDelta', pkgPrefix: 'SnomedCT_UKDrugRF2_PRODUCTION', label: 'UK Drug Extension' },
];

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

async function main() {
  let totalConcepts = 0, totalDescriptions = 0, totalRelationships = 0, totalOwl = 0;

  for (const release of RELEASES) {
    for (const pkg of PACKAGES) {
      const pkgDir = `${BASE}/${release.dir}/${pkg.pkgPrefix}_${release.date}T000001Z/Delta/Terminology`;
      console.log(`\n=== ${pkg.label} ${release.version} (${release.date}) ===`);

      // Concepts
      const conceptFile = `${pkgDir}/sct2_Concept_${pkg.name}_GB${pkg.name === 'UKDGDelta' ? '1000001' : ''}_${release.date}.txt`;
      copyIntoStaging(conceptFile, '_stg_uk_concept', ['id', 'effective_time', 'active', 'module_id', 'definition_status_id']);
      psql(`
        INSERT INTO snomed_concepts (concept_id, effective_time, active, module_id, definition_status_id)
        SELECT id, to_date(effective_time,'YYYYMMDD'), active='1', module_id, definition_status_id FROM _stg_uk_concept
        ON CONFLICT (concept_id) DO UPDATE SET
          effective_time = EXCLUDED.effective_time, active = EXCLUDED.active,
          module_id = EXCLUDED.module_id, definition_status_id = EXCLUDED.definition_status_id
          WHERE EXCLUDED.effective_time >= snomed_concepts.effective_time;
      `);
      const cCount = Number(psqlValue('SELECT count(*) FROM _stg_uk_concept;'));
      totalConcepts += cCount;
      console.log(`  concepts: ${cCount}`);

      // Descriptions
      const descFile = `${pkgDir}/sct2_Description_${pkg.name}-en_GB${pkg.name === 'UKDGDelta' ? '1000001' : ''}_${release.date}.txt`;
      copyIntoStaging(descFile, '_stg_uk_desc', ['id', 'effective_time', 'active', 'module_id', 'concept_id', 'language_code', 'type_id', 'term', 'case_significance_id']);
      psql(`
        INSERT INTO snomed_descriptions (description_id, effective_time, active, module_id, concept_id, language_code, type_id, term, case_significance_id)
        SELECT s.id, to_date(s.effective_time,'YYYYMMDD'), s.active='1', s.module_id, s.concept_id, s.language_code, s.type_id, s.term, s.case_significance_id
        FROM _stg_uk_desc s WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.concept_id)
        ON CONFLICT (description_id) DO UPDATE SET
          effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, term = EXCLUDED.term
          WHERE EXCLUDED.effective_time >= snomed_descriptions.effective_time;
      `);
      const dCount = Number(psqlValue('SELECT count(*) FROM _stg_uk_desc;'));
      totalDescriptions += dCount;
      console.log(`  descriptions: ${dCount}`);

      // Inferred relationships
      const relFile = `${pkgDir}/sct2_Relationship_${pkg.name}_GB${pkg.name === 'UKDGDelta' ? '1000001' : ''}_${release.date}.txt`;
      copyIntoStaging(relFile, '_stg_uk_rel', ['id', 'effective_time', 'active', 'module_id', 'source_id', 'destination_id', 'relationship_group', 'type_id', 'characteristic_type_id', 'modifier_id']);
      psql(`
        INSERT INTO snomed_relationships (relationship_id, effective_time, active, module_id, source_id, destination_id, relationship_group, type_id, characteristic_type_id, modifier_id)
        SELECT s.id, to_date(s.effective_time,'YYYYMMDD'), s.active='1', s.module_id, s.source_id, s.destination_id, s.relationship_group::int, s.type_id, s.characteristic_type_id, s.modifier_id
        FROM _stg_uk_rel s
        WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.source_id)
          AND EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.destination_id)
        ON CONFLICT (relationship_id) DO UPDATE SET
          effective_time = EXCLUDED.effective_time, active = EXCLUDED.active
          WHERE EXCLUDED.effective_time >= snomed_relationships.effective_time;
      `);
      const rCount = Number(psqlValue('SELECT count(*) FROM _stg_uk_rel;'));
      const rLoaded = Number(psqlValue(`
        SELECT count(*) FROM _stg_uk_rel s
        WHERE EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.source_id)
          AND EXISTS (SELECT 1 FROM snomed_concepts c WHERE c.concept_id = s.destination_id);
      `));
      totalRelationships += rLoaded;
      console.log(`  relationships: ${rLoaded}/${rCount} loaded (rest reference concepts outside this partial load — expected, see script header)`);

      // OWL axioms (best-effort; UKDG in these releases has none)
      const owlFile = `${pkgDir}/sct2_sRefset_OWLExpression${pkg.name}_GB${pkg.name === 'UKDGDelta' ? '1000001' : ''}_${release.date}.txt`;
      try {
        copyIntoStaging(owlFile, '_stg_uk_owl', ['id', 'effective_time', 'active', 'module_id', 'refset_id', 'concept_id', 'owl_expression']);
        const owlCount = Number(psqlValue('SELECT count(*) FROM _stg_uk_owl;'));
        if (owlCount > 0) {
          psql(`
            INSERT INTO snomed_owl_axioms (id, effective_time, active, module_id, refset_id, concept_id, owl_expression, stated_parent_id)
            SELECT id, to_date(effective_time,'YYYYMMDD'), active='1', module_id, refset_id, concept_id, owl_expression,
              COALESCE(
                (regexp_match(owl_expression, 'SubClassOf\\(:\\d+\\s+:(\\d+)\\)'))[1],
                (regexp_match(owl_expression, 'SubClassOf\\(:\\d+\\s+ObjectIntersectionOf\\(:(\\d+)'))[1]
              )
            FROM _stg_uk_owl
            ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active, owl_expression = EXCLUDED.owl_expression;
          `);
          totalOwl += owlCount;
        }
        console.log(`  OWL axioms: ${owlCount}`);
      } catch (e) {
        console.log(`  OWL axioms: none in this delta`);
      }

      psql('DROP TABLE IF EXISTS _stg_uk_concept, _stg_uk_desc, _stg_uk_rel, _stg_uk_owl;');
    }
  }

  psql(`
    INSERT INTO terminology_releases (terminology, release_effective_time, source_file, row_count) VALUES
    ('snomed-uk-delta', '2026-08-26', 'uk_sct2drdelta_42.4.0+42.5.0 (UK Clinical + Drug Extension deltas, partial load)', ${totalConcepts});
  `);

  console.log(`\nTotals across both releases: ${totalConcepts} concepts, ${totalDescriptions} descriptions, ${totalRelationships} relationships loaded, ${totalOwl} OWL axioms.`);
  console.log('NOTE: this is a partial delta-only load — see script header. A full UK Clinical + Drug Extension Snapshot is needed for a complete, fully-connected UK hierarchy.');
}

main().catch((err) => {
  console.error('UK SNOMED delta import failed:', err.message);
  process.exit(1);
});
