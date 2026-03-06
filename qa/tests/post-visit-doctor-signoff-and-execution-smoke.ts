#!/usr/bin/env ts-node
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type RecommendationBundleItem = {
  id?: string;
  recommendation_id?: string;
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
  .option('token', {
    type: 'string',
    demandOption: true,
    describe: 'Doctor/admin JWT token',
  })
  .option('sessionId', {
    type: 'string',
    demandOption: true,
    describe: 'Post-visit session ID',
  })
  .option('publish', {
    type: 'boolean',
    default: false,
    describe: 'Run publish endpoint as part of smoke',
  })
  .option('execute', {
    type: 'boolean',
    default: false,
    describe: 'Execute one recommendation action',
  })
  .option('actionId', {
    type: 'string',
    describe: 'Optional recommendation action ID override',
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
  publish: boolean;
  execute: boolean;
  actionId?: string;
  evidence?: string;
};

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveActionIdFromDraft(draft: { artifacts?: Array<{ artifactType?: string; content?: { items?: RecommendationBundleItem[] } }> }) {
  const recommendationArtifact = (draft.artifacts || []).find(
    (artifact) => String(artifact.artifactType || '').toLowerCase() === 'recommendation_bundle',
  );
  const recommendationItems = Array.isArray(recommendationArtifact?.content?.items)
    ? recommendationArtifact!.content!.items!
    : [];
  const first = recommendationItems[0];
  return String(first?.id || first?.recommendation_id || '');
}

async function run() {
  const client = axios.create({
    baseURL: argv.baseUrl.replace(/\/+$/, ''),
    timeout: 30000,
    headers: {
      'X-Tenant-ID': argv.tenant,
      Authorization: `Bearer ${argv.token}`,
    },
  });

  const sessionResponse = await client.get(`/post-visit/sessions/${argv.sessionId}`);
  ensure(sessionResponse.data?.id === argv.sessionId, 'Session endpoint did not return expected ID');

  const draftResponse = await client.get(`/post-visit/sessions/${argv.sessionId}/draft`);
  ensure(Array.isArray(draftResponse.data?.artifacts), 'Draft endpoint must return artifacts');

  let publishStatus: string | null = null;
  if (argv.publish) {
    const publishResponse = await client.post(`/post-visit/sessions/${argv.sessionId}/publish`, {
      note: 'QA publish smoke',
      publishToPatientCompanion: true,
    });
    publishStatus = publishResponse.data?.session?.status || publishResponse.data?.status || null;
  }

  let executedActionId: string | null = null;
  let executionStatus: string | null = null;
  if (argv.execute) {
    const actionId = argv.actionId || resolveActionIdFromDraft(draftResponse.data);
    ensure(actionId, 'No recommendation action ID found in draft. Provide --actionId explicitly.');

    const executeResponse = await client.post(
      `/post-visit/sessions/${argv.sessionId}/recommendations/${actionId}/execute`,
      {
        executionNote: 'QA execute smoke',
        sourceModule: 'qa_smoke',
        context: { source: 'post_visit_doctor_signoff_smoke' },
      },
    );
    executedActionId = actionId;
    executionStatus =
      executeResponse.data?.execution?.status ||
      executeResponse.data?.result?.status ||
      executeResponse.data?.status ||
      null;
  }

  const evidence = {
    runAt: new Date().toISOString(),
    sessionId: argv.sessionId,
    sessionStatus: sessionResponse.data?.status || null,
    artifactCount: draftResponse.data?.artifacts?.length || 0,
    publishStatus,
    executedActionId,
    executionStatus,
  };

  if (argv.evidence) {
    const outputPath = path.resolve(process.cwd(), argv.evidence);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  console.log('[post-visit-doctor-signoff-and-execution-smoke] PASS');
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error('[post-visit-doctor-signoff-and-execution-smoke] FAIL');
  console.error(error?.response?.status ? `HTTP ${error.response.status}` : '');
  console.error(error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
  process.exit(1);
});
