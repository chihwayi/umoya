#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EHR_BASE_URL = (process.env.EHR_BASE_URL || 'http://localhost:3013').replace(/\/+$/, '');
const EHR_API_BASE = `${EHR_BASE_URL}/api`;
const TENANT_ID = process.env.TENANT_ID || 'kids-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'mumu@gmail.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Password1#';
const REQUEST_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS || 20000);

const runStartedAt = new Date();
const stamp = runStartedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.resolve(process.cwd(), 'reports');
const reportPath = path.join(reportDir, `module-closeout-audit-${TENANT_ID}-${stamp}.json`);

function getAtPath(obj, dottedPath) {
  if (!dottedPath) return undefined;
  return dottedPath.split('.').reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
}

function hasPath(obj, dottedPath) {
  const value = getAtPath(obj, dottedPath);
  return value !== undefined;
}

function hasAnyPath(obj, dottedPaths = []) {
  return dottedPaths.some((p) => hasPath(obj, p));
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function httpRequest({ method = 'GET', url, token, tenantId, expectedStatus = [200], json }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!expectedStatus.includes(res.status)) {
      const message = typeof data === 'object' && data
        ? data.message || data.error || `HTTP ${res.status}`
        : `HTTP ${res.status}`;
      throw new Error(message);
    }

    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateModule(moduleDef, payload, aiGuidanceWired) {
  const criteria = {
    workflow_operational_brief: hasAnyPath(payload, moduleDef.criteria.workflow_operational_brief),
    risk_prioritization: hasAnyPath(payload, moduleDef.criteria.risk_prioritization),
    documentation_quality: hasAnyPath(payload, moduleDef.criteria.documentation_quality),
    actionable_recommendations: hasAnyPath(payload, moduleDef.criteria.actionable_recommendations),
    cdss_coverage: hasAnyPath(payload, moduleDef.criteria.cdss_coverage),
    ai_guideline_search: aiGuidanceWired,
  };

  const missingCriteria = Object.entries(criteria)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  return {
    criteria,
    missingCriteria,
    status: missingCriteria.length === 0 ? 'done' : 'remaining',
  };
}

async function main() {
  const report = {
    startedAt: runStartedAt.toISOString(),
    environment: {
      EHR_BASE_URL,
      TENANT_ID,
      DOCTOR_EMAIL,
    },
    modules: [],
    summary: {
      total: 0,
      done: 0,
      remaining: 0,
    },
  };

  const login = await httpRequest({
    method: 'POST',
    url: `${EHR_API_BASE}/auth/login`,
    tenantId: TENANT_ID,
    expectedStatus: [200, 201],
    json: {
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD,
    },
  });

  const token = login.data?.token;
  const doctorId = login.data?.user?.id;
  if (!token || !doctorId) {
    throw new Error('Doctor login did not return token/user id');
  }

  const moduleDefs = [
    {
      key: 'mar',
      name: 'Medication Administration Record (MAR)',
      endpoint: '/bcma/mar/operational-brief',
      frontendPath: 'ehr-frontend/src/pages/MARDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.highRisk', 'summary.criticalRiskItems', 'highPriorityQueue'],
        documentation_quality: ['summary.documentationGaps', 'summary.missingWitnessDocumentation', 'summary.scanComplianceGaps'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
    {
      key: 'blood-bank',
      name: 'Blood Bank Dashboard',
      endpoint: '/blood-bank/operational-brief',
      frontendPath: 'ehr-frontend/src/pages/BloodBankDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['safetySummary', 'highPriorityQueue'],
        risk_prioritization: ['safetySummary.criticalRiskItems', 'highPriorityQueue'],
        documentation_quality: ['safetySummary.documentationGaps', 'safetySummary.missingConsent', 'safetySummary.missingCrossmatch'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['safetySummary.cdssCoveragePercent'],
      },
    },
    {
      key: 'sepsis',
      name: 'Sepsis Management & SEP-1 Bundle',
      endpoint: '/sepsis/operational-brief',
      frontendPath: 'ehr-frontend/src/pages/SepsisDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.criticalRisk', 'summary.highRisk', 'highPriorityQueue'],
        documentation_quality: ['summary.missingBundleNotes', 'summary.missingOnsetTime'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
    {
      key: 'infection-control',
      name: 'Infection Control & Epidemiology',
      endpoint: '/infection-control/operational-brief',
      frontendPath: 'ehr-frontend/src/pages/InfectionControlDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.highRiskInfections', 'summary.stewardshipHighRisk', 'highPriorityQueue'],
        documentation_quality: ['summary.diagnosticWorkupGaps', 'summary.infectionCodingGaps', 'summary.stewardshipCodingGaps'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
    {
      key: 'cdi',
      name: 'Clinical Documentation Improvement',
      endpoint: `/cdi/queries/brief/${doctorId}`,
      frontendPath: 'ehr-frontend/src/pages/CdiDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.highRisk', 'summary.overdue', 'highPriorityQueue'],
        documentation_quality: ['summary.documentationGaps', 'summary.missingClinicalIndicators', 'summary.missingPotentialDrgContext'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
    {
      key: 'revenue-cycle',
      name: 'Revenue Cycle Management',
      endpoint: `/revenue-cycle/operational-brief?doctorId=${doctorId}`,
      frontendPath: 'ehr-frontend/src/pages/RevenueCycleDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.highRisk', 'summary.overdue', 'highPriorityQueue'],
        documentation_quality: ['summary.missingCodingCount', 'summary.sourceContextGaps', 'summary.reviewedPendingFinalization'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
    {
      key: 'population-health',
      name: 'Population Health',
      endpoint: '/population-health/operational-brief',
      frontendPath: 'ehr-frontend/src/pages/PopulationHealthDashboard.tsx',
      criteria: {
        workflow_operational_brief: ['summary', 'highPriorityQueue'],
        risk_prioritization: ['summary.highPriorityCount', 'summary.uncontrolledCount', 'highPriorityQueue'],
        documentation_quality: ['summary.missingNextReviewCount', 'summary.missingManagementPlanCount'],
        actionable_recommendations: ['recommendations', 'highPriorityQueue.0.recommendedActions'],
        cdss_coverage: ['summary.cdssCoveragePercent'],
      },
    },
  ];

  for (const moduleDef of moduleDefs) {
    const frontendAbsolutePath = path.resolve(process.cwd(), moduleDef.frontendPath);
    const frontendSource = readFileSafe(frontendAbsolutePath);
    const aiGuidanceWired =
      frontendSource.includes('cdssApi.searchGuidelines') ||
      frontendSource.includes('searchGuidelines(');

    const moduleResult = {
      key: moduleDef.key,
      name: moduleDef.name,
      endpoint: `${EHR_API_BASE}${moduleDef.endpoint}`,
      frontendPath: frontendAbsolutePath,
      backendReachable: false,
      httpStatus: null,
      status: 'remaining',
      missingCriteria: [],
      criteria: {},
      cdssCoveragePercent: null,
    };

    try {
      const res = await httpRequest({
        method: 'GET',
        url: `${EHR_API_BASE}${moduleDef.endpoint}`,
        token,
        tenantId: TENANT_ID,
        expectedStatus: [200],
      });
      moduleResult.backendReachable = true;
      moduleResult.httpStatus = res.status;

      const evaluation = evaluateModule(moduleDef, res.data || {}, aiGuidanceWired);
      moduleResult.criteria = evaluation.criteria;
      moduleResult.missingCriteria = evaluation.missingCriteria;
      moduleResult.status = evaluation.status;
      moduleResult.cdssCoveragePercent =
        getAtPath(res.data, 'summary.cdssCoveragePercent') ??
        getAtPath(res.data, 'safetySummary.cdssCoveragePercent') ??
        null;
    } catch (error) {
      moduleResult.criteria = {
        workflow_operational_brief: false,
        risk_prioritization: false,
        documentation_quality: false,
        actionable_recommendations: false,
        cdss_coverage: false,
        ai_guideline_search: aiGuidanceWired,
      };
      moduleResult.missingCriteria = Object.entries(moduleResult.criteria)
        .filter(([, ok]) => !ok)
        .map(([name]) => name);
      moduleResult.error = error instanceof Error ? error.message : String(error);
    }

    report.modules.push(moduleResult);
  }

  report.summary.total = report.modules.length;
  report.summary.done = report.modules.filter((module) => module.status === 'done').length;
  report.summary.remaining = report.summary.total - report.summary.done;
  report.finishedAt = new Date().toISOString();

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Module closeout audit complete for tenant: ${TENANT_ID}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Summary: ${report.summary.done}/${report.summary.total} done, ${report.summary.remaining} remaining`);

  if (report.summary.remaining > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const report = {
    startedAt: runStartedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    fatalError: error instanceof Error ? error.message : String(error),
    environment: {
      EHR_BASE_URL,
      TENANT_ID,
      DOCTOR_EMAIL,
    },
  };
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error('Module closeout audit failed.');
  console.error(report.fatalError);
  console.error(`Report: ${reportPath}`);
  process.exit(2);
});
