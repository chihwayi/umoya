#!/usr/bin/env ts-node
import axios from 'axios';
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
    describe: 'Post-visit session ID (may or may not have recording)',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  baseUrl: string;
  tenant: string;
  token: string;
  sessionId: string;
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
    timeout: 15000,
  });

  const res = await client.get(`/post-visit/sessions/${argv.sessionId}/recording-url`);
  ensure(res.status === 200, `Expected 200, got ${res.status}`);
  ensure(
    typeof res.data === 'object' && res.data !== null && 'url' in res.data,
    'Response must be object with url key',
  );
  if (res.data.url !== null) {
    ensure(typeof res.data.url === 'string', 'url must be string when present');
    ensure(typeof res.data.mimeType === 'string', 'mimeType must be string when url present');
  }

  console.log('[post-visit-audio-storage-smoke] PASS');
  console.log(
    res.data.url
      ? `Recording URL present (mimeType: ${res.data.mimeType}, durationMs: ${res.data.durationMs ?? 'n/a'})`
      : 'No recording (url: null)',
  );
}

run().catch((error) => {
  console.error('[post-visit-audio-storage-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
