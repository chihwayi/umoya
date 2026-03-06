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

  const [sessionResponse, draftResponse] = await Promise.all([
    client.get(`/post-visit/sessions/${argv.sessionId}`),
    client.get(`/post-visit/sessions/${argv.sessionId}/draft`),
  ]);

  ensure(sessionResponse.data?.id === argv.sessionId, 'Session endpoint did not return expected session ID');
  ensure(Array.isArray(draftResponse.data?.artifacts), 'Draft response must include artifacts array');

  const evidence = {
    runAt: new Date().toISOString(),
    sessionId: argv.sessionId,
    sessionStatus: sessionResponse.data?.status || null,
    artifactCount: draftResponse.data?.artifacts?.length || 0,
    artifactTypes: (draftResponse.data?.artifacts || []).map((artifact: { artifactType?: string }) => artifact.artifactType || 'unknown'),
  };

  if (argv.evidence) {
    const outputPath = path.resolve(process.cwd(), argv.evidence);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  console.log('[post-visit-session-smoke] PASS');
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error('[post-visit-session-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
