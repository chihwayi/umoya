#!/usr/bin/env ts-node
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type DraftArtifact = {
  id?: string;
  type?: string;
  artifactType?: string;
  content?: {
    items?: Array<{ id?: string; recommendation_id?: string }>;
  };
};

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
  .option('clinicianToken', {
    type: 'string',
    demandOption: true,
    describe: 'Clinician JWT token',
  })
  .option('patientToken', {
    type: 'string',
    demandOption: true,
    describe: 'Patient JWT token',
  })
  .option('sessionId', {
    type: 'string',
    demandOption: true,
    describe: 'Post-visit session ID',
  })
  .option('publish', {
    type: 'boolean',
    default: true,
    describe: 'Attempt publish when session is not already published',
  })
  .option('execute', {
    type: 'boolean',
    default: true,
    describe: 'Execute the first recommendation action',
  })
  .option('resolve', {
    type: 'boolean',
    default: true,
    describe: 'Resolve generated escalation in clinician queue',
  })
  .option('message', {
    type: 'string',
    default: 'I now have chest pain and difficulty breathing after the visit.',
    describe: 'Companion message for escalation detection',
  })
  .option('evidence', {
    type: 'string',
    describe: 'Optional path to save evidence JSON',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  baseUrl: string;
  tenant: string;
  clinicianToken: string;
  patientToken: string;
  sessionId: string;
  publish: boolean;
  execute: boolean;
  resolve: boolean;
  message: string;
  evidence?: string;
};

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getRecommendationActionId(artifacts: DraftArtifact[]) {
  const recommendationArtifact = artifacts.find((artifact) => {
    const type = String(artifact.type || artifact.artifactType || '').toLowerCase();
    return type === 'recommendation_bundle';
  });
  const first = Array.isArray(recommendationArtifact?.content?.items)
    ? recommendationArtifact?.content?.items?.[0]
    : null;
  return String(first?.id || first?.recommendation_id || '');
}

async function run() {
  const baseURL = argv.baseUrl.replace(/\/+$/, '');
  const clinicianClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.clinicianToken}`,
    },
  });
  const patientClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.patientToken}`,
    },
  });

  const sessionResponse = await clinicianClient.get(`/post-visit/sessions/${argv.sessionId}`);
  ensure(sessionResponse.data?.id === argv.sessionId, 'Session fetch failed');

  const draftResponse = await clinicianClient.get(`/post-visit/sessions/${argv.sessionId}/draft`);
  ensure(Array.isArray(draftResponse.data?.artifacts), 'Draft artifacts missing');
  let sessionStatus = String(sessionResponse.data?.status || '').toLowerCase();

  let publishAttempted = false;
  let publishStatus: string | null = null;
  if (argv.publish && !['published', 'closed'].includes(sessionStatus)) {
    publishAttempted = true;
    const publishResponse = await clinicianClient.post(`/post-visit/sessions/${argv.sessionId}/publish`, {
      note: 'QA post-visit end-to-end publish',
      publishMetadata: { source: 'qa_post_visit_end_to_end' },
    });
    publishStatus = publishResponse.data?.session?.status || publishResponse.data?.status || null;
    sessionStatus = String(publishStatus || sessionStatus).toLowerCase();
  }

  let executedActionId: string | null = null;
  let executionStatus: string | null = null;
  if (argv.execute) {
    const actionId = getRecommendationActionId(draftResponse.data?.artifacts || []);
    ensure(actionId, 'No recommendation action ID found in draft');

    const executeResponse = await clinicianClient.post(
      `/post-visit/sessions/${argv.sessionId}/recommendations/${actionId}/execute`,
      { note: 'QA end-to-end execution' },
    );
    executedActionId = actionId;
    executionStatus =
      executeResponse.data?.execution?.status ||
      executeResponse.data?.result?.status ||
      executeResponse.data?.status ||
      null;
  }

  ensure(['published', 'closed'].includes(sessionStatus), 'Session must be published for patient companion flow');

  const [summaryResponse, messagesResponse] = await Promise.all([
    patientClient.get(`/patient-portal/post-visit/sessions/${argv.sessionId}/summary`),
    patientClient.get(`/patient-portal/post-visit/sessions/${argv.sessionId}/messages`, {
      params: { limit: 25, offset: 0 },
    }),
  ]);
  ensure(summaryResponse.data?.summary, 'Patient summary missing');
  ensure(Array.isArray(messagesResponse.data?.messages), 'Patient companion messages list missing');

  const sendMessageResponse = await patientClient.post(`/patient-portal/post-visit/sessions/${argv.sessionId}/messages`, {
    message: argv.message,
    messageType: 'question',
  });
  ensure(sendMessageResponse.data?.escalation?.id, 'Escalation event was not generated');
  const escalationId = String(sendMessageResponse.data.escalation.id);

  const queueResponse = await clinicianClient.get('/post-visit/escalations', {
    params: { sessionId: argv.sessionId, status: 'open', limit: 50, offset: 0 },
  });
  const queueEscalations = Array.isArray(queueResponse.data?.escalations) ? queueResponse.data.escalations : [];
  ensure(queueEscalations.some((item: { id?: string }) => String(item.id || '') === escalationId), 'Escalation not visible in clinician queue');

  let resolveStatus: string | null = null;
  if (argv.resolve) {
    const resolveResponse = await clinicianClient.post(`/post-visit/escalations/${escalationId}/resolve`, {
      status: 'resolved',
      resolutionNote: 'QA journey close-loop resolution',
    });
    resolveStatus = resolveResponse.data?.status || resolveResponse.data?.escalation?.status || null;
    if (String(resolveStatus || '').toLowerCase() !== 'resolved') {
      const resolvedQueue = await clinicianClient.get('/post-visit/escalations', {
        params: { sessionId: argv.sessionId, status: 'resolved', limit: 50, offset: 0 },
      });
      const resolvedEscalations = Array.isArray(resolvedQueue.data?.escalations) ? resolvedQueue.data.escalations : [];
      const isResolved = resolvedEscalations.some((item: { id?: string }) => String(item.id || '') === escalationId);
      ensure(isResolved, 'Escalation not found in resolved queue after resolve request');
      resolveStatus = 'resolved';
    }
  }

  const [mobileContractResponse, mobileEventsResponse, fhirResponse] = await Promise.all([
    clinicianClient.get(`/post-visit/sessions/${argv.sessionId}/mobile-contract`, { params: { version: 'v1' } }),
    clinicianClient.get(`/post-visit/sessions/${argv.sessionId}/mobile-events`, { params: { version: 'v1', limit: 50, offset: 0 } }),
    clinicianClient.get(`/post-visit/sessions/${argv.sessionId}/fhir`),
  ]);

  ensure(mobileContractResponse.data?.contractVersion === 'post-visit-mobile.v1', 'Mobile contract version mismatch');
  ensure(mobileEventsResponse.data?.contractVersion === 'post-visit-mobile-events.v1', 'Mobile events version mismatch');
  ensure(fhirResponse.data?.exportVersion === 'post-visit-fhir-r4.v1', 'FHIR export version mismatch');

  const evidence = {
    runAt: new Date().toISOString(),
    sessionId: argv.sessionId,
    sessionStatusBefore: sessionResponse.data?.status || null,
    publishAttempted,
    publishStatus,
    executedActionId,
    executionStatus,
    escalationId,
    escalationSeverity: sendMessageResponse.data?.escalation?.severity || null,
    escalationRoute: sendMessageResponse.data?.escalation?.routeTarget || null,
    resolveStatus,
    mobileContractVersion: mobileContractResponse.data?.contractVersion,
    mobileEventCount: mobileEventsResponse.data?.events?.length || 0,
    fhirResourceCount: fhirResponse.data?.stats?.resourceCount || fhirResponse.data?.bundle?.entry?.length || 0,
  };

  if (argv.evidence) {
    const outputPath = path.resolve(process.cwd(), argv.evidence);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  console.log('[post-visit-end-to-end-journey-smoke] PASS');
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error('[post-visit-end-to-end-journey-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
