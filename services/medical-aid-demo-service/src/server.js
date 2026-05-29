const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3004', 10);
const DATA_DIR = process.env.DEMO_DATA_DIR || path.join(__dirname, '..', 'data');
const PROVIDER_NAME = process.env.DEMO_PROVIDER_NAME || 'Umoya Demo Medical Aid';
const PROVIDER_CODE = (process.env.DEMO_PROVIDER_CODE || 'demo_aid').toLowerCase();
const DEFAULT_CURRENCY = process.env.DEMO_DEFAULT_CURRENCY || 'USD';
const REQUIRE_API_KEY = String(process.env.DEMO_REQUIRE_API_KEY || 'false').toLowerCase() === 'true';
const DEMO_API_KEY = process.env.DEMO_API_KEY || process.env.MEDICAL_AID_DEMO_API_KEY || 'demo-medical-aid-key';

const JSON_FILES = {
  plans: path.join(DATA_DIR, 'plans.json'),
  members: path.join(DATA_DIR, 'members.json'),
  claims: path.join(DATA_DIR, 'claims.json'),
  preauths: path.join(DATA_DIR, 'preauths.json'),
  counters: path.join(DATA_DIR, 'counters.json'),
};

const CSV_FILES = {
  plans: path.join(DATA_DIR, 'plans.csv'),
  members: path.join(DATA_DIR, 'members.csv'),
  claims: path.join(DATA_DIR, 'claims.csv'),
  preauths: path.join(DATA_DIR, 'preauths.csv'),
};

const DEFAULT_COUNTERS = {
  plan: 100,
  member: 1000,
  claim: 1,
  preauth: 1,
};

const state = {
  plans: [],
  members: [],
  claims: [],
  preauths: [],
  counters: { ...DEFAULT_COUNTERS },
};

function nowIso() {
  return new Date().toISOString();
}

function money(value) {
  const parsed = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function num(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toStringSafe(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = toStringSafe(value).toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  return fallback;
}

function normalizeMemberNumber(value) {
  return toStringSafe(value).toUpperCase();
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, filePath);
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filePath, columns, rows) {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = typeof column.value === 'function' ? column.value(row) : row[column.value];
        return csvEscape(value);
      })
      .join(','),
  );
  fs.writeFileSync(filePath, `${[header, ...lines].join('\n')}\n`, 'utf8');
}

function exportCsvSnapshots() {
  writeCsv(
    CSV_FILES.plans,
    [
      { label: 'id', value: 'id' },
      { label: 'code', value: 'code' },
      { label: 'name', value: 'name' },
      { label: 'status', value: 'status' },
      { label: 'currency', value: 'currency' },
      { label: 'annualLimit', value: 'annualLimit' },
      { label: 'outpatientLimit', value: 'outpatientLimit' },
      { label: 'inpatientLimit', value: 'inpatientLimit' },
      { label: 'perClaimLimit', value: 'perClaimLimit' },
      { label: 'coveragePercent', value: 'coveragePercent' },
      { label: 'copayPercent', value: 'copayPercent' },
      { label: 'requiresPreauthAbove', value: 'requiresPreauthAbove' },
      { label: 'updatedAt', value: 'updatedAt' },
    ],
    state.plans,
  );

  writeCsv(
    CSV_FILES.members,
    [
      { label: 'id', value: 'id' },
      { label: 'memberNumber', value: 'memberNumber' },
      { label: 'policyNumber', value: 'policyNumber' },
      { label: 'firstName', value: 'firstName' },
      { label: 'lastName', value: 'lastName' },
      { label: 'status', value: 'status' },
      { label: 'planId', value: 'planId' },
      { label: 'planName', value: 'planName' },
      { label: 'annualLimit', value: (row) => row.limits?.annualLimit ?? 0 },
      { label: 'annualUsed', value: (row) => row.limits?.annualUsed ?? 0 },
      { label: 'outpatientLimit', value: (row) => row.limits?.outpatientLimit ?? 0 },
      { label: 'outpatientUsed', value: (row) => row.limits?.outpatientUsed ?? 0 },
      { label: 'inpatientLimit', value: (row) => row.limits?.inpatientLimit ?? 0 },
      { label: 'inpatientUsed', value: (row) => row.limits?.inpatientUsed ?? 0 },
      { label: 'perClaimLimit', value: (row) => row.limits?.perClaimLimit ?? 0 },
      { label: 'updatedAt', value: 'updatedAt' },
    ],
    state.members,
  );

  writeCsv(
    CSV_FILES.claims,
    [
      { label: 'id', value: 'id' },
      { label: 'externalClaimId', value: 'externalClaimId' },
      { label: 'memberNumber', value: 'memberNumber' },
      { label: 'memberName', value: 'memberName' },
      { label: 'status', value: 'status' },
      { label: 'claimType', value: 'claimType' },
      { label: 'claimAmount', value: 'claimAmount' },
      { label: 'approvedAmount', value: 'approvedAmount' },
      { label: 'copayAmount', value: 'copayAmount' },
      { label: 'payableAmount', value: 'payableAmount' },
      { label: 'rejectionReason', value: 'rejectionReason' },
      { label: 'updatedAt', value: 'updatedAt' },
    ],
    state.claims,
  );

  writeCsv(
    CSV_FILES.preauths,
    [
      { label: 'id', value: 'id' },
      { label: 'preAuthId', value: 'preAuthId' },
      { label: 'memberNumber', value: 'memberNumber' },
      { label: 'status', value: 'status' },
      { label: 'requestType', value: 'requestType' },
      { label: 'requestedAmount', value: 'requestedAmount' },
      { label: 'approvedAmount', value: 'approvedAmount' },
      { label: 'decisionReason', value: 'decisionReason' },
      { label: 'updatedAt', value: 'updatedAt' },
    ],
    state.preauths,
  );
}

function persist() {
  writeJson(JSON_FILES.plans, state.plans);
  writeJson(JSON_FILES.members, state.members);
  writeJson(JSON_FILES.claims, state.claims);
  writeJson(JSON_FILES.preauths, state.preauths);
  writeJson(JSON_FILES.counters, state.counters);
  exportCsvSnapshots();
}

function nextCounter(key) {
  const current = Number(state.counters[key] || 0) + 1;
  state.counters[key] = current;
  return current;
}

function planTemplateFromPlan(plan) {
  return {
    annualLimit: money(plan?.annualLimit || 0),
    annualUsed: 0,
    outpatientLimit: money(plan?.outpatientLimit || 0),
    outpatientUsed: 0,
    inpatientLimit: money(plan?.inpatientLimit || 0),
    inpatientUsed: 0,
    perClaimLimit: money(plan?.perClaimLimit || 0),
  };
}

function getPlanById(id) {
  return state.plans.find((plan) => plan.id === id) || null;
}

function getMemberById(id) {
  return state.members.find((member) => member.id === id) || null;
}

function getMemberByNumber(memberNumber) {
  const normalized = normalizeMemberNumber(memberNumber);
  return state.members.find((member) => normalizeMemberNumber(member.memberNumber) === normalized) || null;
}

function remainingFromMember(member) {
  const limits = member.limits || {};
  const annualRemaining = Math.max(money(limits.annualLimit) - money(limits.annualUsed), 0);
  const outpatientRemaining = Math.max(money(limits.outpatientLimit) - money(limits.outpatientUsed), 0);
  const inpatientRemaining = Math.max(money(limits.inpatientLimit) - money(limits.inpatientUsed), 0);

  return {
    annualRemaining: money(annualRemaining),
    outpatientRemaining: money(outpatientRemaining),
    inpatientRemaining: money(inpatientRemaining),
  };
}

function inferClaimType(payloadClaimData = {}) {
  const explicit = toStringSafe(payloadClaimData.claimType || payloadClaimData.encounterType || payloadClaimData.procedureType).toLowerCase();
  if (['inpatient', 'admission', 'surgery', 'theatre', 'hospital'].includes(explicit)) {
    return 'inpatient';
  }
  return 'outpatient';
}

function pushEvent(record, status, note, actor = 'system') {
  const event = {
    at: nowIso(),
    status,
    note: toStringSafe(note),
    actor,
  };
  if (!Array.isArray(record.events)) {
    record.events = [];
  }
  record.events.push(event);
}

function applyUsageDelta(member, claimType, deltaAmount) {
  const delta = money(deltaAmount);
  if (delta === 0) return;

  const limits = member.limits || {};
  const annualLimit = money(limits.annualLimit || 0);
  const outpatientLimit = money(limits.outpatientLimit || 0);
  const inpatientLimit = money(limits.inpatientLimit || 0);

  const annualUsed = Math.max(0, money((limits.annualUsed || 0) + delta));
  limits.annualUsed = annualLimit > 0 ? Math.min(annualUsed, annualLimit) : annualUsed;

  if (claimType === 'inpatient') {
    const inpatientUsed = Math.max(0, money((limits.inpatientUsed || 0) + delta));
    limits.inpatientUsed = inpatientLimit > 0 ? Math.min(inpatientUsed, inpatientLimit) : inpatientUsed;
  } else {
    const outpatientUsed = Math.max(0, money((limits.outpatientUsed || 0) + delta));
    limits.outpatientUsed = outpatientLimit > 0 ? Math.min(outpatientUsed, outpatientLimit) : outpatientUsed;
  }

  member.limits = limits;
  member.updatedAt = nowIso();
}

function reconcileClaimUsage(member, claim, nextStatus, nextApprovedAmount) {
  const approved = money(nextApprovedAmount || 0);
  const shouldApply = nextStatus === 'approved' || nextStatus === 'paid';
  const desiredAppliedAmount = shouldApply ? approved : 0;
  const currentAppliedAmount = money(claim.appliedAmount || 0);
  const delta = money(desiredAppliedAmount - currentAppliedAmount);

  if (delta !== 0) {
    applyUsageDelta(member, claim.claimType || 'outpatient', delta);
    claim.appliedAmount = desiredAppliedAmount;
  }
}

function parseClaimPayload(payload) {
  const diagnosisObject = payload?.diagnosis && typeof payload.diagnosis === 'object' ? payload.diagnosis : {};
  const claimData = payload?.claimData || payload?.claimDetails || payload?.details || {};

  return {
    memberNumber: normalizeMemberNumber(payload?.memberNumber || payload?.member_number),
    claimAmount: money(payload?.claimAmount ?? payload?.claim_amount ?? payload?.amount ?? claimData?.claimAmount ?? 0),
    diagnosisCodes: payload?.diagnosisCodes || payload?.diagnosis_codes || diagnosisObject.all || [],
    primaryDiagnosisCode:
      payload?.primaryDiagnosisCode ||
      payload?.primary_diagnosis ||
      payload?.diagnosisCode ||
      diagnosisObject.primary ||
      null,
    procedureCodes: payload?.procedureCodes || payload?.procedure_codes || payload?.procedures || [],
    serviceCodes: payload?.serviceCodes || payload?.service_codes || payload?.services || [],
    claimData,
    preAuthId: claimData?.preAuthorizationId || claimData?.preAuthId || payload?.preAuthId || payload?.pre_auth_id || null,
  };
}

function parsePreAuthPayload(payload) {
  return {
    memberNumber: normalizeMemberNumber(payload?.memberNumber || payload?.member_number),
    requestType: toStringSafe(payload?.requestType || payload?.request_type || payload?.type || 'consultation') || 'consultation',
    requestedAmount: money(payload?.requestedAmount ?? payload?.requested_amount ?? payload?.amount ?? 0),
    primaryDiagnosisCode:
      payload?.primaryDiagnosisCode || payload?.primary_diagnosis || payload?.diagnosisCode || null,
    diagnosisCodes: payload?.diagnosisCodes || payload?.diagnosis_codes || payload?.diagnosis?.all || [],
    procedureCodes: payload?.procedureCodes || payload?.procedure_codes || payload?.procedures || [],
    serviceCodes: payload?.serviceCodes || payload?.service_codes || payload?.services || [],
    clinicalNotes: payload?.clinicalNotes || payload?.notes || null,
  };
}

function approvedPreAuthForMember(memberNumber, preAuthId) {
  if (toStringSafe(preAuthId)) {
    return (
      state.preauths.find(
        (preauth) =>
          preauth.preAuthId === preAuthId &&
          normalizeMemberNumber(preauth.memberNumber) === normalizeMemberNumber(memberNumber) &&
          preauth.status === 'approved',
      ) || null
    );
  }

  return (
    state.preauths
      .filter(
        (preauth) =>
          normalizeMemberNumber(preauth.memberNumber) === normalizeMemberNumber(memberNumber) && preauth.status === 'approved',
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
  );
}

function evaluateClaim(member, plan, claimPayload) {
  const reasons = [];
  const claimType = inferClaimType(claimPayload.claimData);
  const claimAmount = money(claimPayload.claimAmount);

  if (!member) {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount: 0,
      payableAmount: 0,
      rejectionReason: 'Member number not found in medical aid provider records.',
      reasons: ['member_not_found'],
    };
  }

  if (member.status !== 'active') {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount: 0,
      payableAmount: 0,
      rejectionReason: `Member status is ${member.status}.`,
      reasons: ['member_inactive'],
    };
  }

  if (!(claimAmount > 0)) {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount: 0,
      payableAmount: 0,
      rejectionReason: 'Claim amount must be greater than zero.',
      reasons: ['invalid_amount'],
    };
  }

  const remaining = remainingFromMember(member);
  const annualRemaining = remaining.annualRemaining;
  const typeRemaining = claimType === 'inpatient' ? remaining.inpatientRemaining : remaining.outpatientRemaining;

  if (annualRemaining <= 0) {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount: 0,
      payableAmount: 0,
      rejectionReason: 'Annual benefit limit exhausted.',
      reasons: ['annual_limit_exhausted'],
    };
  }

  if (typeRemaining <= 0) {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount: 0,
      payableAmount: 0,
      rejectionReason: `${claimType} benefit limit exhausted.`,
      reasons: ['benefit_bucket_exhausted'],
    };
  }

  const requiresPreauthAbove = money(plan?.requiresPreauthAbove || 0);
  if (requiresPreauthAbove > 0 && claimAmount > requiresPreauthAbove) {
    const linkedPreAuth = approvedPreAuthForMember(member.memberNumber, claimPayload.preAuthId);
    if (!linkedPreAuth) {
      return {
        status: 'processing',
        claimType,
        approvedAmount: 0,
        copayAmount: 0,
        payableAmount: 0,
        rejectionReason: null,
        reasons: ['preauth_required'],
        decisionNote: `Pre-authorization required for claims above ${requiresPreauthAbove}.`,
      };
    }
    reasons.push(`preauth_linked:${linkedPreAuth.preAuthId}`);
  }

  const coveragePercent = Math.max(0, Math.min(100, num(plan?.coveragePercent, 80)));
  const copayPercent = Math.max(0, Math.min(100, num(plan?.copayPercent, 10)));
  const perClaimLimit = money(member?.limits?.perClaimLimit ?? plan?.perClaimLimit ?? claimAmount);

  let coveredBeforeCopay = money((claimAmount * coveragePercent) / 100);
  if (perClaimLimit > 0) {
    coveredBeforeCopay = Math.min(coveredBeforeCopay, perClaimLimit);
  }
  coveredBeforeCopay = Math.min(coveredBeforeCopay, annualRemaining, typeRemaining);

  const copayAmount = money((claimAmount * copayPercent) / 100);
  const approvedAmount = Math.max(0, money(coveredBeforeCopay - copayAmount));

  if (!(approvedAmount > 0)) {
    return {
      status: 'rejected',
      claimType,
      approvedAmount: 0,
      copayAmount,
      payableAmount: 0,
      rejectionReason: 'Computed approved amount is zero after limits and co-pay.',
      reasons: ['no_payable_amount'],
    };
  }

  reasons.push(`coverage:${coveragePercent}`);
  reasons.push(`copay:${copayPercent}`);

  return {
    status: 'approved',
    claimType,
    approvedAmount: money(approvedAmount),
    copayAmount: money(copayAmount),
    payableAmount: money(approvedAmount),
    rejectionReason: null,
    reasons,
  };
}

function findClaimByAnyId(idOrExternal) {
  const key = toStringSafe(idOrExternal);
  return (
    state.claims.find((claim) => claim.id === key || claim.externalClaimId === key || claim.referenceNumber === key) || null
  );
}

function summarize() {
  const totalClaims = state.claims.length;
  const statusCounts = state.claims.reduce(
    (acc, claim) => {
      acc[claim.status] = (acc[claim.status] || 0) + 1;
      return acc;
    },
    {},
  );

  const totalSubmittedAmount = money(state.claims.reduce((sum, claim) => sum + money(claim.claimAmount || 0), 0));
  const totalApprovedAmount = money(
    state.claims
      .filter((claim) => claim.status === 'approved' || claim.status === 'paid')
      .reduce((sum, claim) => sum + money(claim.approvedAmount || 0), 0),
  );

  return {
    provider: {
      name: PROVIDER_NAME,
      code: PROVIDER_CODE,
    },
    totals: {
      plans: state.plans.length,
      members: state.members.length,
      claims: totalClaims,
      preauthorizations: state.preauths.length,
      submittedAmount: totalSubmittedAmount,
      approvedAmount: totalApprovedAmount,
      approvalRate: totalClaims > 0 ? Number(((statusCounts.approved || 0) / totalClaims).toFixed(2)) : 0,
    },
    statusCounts,
  };
}

function bootstrapIfEmpty() {
  if (state.plans.length > 0 && state.members.length > 0) {
    return;
  }

  const createdAt = nowIso();

  const defaultPlan = {
    id: 'plan-0101',
    code: 'STANDARD-80',
    name: 'Standard 80',
    status: 'active',
    currency: DEFAULT_CURRENCY,
    annualLimit: 2500,
    outpatientLimit: 1800,
    inpatientLimit: 4000,
    perClaimLimit: 600,
    coveragePercent: 80,
    copayPercent: 10,
    requiresPreauthAbove: 450,
    createdAt,
    updatedAt: createdAt,
  };

  const vipPlan = {
    id: 'plan-0102',
    code: 'PREMIUM-95',
    name: 'Premium 95',
    status: 'active',
    currency: DEFAULT_CURRENCY,
    annualLimit: 9000,
    outpatientLimit: 6500,
    inpatientLimit: 12000,
    perClaimLimit: 2000,
    coveragePercent: 95,
    copayPercent: 5,
    requiresPreauthAbove: 1200,
    createdAt,
    updatedAt: createdAt,
  };

  const defaultMember = {
    id: 'member-1001',
    memberNumber: 'MED-1001',
    policyNumber: 'POL-778899',
    firstName: 'Demo',
    lastName: 'Patient',
    dateOfBirth: '1992-02-14',
    gender: 'female',
    phone: '+263770000001',
    email: 'demo.patient@umoya.local',
    relationship: 'self',
    status: 'active',
    planId: defaultPlan.id,
    planName: defaultPlan.name,
    limits: planTemplateFromPlan(defaultPlan),
    notes: 'Seed member for claims demonstrations',
    createdAt,
    updatedAt: createdAt,
  };

  state.plans = [defaultPlan, vipPlan];
  state.members = [defaultMember];
  state.counters.plan = Math.max(state.counters.plan || 100, 102);
  state.counters.member = Math.max(state.counters.member || 1000, 1001);
}

function loadState() {
  ensureDir();
  state.plans = readJson(JSON_FILES.plans, []);
  state.members = readJson(JSON_FILES.members, []);
  state.claims = readJson(JSON_FILES.claims, []);
  state.preauths = readJson(JSON_FILES.preauths, []);
  state.counters = { ...DEFAULT_COUNTERS, ...readJson(JSON_FILES.counters, {}) };
  bootstrapIfEmpty();
  persist();
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use('/api', (req, res, next) => {
  if (!REQUIRE_API_KEY) return next();
  const provided =
    req.header('x-api-key') ||
    (req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim();

  if (provided !== DEMO_API_KEY) {
    return res.status(401).json({ message: 'Invalid API key for demo medical aid provider.' });
  }
  return next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'medical-aid-demo-service',
    timestamp: nowIso(),
    ...summarize(),
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    providerName: PROVIDER_NAME,
    providerCode: PROVIDER_CODE,
    dataDir: DATA_DIR,
    requireApiKey: REQUIRE_API_KEY,
    apiKeyHint: REQUIRE_API_KEY ? 'Set X-API-Key header with DEMO_API_KEY' : 'Not required in current mode',
    ...summarize(),
  });
});

app.get('/api/dashboard', (_req, res) => {
  const byPlan = state.members.reduce((acc, member) => {
    const key = member.planName || member.planId || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const claimTrend = state.claims
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((claim) => ({
      externalClaimId: claim.externalClaimId,
      memberNumber: claim.memberNumber,
      status: claim.status,
      claimAmount: claim.claimAmount,
      approvedAmount: claim.approvedAmount,
      updatedAt: claim.updatedAt,
    }));

  res.json({
    ...summarize(),
    byPlan,
    recentClaims: claimTrend,
  });
});

app.get('/api/plans', (_req, res) => {
  const plans = state.plans.slice().sort((a, b) => a.name.localeCompare(b.name));
  res.json(plans);
});

app.post('/api/plans', (req, res) => {
  const createdAt = nowIso();
  const planSequence = nextCounter('plan');
  const code = toStringSafe(req.body.code || `PLAN-${planSequence}`)
    .replace(/\s+/g, '-')
    .toUpperCase();

  if (!toStringSafe(req.body.name)) {
    return res.status(400).json({ message: 'Plan name is required.' });
  }

  const plan = {
    id: `plan-${String(planSequence).padStart(4, '0')}`,
    code,
    name: toStringSafe(req.body.name),
    status: normalizeStatus(req.body.status, ['active', 'inactive'], 'active'),
    currency: toStringSafe(req.body.currency || DEFAULT_CURRENCY) || DEFAULT_CURRENCY,
    annualLimit: money(req.body.annualLimit || 0),
    outpatientLimit: money(req.body.outpatientLimit || 0),
    inpatientLimit: money(req.body.inpatientLimit || 0),
    perClaimLimit: money(req.body.perClaimLimit || 0),
    coveragePercent: Math.max(0, Math.min(100, num(req.body.coveragePercent, 80))),
    copayPercent: Math.max(0, Math.min(100, num(req.body.copayPercent, 10))),
    requiresPreauthAbove: money(req.body.requiresPreauthAbove || 0),
    createdAt,
    updatedAt: createdAt,
  };

  state.plans.push(plan);
  persist();
  return res.status(201).json(plan);
});

app.put('/api/plans/:id', (req, res) => {
  const plan = getPlanById(req.params.id);
  if (!plan) {
    return res.status(404).json({ message: 'Plan not found.' });
  }

  if (toStringSafe(req.body.name)) plan.name = toStringSafe(req.body.name);
  if (toStringSafe(req.body.code)) plan.code = toStringSafe(req.body.code).toUpperCase();
  if (toStringSafe(req.body.currency)) plan.currency = toStringSafe(req.body.currency).toUpperCase();
  if (req.body.annualLimit !== undefined) plan.annualLimit = money(req.body.annualLimit);
  if (req.body.outpatientLimit !== undefined) plan.outpatientLimit = money(req.body.outpatientLimit);
  if (req.body.inpatientLimit !== undefined) plan.inpatientLimit = money(req.body.inpatientLimit);
  if (req.body.perClaimLimit !== undefined) plan.perClaimLimit = money(req.body.perClaimLimit);
  if (req.body.coveragePercent !== undefined) plan.coveragePercent = Math.max(0, Math.min(100, num(req.body.coveragePercent, 80)));
  if (req.body.copayPercent !== undefined) plan.copayPercent = Math.max(0, Math.min(100, num(req.body.copayPercent, 10)));
  if (req.body.requiresPreauthAbove !== undefined) plan.requiresPreauthAbove = money(req.body.requiresPreauthAbove);
  if (req.body.status !== undefined) plan.status = normalizeStatus(req.body.status, ['active', 'inactive'], plan.status);
  plan.updatedAt = nowIso();

  for (const member of state.members) {
    if (member.planId === plan.id) {
      member.planName = plan.name;
      member.updatedAt = nowIso();
    }
  }

  persist();
  return res.json(plan);
});

app.get('/api/members', (req, res) => {
  const query = toStringSafe(req.query.q || '').toLowerCase();
  const status = toStringSafe(req.query.status || '').toLowerCase();
  const planId = toStringSafe(req.query.planId || '');

  const members = state.members
    .filter((member) => {
      if (status && member.status !== status) return false;
      if (planId && member.planId !== planId) return false;
      if (!query) return true;
      return [
        member.memberNumber,
        member.policyNumber,
        member.firstName,
        member.lastName,
        member.phone,
        member.email,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .map((member) => ({
      ...member,
      remaining: remainingFromMember(member),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json(members);
});

app.post('/api/members', (req, res) => {
  const planId = toStringSafe(req.body.planId);
  const plan = getPlanById(planId);

  if (!plan) {
    return res.status(400).json({ message: 'A valid planId is required.' });
  }

  const firstName = toStringSafe(req.body.firstName);
  const lastName = toStringSafe(req.body.lastName);
  if (!firstName || !lastName) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }

  const memberSequence = nextCounter('member');
  const memberNumber = normalizeMemberNumber(req.body.memberNumber || `MED-${memberSequence}`);
  if (getMemberByNumber(memberNumber)) {
    return res.status(409).json({ message: 'Member number already exists.' });
  }

  const createdAt = nowIso();
  const member = {
    id: `member-${String(memberSequence).padStart(4, '0')}`,
    memberNumber,
    policyNumber: toStringSafe(req.body.policyNumber || `POL-${Math.floor(Math.random() * 1000000)}`),
    firstName,
    lastName,
    dateOfBirth: toStringSafe(req.body.dateOfBirth),
    gender: toStringSafe(req.body.gender || ''),
    phone: toStringSafe(req.body.phone || ''),
    email: toStringSafe(req.body.email || ''),
    relationship: normalizeStatus(req.body.relationship, ['self', 'spouse', 'child', 'parent', 'dependent'], 'self'),
    status: normalizeStatus(req.body.status, ['active', 'inactive', 'suspended'], 'active'),
    planId: plan.id,
    planName: plan.name,
    notes: toStringSafe(req.body.notes || ''),
    limits: {
      annualLimit: money(req.body.annualLimit ?? plan.annualLimit),
      annualUsed: money(req.body.annualUsed ?? 0),
      outpatientLimit: money(req.body.outpatientLimit ?? plan.outpatientLimit),
      outpatientUsed: money(req.body.outpatientUsed ?? 0),
      inpatientLimit: money(req.body.inpatientLimit ?? plan.inpatientLimit),
      inpatientUsed: money(req.body.inpatientUsed ?? 0),
      perClaimLimit: money(req.body.perClaimLimit ?? plan.perClaimLimit),
    },
    createdAt,
    updatedAt: createdAt,
  };

  state.members.push(member);
  persist();
  return res.status(201).json(member);
});

app.put('/api/members/:id', (req, res) => {
  const member = getMemberById(req.params.id);
  if (!member) {
    return res.status(404).json({ message: 'Member not found.' });
  }

  if (req.body.planId) {
    const plan = getPlanById(req.body.planId);
    if (!plan) {
      return res.status(400).json({ message: 'planId is invalid.' });
    }
    member.planId = plan.id;
    member.planName = plan.name;
  }

  const fields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'email', 'policyNumber', 'notes'];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      member[field] = toStringSafe(req.body[field]);
    }
  }

  if (req.body.memberNumber !== undefined) {
    const nextMemberNumber = normalizeMemberNumber(req.body.memberNumber);
    const existing = getMemberByNumber(nextMemberNumber);
    if (existing && existing.id !== member.id) {
      return res.status(409).json({ message: 'Member number already exists.' });
    }
    member.memberNumber = nextMemberNumber;
  }

  if (req.body.status !== undefined) {
    member.status = normalizeStatus(req.body.status, ['active', 'inactive', 'suspended'], member.status);
  }

  if (req.body.relationship !== undefined) {
    member.relationship = normalizeStatus(
      req.body.relationship,
      ['self', 'spouse', 'child', 'parent', 'dependent'],
      member.relationship,
    );
  }

  const limitFields = [
    'annualLimit',
    'annualUsed',
    'outpatientLimit',
    'outpatientUsed',
    'inpatientLimit',
    'inpatientUsed',
    'perClaimLimit',
  ];
  member.limits = member.limits || {};
  for (const limitField of limitFields) {
    if (req.body[limitField] !== undefined) {
      member.limits[limitField] = money(req.body[limitField]);
    }
  }

  member.updatedAt = nowIso();
  persist();
  return res.json({ ...member, remaining: remainingFromMember(member) });
});

app.post('/api/members/:id/adjust-limits', (req, res) => {
  const member = getMemberById(req.params.id);
  if (!member) {
    return res.status(404).json({ message: 'Member not found.' });
  }

  member.limits = member.limits || {};

  if (req.body.annualLimitRemaining !== undefined) {
    const remaining = Math.max(0, money(req.body.annualLimitRemaining));
    const total = money(member.limits.annualLimit || 0);
    member.limits.annualUsed = Math.max(0, money(total - remaining));
  }

  if (req.body.outpatientLimitRemaining !== undefined) {
    const remaining = Math.max(0, money(req.body.outpatientLimitRemaining));
    const total = money(member.limits.outpatientLimit || 0);
    member.limits.outpatientUsed = Math.max(0, money(total - remaining));
  }

  if (req.body.inpatientLimitRemaining !== undefined) {
    const remaining = Math.max(0, money(req.body.inpatientLimitRemaining));
    const total = money(member.limits.inpatientLimit || 0);
    member.limits.inpatientUsed = Math.max(0, money(total - remaining));
  }

  if (req.body.perClaimLimit !== undefined) {
    member.limits.perClaimLimit = Math.max(0, money(req.body.perClaimLimit));
  }

  if (req.body.annualLimit !== undefined) {
    member.limits.annualLimit = Math.max(0, money(req.body.annualLimit));
  }
  if (req.body.outpatientLimit !== undefined) {
    member.limits.outpatientLimit = Math.max(0, money(req.body.outpatientLimit));
  }
  if (req.body.inpatientLimit !== undefined) {
    member.limits.inpatientLimit = Math.max(0, money(req.body.inpatientLimit));
  }

  if (req.body.status !== undefined) {
    member.status = normalizeStatus(req.body.status, ['active', 'inactive', 'suspended'], member.status);
  }

  member.updatedAt = nowIso();
  persist();

  return res.json({
    id: member.id,
    memberNumber: member.memberNumber,
    status: member.status,
    limits: member.limits,
    remaining: remainingFromMember(member),
  });
});

app.get('/api/members/verify', (req, res) => {
  const memberNumber = normalizeMemberNumber(req.query.memberNumber);
  const member = getMemberByNumber(memberNumber);

  if (!member) {
    return res.json({ valid: false, error: 'Member not found' });
  }

  const plan = getPlanById(member.planId);
  return res.json({
    valid: member.status === 'active',
    memberDetails: {
      memberNumber: member.memberNumber,
      name: `${member.firstName} ${member.lastName}`.trim(),
      policyNumber: member.policyNumber,
      status: member.status,
      plan: member.planName,
      coveragePercent: plan?.coveragePercent ?? null,
      copayPercent: plan?.copayPercent ?? null,
      limits: {
        ...member.limits,
        ...remainingFromMember(member),
      },
    },
  });
});

app.post('/api/members/verify', (req, res) => {
  const memberNumber = normalizeMemberNumber(req.body.memberNumber);
  const member = getMemberByNumber(memberNumber);

  if (!member) {
    return res.json({ valid: false, error: 'Member not found' });
  }

  const plan = getPlanById(member.planId);
  return res.json({
    valid: member.status === 'active',
    status: member.status,
    memberDetails: {
      memberNumber: member.memberNumber,
      name: `${member.firstName} ${member.lastName}`.trim(),
      policyNumber: member.policyNumber,
      status: member.status,
      plan: member.planName,
      coveragePercent: plan?.coveragePercent ?? null,
      copayPercent: plan?.copayPercent ?? null,
      limits: {
        ...member.limits,
        ...remainingFromMember(member),
      },
    },
  });
});

app.get('/api/preauths', (req, res) => {
  const status = toStringSafe(req.query.status).toLowerCase();
  const memberNumber = normalizeMemberNumber(req.query.memberNumber);

  const rows = state.preauths
    .filter((row) => {
      if (status && row.status !== status) return false;
      if (memberNumber && normalizeMemberNumber(row.memberNumber) !== memberNumber) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json(rows);
});

app.post('/api/preauth', (req, res) => {
  const payload = parsePreAuthPayload(req.body || {});
  const member = getMemberByNumber(payload.memberNumber);
  const plan = member ? getPlanById(member.planId) : null;

  const preauthSequence = nextCounter('preauth');
  const preAuthId = `DMA-PRE-${String(preauthSequence).padStart(6, '0')}`;
  const createdAt = nowIso();
  const claimType = inferClaimType(req.body || {});

  let status = 'approved';
  let approvedAmount = 0;
  let decisionReason = '';

  if (!member) {
    status = 'rejected';
    decisionReason = 'Member number not found.';
  } else if (member.status !== 'active') {
    status = 'rejected';
    decisionReason = `Member status is ${member.status}.`;
  } else if (!(payload.requestedAmount > 0)) {
    status = 'rejected';
    decisionReason = 'Requested amount must be greater than zero.';
  } else {
    const remaining = remainingFromMember(member);
    const bucketRemaining = claimType === 'inpatient' ? remaining.inpatientRemaining : remaining.outpatientRemaining;
    const approvable = Math.min(payload.requestedAmount, remaining.annualRemaining, bucketRemaining);

    if (!(approvable > 0)) {
      status = 'rejected';
      decisionReason = 'Available limits are exhausted.';
    } else {
      approvedAmount = money(approvable);
      if (plan?.requiresPreauthAbove && payload.requestedAmount > money(plan.requiresPreauthAbove) * 4) {
        status = 'pending';
        decisionReason = 'High-value request flagged for manual medical review.';
      } else {
        status = 'approved';
        decisionReason = 'Auto-approved by demo adjudication rules.';
      }
    }
  }

  const record = {
    id: `preauth-${String(preauthSequence).padStart(6, '0')}`,
    preAuthId,
    memberId: member?.id || null,
    memberNumber: payload.memberNumber,
    memberName: member ? `${member.firstName} ${member.lastName}`.trim() : null,
    status,
    requestType: payload.requestType,
    requestedAmount: payload.requestedAmount,
    approvedAmount,
    claimType,
    primaryDiagnosisCode: payload.primaryDiagnosisCode,
    diagnosisCodes: payload.diagnosisCodes,
    procedureCodes: payload.procedureCodes,
    serviceCodes: payload.serviceCodes,
    decisionReason,
    rawPayload: req.body || {},
    createdAt,
    updatedAt: createdAt,
  };

  state.preauths.push(record);
  persist();

  return res.json({
    success: status === 'approved' || status === 'pending',
    approved: status === 'approved',
    status,
    preAuthId,
    referenceNumber: preAuthId,
    approvedAmount,
    reason: decisionReason,
  });
});

app.get('/api/claims', (req, res) => {
  const status = toStringSafe(req.query.status).toLowerCase();
  const memberNumber = normalizeMemberNumber(req.query.memberNumber);
  const search = toStringSafe(req.query.q).toLowerCase();

  const claims = state.claims
    .filter((claim) => {
      if (status && claim.status !== status) return false;
      if (memberNumber && normalizeMemberNumber(claim.memberNumber) !== memberNumber) return false;
      if (!search) return true;
      return [claim.externalClaimId, claim.memberNumber, claim.memberName, claim.rejectionReason]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json(claims);
});

app.get('/api/claims/:id', (req, res) => {
  const claim = findClaimByAnyId(req.params.id);
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found.' });
  }

  return res.json({
    status: claim.status,
    approvedAmount: claim.approvedAmount,
    rejectionReason: claim.rejectionReason,
    details: claim,
    claimId: claim.externalClaimId,
    referenceNumber: claim.externalClaimId,
    claim,
  });
});

app.post('/api/claims', (req, res) => {
  const payload = parseClaimPayload(req.body || {});
  const member = getMemberByNumber(payload.memberNumber);
  const plan = member ? getPlanById(member.planId) : null;

  const evaluation = evaluateClaim(member, plan, payload);
  const createdAt = nowIso();
  const serial = String(nextCounter('claim')).padStart(6, '0');
  const externalClaimId = `DMA-CLM-${serial}`;

  const claim = {
    id: `claim-${serial}`,
    externalClaimId,
    referenceNumber: externalClaimId,
    source: 'ehr-api',
    memberId: member?.id || null,
    memberNumber: payload.memberNumber,
    memberName: member ? `${member.firstName} ${member.lastName}`.trim() : null,
    planId: member?.planId || null,
    planName: member?.planName || null,
    claimType: evaluation.claimType,
    status: evaluation.status,
    claimAmount: money(payload.claimAmount),
    approvedAmount: money(evaluation.approvedAmount || 0),
    copayAmount: money(evaluation.copayAmount || 0),
    payableAmount: money(evaluation.payableAmount || 0),
    rejectionReason: evaluation.rejectionReason || null,
    decisionReasons: evaluation.reasons || [],
    diagnosisCodes: payload.diagnosisCodes || [],
    primaryDiagnosisCode: payload.primaryDiagnosisCode || null,
    procedureCodes: payload.procedureCodes || [],
    serviceCodes: payload.serviceCodes || [],
    preAuthId: payload.preAuthId || null,
    appliedAmount: 0,
    rawPayload: req.body || {},
    createdAt,
    updatedAt: createdAt,
    events: [],
  };

  pushEvent(claim, 'submitted', 'Claim received from provider integration.', 'integration');
  pushEvent(
    claim,
    claim.status,
    claim.status === 'processing' ? evaluation.decisionNote || 'Pending manual review.' : claim.rejectionReason || 'Auto-adjudication completed.',
    'engine',
  );

  if (member) {
    reconcileClaimUsage(member, claim, claim.status, claim.approvedAmount);
  }

  state.claims.push(claim);
  persist();

  return res.json({
    success: true,
    status: 'submitted',
    claimId: externalClaimId,
    referenceNumber: externalClaimId,
    currentStatus: claim.status,
    approvedAmount: claim.approvedAmount,
    rejectionReason: claim.rejectionReason,
  });
});

app.put('/api/claims/:id/status', (req, res) => {
  const claim = findClaimByAnyId(req.params.id);
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found.' });
  }

  const nextStatus = normalizeStatus(
    req.body.status,
    ['draft', 'submitted', 'processing', 'suspended', 'approved', 'rejected', 'paid'],
    claim.status,
  );

  let approvedAmount = claim.approvedAmount;
  if (req.body.approvedAmount !== undefined) {
    approvedAmount = Math.max(0, money(req.body.approvedAmount));
  }

  const member = claim.memberId ? getMemberById(claim.memberId) : getMemberByNumber(claim.memberNumber);
  if (member) {
    reconcileClaimUsage(member, claim, nextStatus, approvedAmount);
  }

  claim.status = nextStatus;
  claim.approvedAmount = approvedAmount;
  claim.payableAmount = approvedAmount;
  claim.copayAmount = money(Math.max(0, money(claim.claimAmount) - approvedAmount));
  claim.rejectionReason = nextStatus === 'rejected' ? toStringSafe(req.body.rejectionReason || claim.rejectionReason || 'Rejected manually') : null;
  claim.updatedAt = nowIso();

  if (nextStatus === 'paid') {
    claim.paidAmount = req.body.paidAmount !== undefined ? money(req.body.paidAmount) : claim.approvedAmount;
  }

  pushEvent(claim, nextStatus, toStringSafe(req.body.note || 'Status updated from provider portal.'), 'operator');
  persist();

  return res.json({
    status: claim.status,
    approvedAmount: claim.approvedAmount,
    rejectionReason: claim.rejectionReason,
    details: claim,
  });
});

app.get('/api/claims/:id/history', (req, res) => {
  const claim = findClaimByAnyId(req.params.id);
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found.' });
  }

  return res.json({
    externalClaimId: claim.externalClaimId,
    status: claim.status,
    events: claim.events || [],
  });
});

app.get('/api/export/:dataset', (req, res) => {
  const dataset = toStringSafe(req.params.dataset).toLowerCase();
  const fileMap = {
    'plans.csv': CSV_FILES.plans,
    'members.csv': CSV_FILES.members,
    'claims.csv': CSV_FILES.claims,
    'preauths.csv': CSV_FILES.preauths,
  };

  const filePath = fileMap[dataset];
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Export not found.' });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${dataset}"`);
  return res.sendFile(filePath);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

loadState();

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`medical-aid-demo-service listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`data directory: ${DATA_DIR}`);
});
