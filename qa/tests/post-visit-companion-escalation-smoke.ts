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
  .option('patientToken', {
    type: 'string',
    demandOption: true,
    describe: 'Patient portal JWT token',
  })
  .option('clinicianToken', {
    type: 'string',
    demandOption: true,
    describe: 'Clinician JWT token (doctor/nurse/admin)',
  })
  .option('sessionId', {
    type: 'string',
    demandOption: true,
    describe: 'Published post-visit session ID',
  })
  .option('message', {
    type: 'string',
    default: 'I have chest pain and trouble breathing',
    describe: 'Companion message text used to trigger escalation',
  })
  .option('resolve', {
    type: 'boolean',
    default: false,
    describe: 'Resolve escalation after validating queue visibility',
  })
  .option('evidence', {
    type: 'string',
    describe: 'Optional path to save evidence JSON',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  baseUrl: string;
  tenant: string;
  patientToken: string;
  clinicianToken: string;
  sessionId: string;
  message: string;
  resolve: boolean;
  evidence?: string;
};

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const baseURL = argv.baseUrl.replace(/\/+$/, '');
  const patientClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.patientToken}`,
    },
  });

  const clinicianClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.clinicianToken}`,
    },
  });

  const [summaryResponse, messageListResponse] = await Promise.all([
    patientClient.get(`/patient-portal/post-visit/sessions/${argv.sessionId}/summary`),
    patientClient.get(`/patient-portal/post-visit/sessions/${argv.sessionId}/messages`, {
      params: { limit: 20, offset: 0 },
    }),
  ]);

  ensure(summaryResponse.data?.summary, 'Published summary is missing in patient portal response');
  ensure(Array.isArray(messageListResponse.data?.messages), 'Messages endpoint must return a messages array');

  const messageResponse = await patientClient.post(`/patient-portal/post-visit/sessions/${argv.sessionId}/messages`, {
    message: argv.message,
    messageType: 'question',
  });

  ensure(messageResponse.data?.patientMessage?.id, 'Patient message ID missing from companion response');
  ensure(messageResponse.data?.assistantMessage?.id, 'Assistant message ID missing from companion response');
  ensure(messageResponse.data?.escalation?.id, 'Expected escalation event for high-risk message');

  const escalationId = String(messageResponse.data.escalation.id);

  const escalationListResponse = await clinicianClient.get('/post-visit/escalations', {
    params: {
      sessionId: argv.sessionId,
      status: 'open',
      limit: 50,
      offset: 0,
    },
  });
  const escalations = Array.isArray(escalationListResponse.data?.escalations) ? escalationListResponse.data.escalations : [];
  const queueEscalation = escalations.find((item: { id?: string }) => String(item.id || '') === escalationId);
  ensure(queueEscalation, 'Escalation was not found in clinician escalation queue');

  let resolvedStatus: string | null = null;
  if (argv.resolve) {
    const resolveResponse = await clinicianClient.post(`/post-visit/escalations/${escalationId}/resolve`, {
      status: 'resolved',
      resolutionNote: 'QA smoke resolution',
    });
    resolvedStatus = resolveResponse.data?.status || resolveResponse.data?.escalation?.status || null;
    if (String(resolvedStatus || '').toLowerCase() !== 'resolved') {
      const resolvedListResponse = await clinicianClient.get('/post-visit/escalations', {
        params: {
          sessionId: argv.sessionId,
          status: 'resolved',
          limit: 50,
          offset: 0,
        },
      });
      const resolvedEscalations = Array.isArray(resolvedListResponse.data?.escalations)
        ? resolvedListResponse.data.escalations
        : [];
      const isResolved = resolvedEscalations.some((item: { id?: string }) => String(item.id || '') === escalationId);
      ensure(isResolved, 'Escalation was not found in resolved queue after resolve request');
      resolvedStatus = 'resolved';
    }
  }

  const evidence = {
    runAt: new Date().toISOString(),
    sessionId: argv.sessionId,
    escalationId,
    escalationSeverity: messageResponse.data?.escalation?.severity || null,
    escalationRoute: messageResponse.data?.escalation?.routeTarget || null,
    queueMatch: true,
    resolvedStatus,
    channelDelivery: messageResponse.data?.escalation?.metadata?.channel_delivery || null,
  };

  if (argv.evidence) {
    const outputPath = path.resolve(process.cwd(), argv.evidence);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  console.log('[post-visit-companion-escalation-smoke] PASS');
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error('[post-visit-companion-escalation-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
