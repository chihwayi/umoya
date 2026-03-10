#!/usr/bin/env node

/**
 * Idempotent DHIS2 metadata bootstrap for blank/local instances.
 *
 * Usage:
 *   DHIS2_URL=http://localhost:8888 DHIS2_PAT=... node scripts/bootstrap-dhis2-metadata.mjs
 *   DHIS2_CLINIC_CODE=clinic_a DHIS2_CLINIC_NAME="Clinic A" node scripts/bootstrap-dhis2-metadata.mjs
 */

const baseUrl = (process.env.DHIS2_URL || 'http://localhost:8888').replace(/\/$/, '');
const apiVersion = process.env.DHIS2_API_VERSION || '40';
const token = process.env.DHIS2_PAT || '';

if (!token) {
  console.error('Missing DHIS2_PAT. Set DHIS2_PAT in env before running bootstrap.');
  process.exit(1);
}

const clinicCode = process.env.DHIS2_CLINIC_CODE || 'medicore_clinic_default';
const clinicName = process.env.DHIS2_CLINIC_NAME || 'MediCore Clinic';

const endpoint = `${baseUrl}/api/${apiVersion}`;

const request = async (path, init = {}) => {
  const res = await fetch(`${endpoint}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ApiToken ${token}`,
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  const body = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;

  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} failed: ${res.status} ${res.statusText} :: ${JSON.stringify(body)}`);
  }

  return body;
};

const uidFromCreateResponse = (resp) => (
  resp?.response?.uid ||
  resp?.response?.importSummaries?.[0]?.reference ||
  resp?.importSummaries?.[0]?.reference ||
  null
);

const findByCode = async (resource, code, listField) => {
  const query = `/${resource}?paging=false&fields=id,name,code&filter=code:eq:${encodeURIComponent(code)}`;
  const payload = await request(query);
  const items = payload?.[listField] || [];
  return items.length > 0 ? items[0] : null;
};

const ensureResource = async ({ resource, listField, code, payload }) => {
  const existing = await findByCode(resource, code, listField);
  if (existing?.id) {
    return { id: existing.id, created: false };
  }

  const created = await request(`/${resource}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const createdId = uidFromCreateResponse(created);
  if (!createdId) {
    const retry = await findByCode(resource, code, listField);
    if (!retry?.id) {
      throw new Error(`Created ${resource} for code=${code} but failed to resolve ID from response.`);
    }
    return { id: retry.id, created: true };
  }

  return { id: createdId, created: true };
};

const ensureCurrentUserOrgUnitAccess = async (meId, orgUnitId) => {
  const meDetails = await request(`/me?fields=id,username,organisationUnits[id],dataViewOrganisationUnits[id],teiSearchOrganisationUnits[id]`);
  const hasOrgUnitAccess = (collection) => Array.isArray(collection) && collection.some((item) => item?.id === orgUnitId);

  if (
    hasOrgUnitAccess(meDetails?.organisationUnits) &&
    hasOrgUnitAccess(meDetails?.dataViewOrganisationUnits) &&
    hasOrgUnitAccess(meDetails?.teiSearchOrganisationUnits)
  ) {
    return { updated: false };
  }

  const userForUpdate = await request(`/users/${meId}?fields=id,username,userRoles[id],userGroups[id]`);
  await request('/metadata?importStrategy=UPDATE&mergeMode=MERGE', {
    method: 'POST',
    body: JSON.stringify({
      users: [
        {
          id: userForUpdate.id,
          username: userForUpdate.username,
          userRoles: userForUpdate.userRoles || [],
          userGroups: userForUpdate.userGroups || [],
          organisationUnits: [{ id: orgUnitId }],
          dataViewOrganisationUnits: [{ id: orgUnitId }],
          teiSearchOrganisationUnits: [{ id: orgUnitId }],
        },
      ],
    }),
  });

  return { updated: true };
};

const run = async () => {
  const me = await request('/me?fields=id,username,name');
  console.log(`Authenticated to DHIS2 as ${me?.username || 'unknown'} (${me?.id || 'n/a'})`);

  const openingDate = new Date().toISOString().split('T')[0];

  const orgUnit = await ensureResource({
    resource: 'organisationUnits',
    listField: 'organisationUnits',
    code: clinicCode,
    payload: {
      name: clinicName,
      shortName: clinicName.slice(0, 50),
      code: clinicCode,
      openingDate,
    },
  });

  const tet = await ensureResource({
    resource: 'trackedEntityTypes',
    listField: 'trackedEntityTypes',
    code: 'MC_TET_PATIENT',
    payload: {
      name: 'MediCore Patient',
      shortName: 'MC Patient',
      code: 'MC_TET_PATIENT',
      description: 'Tracked entity type for MediCore patient sync',
    },
  });

  const userOrgAccess = await ensureCurrentUserOrgUnitAccess(me.id, orgUnit.id);

  const attributesSpec = [
    { code: 'MC_ATTR_PATIENT_NUMBER', name: 'Patient Number', valueType: 'TEXT', unique: true },
    { code: 'MC_ATTR_FIRST_NAME', name: 'First Name', valueType: 'TEXT', unique: false },
    { code: 'MC_ATTR_LAST_NAME', name: 'Last Name', valueType: 'TEXT', unique: false },
    { code: 'MC_ATTR_DOB', name: 'Date of Birth', valueType: 'DATE', unique: false },
    { code: 'MC_ATTR_GENDER', name: 'Gender', valueType: 'TEXT', unique: false },
    { code: 'MC_ATTR_NATIONAL_ID', name: 'National ID', valueType: 'TEXT', unique: false },
    { code: 'MC_ATTR_PHONE', name: 'Phone', valueType: 'PHONE_NUMBER', unique: false },
  ];

  const attributes = {};
  for (const attr of attributesSpec) {
    const entry = await ensureResource({
      resource: 'trackedEntityAttributes',
      listField: 'trackedEntityAttributes',
      code: attr.code,
      payload: {
        name: attr.name,
        shortName: attr.name.slice(0, 50),
        code: attr.code,
        valueType: attr.valueType,
        aggregationType: 'NONE',
        unique: attr.unique,
        displayInList: true,
      },
    });
    attributes[attr.code] = entry.id;
  }

  const dataElementSpecs = [
    { code: 'MC_DE_TOTAL_CONSULTATIONS', name: 'Total Consultations' },
    { code: 'MC_DE_COMPLETED_CONSULTATIONS', name: 'Completed Consultations' },
    { code: 'MC_DE_TOTAL_ADMISSIONS', name: 'Total Admissions' },
    { code: 'MC_DE_TOTAL_DISCHARGES', name: 'Total Discharges' },
    { code: 'MC_DE_TOTAL_ED_VISITS', name: 'Total ED Visits' },
  ];

  const dataElements = [];
  for (const de of dataElementSpecs) {
    const entry = await ensureResource({
      resource: 'dataElements',
      listField: 'dataElements',
      code: de.code,
      payload: {
        name: de.name,
        shortName: de.name.slice(0, 50),
        code: de.code,
        valueType: 'INTEGER',
        domainType: 'AGGREGATE',
        aggregationType: 'SUM',
        zeroIsSignificant: false,
      },
    });
    dataElements.push(entry.id);
  }

  const dataSetCode = 'MC_DS_SERVICE_DELIVERY_MONTHLY';
  const existingDataSet = await findByCode('dataSets', dataSetCode, 'dataSets');

  let dataSetId;
  if (existingDataSet?.id) {
    dataSetId = existingDataSet.id;
  } else {
    const createdDataSet = await request('/dataSets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'MediCore Service Delivery Monthly',
        shortName: 'MC Service Monthly',
        code: dataSetCode,
        periodType: 'Monthly',
        formType: 'DEFAULT',
        dataSetElements: dataElements.map((id) => ({ dataElement: { id } })),
        organisationUnits: [{ id: orgUnit.id }],
      }),
    });

    dataSetId = uidFromCreateResponse(createdDataSet);
    if (!dataSetId) {
      const retry = await findByCode('dataSets', dataSetCode, 'dataSets');
      if (!retry?.id) {
        throw new Error('Failed to resolve dataSet ID after creation.');
      }
      dataSetId = retry.id;
    }
  }

  const trackerEventDataElementSpecs = [
    { code: 'MC_DE_EVENT_VISIT_TYPE', name: 'Visit Type', valueType: 'TEXT' },
    { code: 'MC_DE_EVENT_PRIMARY_DIAGNOSIS', name: 'Primary Diagnosis', valueType: 'TEXT' },
    { code: 'MC_DE_EVENT_CLINICAL_NOTES', name: 'Clinical Notes', valueType: 'LONG_TEXT' },
  ];

  const trackerEventDataElementIds = {};
  for (const de of trackerEventDataElementSpecs) {
    const entry = await ensureResource({
      resource: 'dataElements',
      listField: 'dataElements',
      code: de.code,
      payload: {
        name: de.name,
        shortName: de.name.slice(0, 50),
        code: de.code,
        valueType: de.valueType,
        domainType: 'TRACKER',
        aggregationType: 'NONE',
        zeroIsSignificant: false,
      },
    });
    trackerEventDataElementIds[de.code] = entry.id;
  }

  const program = await ensureResource({
    resource: 'programs',
    listField: 'programs',
    code: 'MC_PRG_CLINIC_VISIT',
    payload: {
      name: 'MediCore Clinic Visit Program',
      shortName: 'MC Clinic Visit',
      code: 'MC_PRG_CLINIC_VISIT',
      programType: 'WITH_REGISTRATION',
      trackedEntityType: { id: tet.id },
      organisationUnits: [{ id: orgUnit.id }],
    },
  });

  const programStage = await ensureResource({
    resource: 'programStages',
    listField: 'programStages',
    code: 'MC_PST_CLINIC_VISIT',
    payload: {
      name: 'Clinic Visit Stage',
      shortName: 'Clinic Visit',
      code: 'MC_PST_CLINIC_VISIT',
      program: { id: program.id },
      repeatable: true,
      executionDateLabel: 'Visit Date',
      programStageDataElements: Object.values(trackerEventDataElementIds).map((id, index) => ({
        dataElement: { id },
        compulsory: false,
        displayInReports: true,
        sortOrder: index + 1,
      })),
    },
  });

  const summary = {
    dhis2Url: baseUrl,
    apiVersion,
    clinicCode,
    clinicName,
    orgUnitId: orgUnit.id,
    trackedEntityTypeId: tet.id,
    dataSetId,
    programId: program.id,
    programStageId: programStage.id,
    attributeIds: attributes,
    eventDataElementIds: trackerEventDataElementIds,
    userOrgAccessUpdated: userOrgAccess.updated,
    createdAt: new Date().toISOString(),
  };

  const outputPath = process.env.DHIS2_BOOTSTRAP_OUTPUT || '/tmp/dhis2-bootstrap-output.json';
  await import('node:fs/promises').then((fs) => fs.writeFile(outputPath, JSON.stringify(summary, null, 2)));

  console.log('DHIS2 bootstrap completed.');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved output to ${outputPath}`);
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
