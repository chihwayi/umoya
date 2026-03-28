#!/usr/bin/env node

/**
 * Idempotent DHIS2 metadata bootstrap for blank/local instances.
 *
 * Usage:
 *   DHIS2_URL=https://dhis2.example.org DHIS2_PAT=... node scripts/bootstrap-dhis2-metadata.mjs
 *   DHIS2_CLINIC_CODE=clinic_a DHIS2_CLINIC_NAME="Clinic A" node scripts/bootstrap-dhis2-metadata.mjs
 */

const baseUrl = (process.env.DHIS2_URL || '').replace(/\/$/, '');
const apiVersion = process.env.DHIS2_API_VERSION || '40';
const token = process.env.DHIS2_PAT || '';

if (!baseUrl) {
  console.error('Missing DHIS2_URL. Set DHIS2_URL in env before running bootstrap.');
  process.exit(1);
}

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
  const mergeOrgUnitIds = (collection, targetId) => {
    const ids = new Set([targetId]);
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (item?.id) {
          ids.add(item.id);
        }
      }
    }
    return Array.from(ids).map((id) => ({ id }));
  };

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
          organisationUnits: mergeOrgUnitIds(meDetails?.organisationUnits, orgUnitId),
          dataViewOrganisationUnits: mergeOrgUnitIds(meDetails?.dataViewOrganisationUnits, orgUnitId),
          teiSearchOrganisationUnits: mergeOrgUnitIds(meDetails?.teiSearchOrganisationUnits, orgUnitId),
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

  const aggregateProfiles = [
    {
      key: 'serviceDelivery',
      dataSetCode: 'MC_DS_SERVICE_DELIVERY_MONTHLY',
      dataSetName: 'MediCore Service Delivery Monthly',
      dataSetShortName: 'MC Service Monthly',
      metrics: [
        { code: 'MC_DE_TOTAL_CONSULTATIONS', name: 'Total Consultations' },
        { code: 'MC_DE_COMPLETED_CONSULTATIONS', name: 'Completed Consultations' },
        { code: 'MC_DE_TOTAL_ADMISSIONS', name: 'Total Admissions' },
        { code: 'MC_DE_TOTAL_DISCHARGES', name: 'Total Discharges' },
        { code: 'MC_DE_TOTAL_ED_VISITS', name: 'Total ED Visits' },
      ],
    },
    {
      key: 'maternalNewborn',
      dataSetCode: 'MC_DS_MATERNAL_NEWBORN_MONTHLY',
      dataSetName: 'MediCore Maternal Newborn Monthly',
      dataSetShortName: 'MC Maternal Monthly',
      metrics: [
        { code: 'MC_DE_MATERNAL_ANC1_PLUS', name: 'ANC 1+ Coverage Count' },
        { code: 'MC_DE_MATERNAL_ANC4_PLUS', name: 'ANC 4+ Coverage Count' },
        { code: 'MC_DE_MATERNAL_ANC8_PLUS', name: 'ANC 8+ Coverage Count' },
        { code: 'MC_DE_MATERNAL_TOTAL_DELIVERIES', name: 'Total Deliveries' },
        { code: 'MC_DE_MATERNAL_CSECTION_TOTAL', name: 'Caesarean Deliveries' },
        { code: 'MC_DE_MATERNAL_LIVE_BIRTHS', name: 'Live Births' },
        { code: 'MC_DE_MATERNAL_STILLBIRTHS', name: 'Stillbirths' },
        { code: 'MC_DE_MATERNAL_LOW_BIRTH_WEIGHT_COUNT', name: 'Low Birth Weight Count' },
      ],
    },
    {
      key: 'hivMonthly',
      dataSetCode: 'MC_DS_HIV_MONTHLY_RETURN',
      dataSetName: 'MediCore HIV Monthly Return',
      dataSetShortName: 'MC HIV Monthly',
      metrics: [
        { code: 'MC_DE_HIV_PLHIV_ACTIVE_IN_CARE', name: 'PLHIV Active In Care' },
        { code: 'MC_DE_HIV_ART_COVERAGE_COUNT', name: 'On ART Count' },
        { code: 'MC_DE_HIV_VL_SUPPRESSED_LT1000', name: 'Viral Load Suppressed <1000' },
        { code: 'MC_DE_HIV_VL_UNDETECTABLE_LT50', name: 'Viral Load Undetectable <50' },
        { code: 'MC_DE_HIV_LOST_TO_FOLLOWUP', name: 'Lost To Follow-Up Count' },
        { code: 'MC_DE_HIV_TREATMENT_FAILURE_GT1000', name: 'Treatment Failure >1000' },
        { code: 'MC_DE_HIV_TB_SCREENED', name: 'TB Screened Among PLHIV' },
      ],
    },
    {
      key: 'immunizationMonthly',
      dataSetCode: 'MC_DS_IMMUNIZATION_MONTHLY',
      dataSetName: 'MediCore Immunization Monthly',
      dataSetShortName: 'MC Immun Monthly',
      metrics: [
        { code: 'MC_DE_IMMUNIZATION_DTP1', name: 'DTP1 Administered Count' },
        { code: 'MC_DE_IMMUNIZATION_DTP3', name: 'DTP3 Administered Count' },
        { code: 'MC_DE_IMMUNIZATION_MCV1', name: 'Measles Dose 1 Count' },
        { code: 'MC_DE_IMMUNIZATION_FULLY_IMMUNIZED_PROXY', name: 'Fully Immunized Proxy Count' },
        { code: 'MC_DE_IMMUNIZATION_AEFI_REPORTS', name: 'AEFI Reports Count' },
      ],
    },
    {
      key: 'pharmacyStock',
      dataSetCode: 'MC_DS_PHARMACY_STOCK_MONTHLY',
      dataSetName: 'MediCore Pharmacy Stock Monthly',
      dataSetShortName: 'MC Pharmacy Monthly',
      metrics: [
        { code: 'MC_DE_PHARMACY_STOCK_ON_HAND_TOTAL', name: 'Stock On Hand Total' },
        { code: 'MC_DE_PHARMACY_STOCKOUT_ITEMS', name: 'Stockout Item Count' },
        { code: 'MC_DE_PHARMACY_DISPENSED_UNITS', name: 'Dispensed Units' },
        { code: 'MC_DE_PHARMACY_DISPENSING_TRANSACTIONS', name: 'Dispensing Transactions' },
      ],
    },
  ];

  const aggregateDataElementIds = {};
  for (const profile of aggregateProfiles) {
    for (const metric of profile.metrics) {
      if (aggregateDataElementIds[metric.code]) {
        continue;
      }

      const entry = await ensureResource({
        resource: 'dataElements',
        listField: 'dataElements',
        code: metric.code,
        payload: {
          name: metric.name,
          shortName: metric.name.slice(0, 50),
          code: metric.code,
          valueType: 'INTEGER',
          domainType: 'AGGREGATE',
          aggregationType: 'SUM',
          zeroIsSignificant: false,
        },
      });
      aggregateDataElementIds[metric.code] = entry.id;
    }
  }

  const dataSetIds = {};
  for (const profile of aggregateProfiles) {
    const existingDataSet = await findByCode('dataSets', profile.dataSetCode, 'dataSets');
    let profileDataSetId;

    if (existingDataSet?.id) {
      profileDataSetId = existingDataSet.id;
    } else {
      const createdDataSet = await request('/dataSets', {
        method: 'POST',
        body: JSON.stringify({
          name: profile.dataSetName,
          shortName: profile.dataSetShortName,
          code: profile.dataSetCode,
          periodType: 'Monthly',
          formType: 'DEFAULT',
          dataSetElements: profile.metrics.map((metric) => ({ dataElement: { id: aggregateDataElementIds[metric.code] } })),
          organisationUnits: [{ id: orgUnit.id }],
        }),
      });

      profileDataSetId = uidFromCreateResponse(createdDataSet);
      if (!profileDataSetId) {
        const retry = await findByCode('dataSets', profile.dataSetCode, 'dataSets');
        if (!retry?.id) {
          throw new Error(`Failed to resolve dataSet ID after creation for ${profile.dataSetCode}.`);
        }
        profileDataSetId = retry.id;
      }
    }

    dataSetIds[profile.key] = profileDataSetId;
  }

  const dataSetId = dataSetIds.serviceDelivery;

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
    dataSetIds,
    aggregateDataElementIds,
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
