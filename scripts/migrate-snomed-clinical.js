#!/usr/bin/env node
/**
 * Bulk migration helper for SNOMED-coded problems and allergies.
 *
 * Usage:
 *   BASE_URL=http://localhost:3013 \
 *   TENANT_SLUG=bulawayo-general \
 *   EHR_EMAIL=doctor@bulawayo-general.co.zw \
 *   EHR_PASSWORD=Password1# \
 *   node scripts/migrate-snomed-clinical.js
 *
 * Optional env:
 *   PAGE_SIZE (default 50)
 *   DRY_RUN=true   -> only report, no writes
 */

'use strict';

const axios = require('axios').default;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3013';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const EMAIL = process.env.EHR_EMAIL || 'doctor@bulawayo-general.co.zw';
const PASSWORD = process.env.EHR_PASSWORD || 'Password1#';
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '50', 10);
const DRY_RUN = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';

if (!TENANT_SLUG) {
  console.error('❌ TENANT_SLUG is required.');
  process.exit(1);
}

let token = '';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    'X-Tenant-ID': TENANT_SLUG,
  },
});

async function login() {
  const { data } = await api.post('/auth/login', { email: EMAIL, password: PASSWORD }, { headers: {} });
  token = data.token;
  api.defaults.headers['Authorization'] = `Bearer ${token}`;
  console.log(`🔐 Authenticated as ${EMAIL} for tenant ${TENANT_SLUG}`);
}

async function fetchPatients(page) {
  const { data } = await api.get('/patients', { params: { page, limit: PAGE_SIZE } });
  return data?.data || [];
}

async function fetchProblems(patientId) {
  const { data } = await api.get(`/problems/patient/${patientId}`);
  return Array.isArray(data) ? data : [];
}

async function fetchAllergies(patientId) {
  const { data } = await api.get(`/allergies/patient/${patientId}`);
  return Array.isArray(data) ? data : [];
}

async function searchConcept(term) {
  if (!term || term.trim().length < 2) {
    return null;
  }

  try {
    const { data } = await api.get('/terminology/snomed/search', {
      params: {
        term: term.trim(),
        limit: 10,
        activeOnly: true,
      },
    });
    const concepts = data?.concepts || [];
    return concepts.find((c) => c.active) || concepts[0] || null;
  } catch (err) {
    console.warn(`  ⚠️  SNOMED search failed for "${term}": ${err?.response?.data?.message || err.message}`);
    return null;
  }
}

function buildProblemPayload(problem, resolvedConcept) {
  const conceptId =
    resolvedConcept?.conceptId ||
    problem.snomedConceptId ||
    (problem.code && /^\d+$/.test(String(problem.code)) ? problem.code : null);

  const term =
    resolvedConcept?.preferredTerm ||
    resolvedConcept?.term ||
    problem.snomedTerm ||
    problem.description ||
    problem.problemName ||
    '';

  if (!term) {
    return null;
  }

  return {
    conceptId: conceptId || undefined,
    term,
    status: problem.status || 'active',
    onsetDate: problem.onsetDate || null,
    resolvedDate: problem.resolvedDate || null,
    notes: problem.notes || null,
  };
}

function buildAllergyPayload(allergy, resolvedAllergen, resolvedReaction) {
  const allergenConceptId =
    resolvedAllergen?.conceptId ||
    allergy.allergenSnomedCode ||
    (allergy.allergen && /^\d+$/.test(allergy.allergen) ? allergy.allergen : null);

  const allergenTerm =
    resolvedAllergen?.preferredTerm ||
    resolvedAllergen?.term ||
    allergy.allergenSnomedTerm ||
    allergy.allergen ||
    '';

  if (!allergenTerm) {
    return null;
  }

  return {
    allergenSnomedConceptId: allergenConceptId || undefined,
    allergenTerm,
    reactionSnomedConceptId: resolvedReaction?.conceptId || allergy.reactionSnomedCode || undefined,
    reactionTerm: resolvedReaction?.preferredTerm || resolvedReaction?.term || allergy.reactionSnomedTerm || allergy.reaction || undefined,
    severity: allergy.severity || 'mild',
  };
}

async function migratePatient(patient) {
  const patientId = patient.id;
  console.log(`\n👤 Migrating patient ${patientId} (${patient.firstName || ''} ${patient.lastName || ''})`);

  const problems = await fetchProblems(patientId);
  const allergies = await fetchAllergies(patientId);

  const unmappedProblems = problems.filter((p) => !p.snomedConceptId && !(p.code && /^\d+$/.test(p.code)));
  const unmappedAllergies = allergies.filter((a) => !a.allergenSnomedCode);

  let updatedProblems = [];
  if (problems.length) {
    console.log(`  • Problems: ${problems.length} (${unmappedProblems.length} without SNOMED)`);
    for (const problem of problems) {
      let mappedConcept = null;
      if (!problem.snomedConceptId) {
        mappedConcept = await searchConcept(problem.description || problem.problemName || problem.code || '');
        if (mappedConcept) {
          console.log(`    ↳ ${problem.description || problem.problemName} → ${mappedConcept.conceptId} (${mappedConcept.term})`);
        } else if (!problem.code || !/^\d+$/.test(String(problem.code))) {
          console.log(`    ⚠️  Unable to map "${problem.description || problem.problemName || 'Unknown'}" to SNOMED`);
        }
      }
      const payload = buildProblemPayload(problem, mappedConcept);
      if (payload) {
        updatedProblems.push(payload);
      }
    }

    if (updatedProblems.length && !DRY_RUN) {
      await api.put(
        `/problems/patient/${patientId}`,
        { problems: updatedProblems },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }

  let updatedAllergies = [];
  if (allergies.length) {
    console.log(`  • Allergies: ${allergies.length} (${unmappedAllergies.length} without SNOMED)`);
    for (const allergy of allergies) {
      let allergenConcept = null;
      let reactionConcept = null;

      if (!allergy.allergenSnomedCode) {
        allergenConcept = await searchConcept(allergy.allergen || '');
        if (allergenConcept) {
          console.log(`    ↳ Allergen ${allergy.allergen} → ${allergenConcept.conceptId} (${allergenConcept.term})`);
        } else {
          console.log(`    ⚠️  Unable to map allergen "${allergy.allergen}" to SNOMED`);
        }
      }

      if (!allergy.reactionSnomedCode && allergy.reaction) {
        reactionConcept = await searchConcept(allergy.reaction);
        if (reactionConcept) {
          console.log(`      ↳ Reaction ${allergy.reaction} → ${reactionConcept.conceptId} (${reactionConcept.term})`);
        }
      }

      const payload = buildAllergyPayload(allergy, allergenConcept, reactionConcept);
      if (payload) {
        updatedAllergies.push(payload);
      }
    }

    if (updatedAllergies.length && !DRY_RUN) {
      await api.put(
        `/allergies/patient/${patientId}`,
        { allergies: updatedAllergies },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }

  if (DRY_RUN) {
    console.log('  🔎 DRY_RUN is enabled – no data was written.');
  } else if (!updatedProblems.length && !updatedAllergies.length) {
    console.log('  ℹ️  No updates were required.');
  } else {
    console.log('  ✅ Migration batch applied.');
  }
}

async function main() {
  try {
    await login();
    let page = 1;
    let processed = 0;

    while (true) {
      const patients = await fetchPatients(page);
      if (!patients.length) break;

      for (const patient of patients) {
        await migratePatient(patient);
        processed += 1;
      }

      if (patients.length < PAGE_SIZE) break;
      page += 1;
    }

    console.log(`\n🎉 Migration complete. Processed ${processed} patient(s).`);
    if (DRY_RUN) {
      console.log('   (dry run mode – rerun without DRY_RUN to persist changes)');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err?.response?.data || err.message);
    process.exit(1);
  }
}

main();

