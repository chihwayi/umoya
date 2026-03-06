#!/usr/bin/env ts-node
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('baseUrl', {
    type: 'string',
    default: 'http://localhost:3013',
    describe: 'EHR service base URL',
  })
  .option('tenant', {
    type: 'string',
    demandOption: true,
    describe: 'Tenant slug for X-Tenant-ID',
  })
  .option('token', {
    type: 'string',
    demandOption: true,
    describe: 'Clinician JWT token',
  })
  .option('sessionId', {
    type: 'string',
    demandOption: true,
    describe: 'Existing post-visit session ID',
  })
  .option('version', {
    type: 'string',
    default: 'v1',
    describe: 'Requested mobile contract version',
  })
  .option('evidence', {
    type: 'string',
    describe: 'Optional path to save evidence JSON',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  baseUrl: string;
  tenant: string;
  token: string;
  sessionId: string;
  version: string;
  evidence?: string;
};

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const client = axios.create({
    baseURL: argv.baseUrl.replace(/\/+$/, ''),
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.token}`,
    },
    timeout: 30000,
  });

  const [fhirResponse, mobileContractResponse, mobileEventsResponse] = await Promise.all([
    client.get(`/post-visit/sessions/${argv.sessionId}/fhir`),
    client.get(`/post-visit/sessions/${argv.sessionId}/mobile-contract`, {
      params: { version: argv.version },
    }),
    client.get(`/post-visit/sessions/${argv.sessionId}/mobile-events`, {
      params: { version: argv.version, limit: 50, offset: 0 },
    }),
  ]);

  ensure(fhirResponse.data?.exportVersion === 'post-visit-fhir-r4.v1', 'FHIR export version mismatch');
  ensure(fhirResponse.data?.bundle?.resourceType === 'Bundle', 'FHIR response must include a Bundle');
  ensure(Array.isArray(fhirResponse.data?.bundle?.entry), 'FHIR bundle entries missing');

  ensure(mobileContractResponse.data?.contractVersion === 'post-visit-mobile.v1', 'Mobile contract version mismatch');
  ensure(Array.isArray(mobileContractResponse.data?.cards), 'Mobile contract cards array missing');
  ensure(Array.isArray(mobileContractResponse.data?.checklist), 'Mobile contract checklist array missing');
  ensure(
    mobileContractResponse.data?.eventsContract?.contractVersion === 'post-visit-mobile-events.v1',
    'Mobile events contract metadata missing',
  );

  ensure(mobileEventsResponse.data?.contractVersion === 'post-visit-mobile-events.v1', 'Mobile events version mismatch');
  ensure(Array.isArray(mobileEventsResponse.data?.events), 'Mobile events array missing');

  const evidence = {
    runAt: new Date().toISOString(),
    sessionId: argv.sessionId,
    fhir: {
      exportVersion: fhirResponse.data?.exportVersion,
      resourceCount: fhirResponse.data?.stats?.resourceCount || fhirResponse.data?.bundle?.entry?.length || 0,
      taskCount: fhirResponse.data?.stats?.recommendationTaskCount || 0,
    },
    mobileContract: {
      contractVersion: mobileContractResponse.data?.contractVersion,
      cards: mobileContractResponse.data?.cards?.map((card: { id?: string; status?: string }) => ({
        id: card.id || null,
        status: card.status || null,
      })),
      checklistCount: mobileContractResponse.data?.checklist?.length || 0,
    },
    mobileEvents: {
      contractVersion: mobileEventsResponse.data?.contractVersion,
      eventCount: mobileEventsResponse.data?.events?.length || 0,
      eventTypes: Array.from(
        new Set((mobileEventsResponse.data?.events || []).map((event: { eventType?: string }) => event.eventType || 'unknown')),
      ),
    },
  };

  if (argv.evidence) {
    const outputPath = path.resolve(process.cwd(), argv.evidence);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  console.log('[post-visit-fhir-mobile-contract-smoke] PASS');
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error('[post-visit-fhir-mobile-contract-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
