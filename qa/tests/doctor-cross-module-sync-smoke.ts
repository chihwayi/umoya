#!/usr/bin/env ts-node
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { AxiosInstance } from 'axios';

type FeedItem = {
  id: string;
  module: string;
  item_type: string;
  source_record_id?: string | null;
  patient_id?: string | null;
  enrollment_id?: string | null;
  destination_role?: string | null;
  destination_service?: string | null;
  destination_specialty?: string | null;
  destination_user_id?: string | null;
  destination_user_name?: string | null;
  destination_facility_id?: string | null;
  destination_facility_name?: string | null;
  metadata?: Record<string, any> | null;
};

type RecommendationItem = {
  id?: string;
  type?: string;
  title?: string;
  action_payload?: Record<string, any> | null;
  execution_status?: string;
};

type ModuleCheckResult = {
  module: string;
  feedItemId?: string;
  actionId?: string;
  endpoint?: string;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  result?: Record<string, any> | null;
};

const argv = yargs(hideBin(process.argv))
  .option('baseUrl', {
    type: 'string',
    describe: 'Base URL for ehr-service',
    default: 'http://localhost:3013',
  })
  .option('tenant', {
    type: 'string',
    describe: 'Tenant slug for X-Tenant-ID header',
    demandOption: true,
  })
  .option('token', {
    type: 'string',
    describe: 'Bearer token',
    demandOption: true,
  })
  .option('modules', {
    type: 'string',
    describe: 'Comma-separated modules to validate',
    default: 'hiv,oncology,cardiology,ophthalmology,telemedicine,ed,sepsis,blood_bank,lab,pharmacy',
  })
  .option('days', {
    type: 'number',
    describe: 'Doctor outcome analytics window',
    default: 30,
  })
  .option('execute', {
    type: 'boolean',
    describe: 'Execute one recommendation action per module',
    default: false,
  })
  .option('evidence', {
    type: 'string',
    describe: 'Path to write evidence JSON',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  baseUrl: string;
  tenant: string;
  token: string;
  modules: string;
  days: number;
  execute: boolean;
  evidence?: string;
};

function resolveQaTestsDir() {
  const fromRepoRoot = path.resolve(process.cwd(), 'qa/tests');
  if (fs.existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  return process.cwd();
}

const qaTestsDir = resolveQaTestsDir();

function normalizeModuleList(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    ),
  );
}

function ensure(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function pickRecommendationItem(feedItem: FeedItem): RecommendationItem | null {
  const bundleItems = Array.isArray(feedItem?.metadata?.recommendation_bundle?.items)
    ? feedItem.metadata!.recommendation_bundle.items
    : [];
  const actionable = bundleItems.find(
    (item: RecommendationItem) => String(item?.execution_status || '').toLowerCase() !== 'completed',
  );
  return actionable || bundleItems[0] || null;
}

function resolveExecuteEndpoint(moduleName: string): string | null {
  if (moduleName === 'hiv') return '/nurse-worklist/cross-module/hiv-recommendation-action';
  if (moduleName === 'oncology') return '/nurse-worklist/cross-module/oncology-recommendation-action';
  if (moduleName === 'cardiology') return '/nurse-worklist/cross-module/cardiology-recommendation-action';
  if (moduleName === 'ophthalmology') return '/nurse-worklist/cross-module/ophthalmology-recommendation-action';
  if (moduleName === 'telemedicine') return '/nurse-worklist/cross-module/telemedicine-recommendation-action';
  if (moduleName === 'ed') return '/nurse-worklist/cross-module/ed-recommendation-action';
  if (moduleName === 'sepsis') return '/nurse-worklist/cross-module/sepsis-recommendation-action';
  if (moduleName === 'blood_bank') return '/nurse-worklist/cross-module/blood-bank-recommendation-action';
  if (moduleName === 'lab') return '/nurse-worklist/cross-module/lab-recommendation-action';
  if (moduleName === 'pharmacy') return '/nurse-worklist/cross-module/pharmacy-recommendation-action';
  return null;
}

function buildExecutePayload(feedItem: FeedItem, action: RecommendationItem): Record<string, any> {
  const moduleName = String(feedItem.module || '').toLowerCase();
  const payload: Record<string, any> = {
    itemId: feedItem.id,
    itemType: feedItem.item_type,
    sourceRecordId: feedItem.source_record_id || null,
    patientId: feedItem.patient_id || null,
    actionId: String(action?.id || ''),
    actionType: action?.type || null,
    actionTitle: action?.title || null,
    actionPayload: action?.action_payload || null,
    destinationRole: feedItem.destination_role || null,
    destinationService: feedItem.destination_service || null,
    destinationSpecialty: feedItem.destination_specialty || null,
    destinationUserId: feedItem.destination_user_id || null,
    destinationUserName: feedItem.destination_user_name || null,
    destinationFacilityId: feedItem.destination_facility_id || null,
    destinationFacilityName: feedItem.destination_facility_name || null,
  };

  if (moduleName === 'hiv') {
    payload.enrollmentId = feedItem.enrollment_id || null;
  }
  if (moduleName === 'oncology') {
    payload.caseId =
      feedItem.metadata?.oncology_case_id ||
      action?.action_payload?.case_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'cardiology') {
    payload.encounterId =
      feedItem.metadata?.encounter_id ||
      action?.action_payload?.encounter_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'ophthalmology') {
    payload.encounterId =
      feedItem.metadata?.encounter_id ||
      action?.action_payload?.encounter_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'telemedicine') {
    payload.consultationId =
      feedItem.metadata?.consultation_id ||
      action?.action_payload?.consultation_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'ed') {
    payload.visitId =
      feedItem.metadata?.ed_visit_id ||
      action?.action_payload?.visit_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'sepsis') {
    payload.bundleId =
      feedItem.metadata?.sepsis_bundle_id ||
      action?.action_payload?.bundle_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'blood_bank') {
    payload.transfusionId =
      feedItem.metadata?.transfusion_id ||
      action?.action_payload?.transfusion_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'lab') {
    payload.alertId =
      feedItem.metadata?.alert_id ||
      action?.action_payload?.alert_id ||
      feedItem.source_record_id ||
      null;
  }
  if (moduleName === 'pharmacy') {
    payload.prescriptionId =
      feedItem.metadata?.prescription_id ||
      action?.action_payload?.prescription_id ||
      feedItem.source_record_id ||
      null;
  }

  return payload;
}

function requireModuleContext(moduleName: string, payload: Record<string, any>) {
  if (moduleName === 'hiv') ensure(payload.enrollmentId, 'Missing enrollmentId context for HIV action');
  if (moduleName === 'oncology') ensure(payload.caseId, 'Missing caseId context for oncology action');
  if (moduleName === 'cardiology') ensure(payload.encounterId, 'Missing encounterId context for cardiology action');
  if (moduleName === 'ophthalmology') ensure(payload.encounterId, 'Missing encounterId context for ophthalmology action');
  if (moduleName === 'telemedicine') ensure(payload.consultationId, 'Missing consultationId context for telemedicine action');
  if (moduleName === 'ed') ensure(payload.visitId, 'Missing visitId context for ED action');
  if (moduleName === 'sepsis') ensure(payload.bundleId, 'Missing bundleId context for sepsis action');
  if (moduleName === 'blood_bank') ensure(payload.transfusionId, 'Missing transfusionId context for blood_bank action');
  if (moduleName === 'lab') ensure(payload.alertId, 'Missing alertId context for lab action');
  if (moduleName === 'pharmacy') ensure(payload.prescriptionId, 'Missing prescriptionId context for pharmacy action');
}

async function runModuleCheck(
  client: AxiosInstance,
  feedItems: FeedItem[],
  moduleName: string,
  execute: boolean,
): Promise<ModuleCheckResult> {
  const moduleItem = feedItems.find((item) => String(item.module || '').toLowerCase() === moduleName);
  if (!moduleItem) {
    return {
      module: moduleName,
      status: 'failed',
      message: `No ${moduleName} item found in cross-module feed. Provision UAT data first.`,
    };
  }

  const action = pickRecommendationItem(moduleItem);
  if (!action || !action.id) {
    return {
      module: moduleName,
      feedItemId: moduleItem.id,
      status: 'failed',
      message: `No recommendation action found for ${moduleName} feed item.`,
    };
  }

  const endpoint = resolveExecuteEndpoint(moduleName);
  if (!endpoint) {
    return {
      module: moduleName,
      feedItemId: moduleItem.id,
      actionId: String(action.id),
      status: 'failed',
      message: `Unsupported module "${moduleName}" for executable smoke runner.`,
    };
  }

  if (!execute) {
    return {
      module: moduleName,
      feedItemId: moduleItem.id,
      actionId: String(action.id),
      endpoint,
      status: 'skipped',
      message: 'Dry-run mode: action execution skipped. Re-run with --execute for mutation checks.',
    };
  }

  const payload = buildExecutePayload(moduleItem, action);
  try {
    requireModuleContext(moduleName, payload);
    const response = await client.post(endpoint, payload);
    return {
      module: moduleName,
      feedItemId: moduleItem.id,
      actionId: String(action.id),
      endpoint,
      status: 'passed',
      message: 'Recommendation action executed successfully.',
      result: response.data || null,
    };
  } catch (error: any) {
    return {
      module: moduleName,
      feedItemId: moduleItem.id,
      actionId: String(action.id),
      endpoint,
      status: 'failed',
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Unknown execution failure while running module recommendation action.',
      result: error?.response?.data || null,
    };
  }
}

async function main() {
  const moduleList = normalizeModuleList(argv.modules);
  ensure(moduleList.length > 0, 'No modules provided');

  const client = axios.create({
    baseURL: argv.baseUrl.replace(/\/$/, ''),
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${argv.token}`,
      'X-Tenant-ID': argv.tenant,
    },
  });

  const feedResponse = await client.get('/nurse-worklist/cross-module-feed');
  const feedData = feedResponse.data || {};
  const feedItems: FeedItem[] = Array.isArray(feedData.items) ? feedData.items : [];

  const moduleResults: ModuleCheckResult[] = [];
  for (const moduleName of moduleList) {
    const result = await runModuleCheck(client, feedItems, moduleName, argv.execute);
    moduleResults.push(result);
  }

  const analyticsResponse = await client.get('/nurse-worklist/analytics/doctor-outcomes', {
    params: { days: argv.days },
  });
  const analytics = analyticsResponse.data || {};

  ensure(analytics.doctorQueue, 'Missing doctorQueue in doctor outcomes analytics');
  ensure(analytics.accountsSync, 'Missing accountsSync in doctor outcomes analytics');
  ensure(analytics.recommendationExecution, 'Missing recommendationExecution in doctor outcomes analytics');
  ensure(analytics.cdssAdoption, 'Missing cdssAdoption in doctor outcomes analytics');

  const failedModules = moduleResults.filter((row) => row.status === 'failed');
  const passedModules = moduleResults.filter((row) => row.status === 'passed');
  const skippedModules = moduleResults.filter((row) => row.status === 'skipped');
  const executionRequired = argv.execute;
  const overallStatus =
    failedModules.length > 0
      ? 'failed'
      : executionRequired && passedModules.length === 0
        ? 'failed'
        : executionRequired
          ? 'passed'
          : 'dry-run';

  const evidencePath =
    argv.evidence ||
    path.resolve(
      qaTestsDir,
      'test-results',
      `doctor-cross-module-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });

  const evidencePayload = {
    generatedAt: new Date().toISOString(),
    tenant: argv.tenant,
    baseUrl: argv.baseUrl,
    modules: moduleList,
    execute: argv.execute,
    overallStatus,
    summary: {
      passed: passedModules.length,
      failed: failedModules.length,
      skipped: skippedModules.length,
      feedTotalItems: feedItems.length,
    },
    moduleResults,
    analytics: {
      window: analytics.window || null,
      doctorQueue: analytics.doctorQueue || null,
      accountsSync: analytics.accountsSync || null,
      recommendationExecution: analytics.recommendationExecution || null,
      cdssAdoption: analytics.cdssAdoption || null,
    },
  };

  fs.writeFileSync(evidencePath, `${JSON.stringify(evidencePayload, null, 2)}\n`, 'utf-8');

  console.log(`Doctor cross-module sync smoke run: ${overallStatus.toUpperCase()}`);
  console.log(JSON.stringify(evidencePayload.summary, null, 2));
  console.log(`Evidence written to: ${evidencePath}`);

  if (overallStatus === 'failed') {
    process.exit(1);
  }
}

main().catch((error: any) => {
  console.error('Doctor cross-module sync smoke failed:', error?.message || error);
  process.exit(1);
});
