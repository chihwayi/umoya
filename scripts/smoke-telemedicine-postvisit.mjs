#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EHR_BASE_URL = (process.env.EHR_BASE_URL || 'http://localhost:3013').replace(/\/+$/, '');
const EHR_API_BASE = `${EHR_BASE_URL}/api`;
const TENANT_ID = process.env.TENANT_ID || 'kids-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'mumu@gmail.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Password1#';
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 25000);

const runStartedAt = new Date();
const stamp = runStartedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.resolve(process.cwd(), 'reports');
const reportPath = path.join(reportDir, `smoke-telemedicine-postvisit-${stamp}.json`);

const report = {
  startedAt: runStartedAt.toISOString(),
  environment: {
    EHR_BASE_URL,
    EHR_API_BASE,
    TENANT_ID,
    doctorEmail: DOCTOR_EMAIL,
  },
  artifacts: {},
  steps: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    criticalFailed: 0,
  },
};

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clip(value, max = 500) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

function createSilentWavBuffer(durationSeconds = 1, sampleRate = 16000) {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Remaining payload is silence (already zero-filled)
  return buffer;
}

async function httpRequest({
  label,
  method = 'GET',
  url,
  token,
  tenantId,
  json,
  formData,
  headers = {},
  expectedStatus = [200, 201],
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = { ...headers };

  if (tenantId) requestHeaders['X-Tenant-ID'] = tenantId;
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (json !== undefined) requestHeaders['Content-Type'] = 'application/json';

  let response;
  let text = '';
  let parsed = null;
  let ok = false;
  let error = null;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: json !== undefined ? JSON.stringify(json) : formData || undefined,
      signal: controller.signal,
    });

    text = await response.text();
    parsed = safeJsonParse(text);
    ok = expectedStatus.includes(response.status);
    if (!ok) {
      error = `HTTP ${response.status} for ${method} ${url}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  report.steps.push({
    label,
    ok,
    method,
    url,
    status: response?.status || null,
    error,
    responsePreview: parsed ? clip(parsed) : clip(text),
  });

  if (!ok) {
    const detail = parsed?.message || parsed?.error || error || 'Request failed';
    throw new Error(`${label} failed: ${detail}`);
  }

  return {
    status: response.status,
    data: parsed ?? text,
  };
}

async function runStep(label, fn, options = {}) {
  const { critical = true } = options;
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.steps.push({
      label: `${label} (exception)`,
      ok: false,
      method: 'N/A',
      url: 'N/A',
      status: null,
      error: message,
      responsePreview: '',
      critical,
    });
    if (critical) throw err;
  }
}

function summarize() {
  const total = report.steps.length;
  const passed = report.steps.filter((step) => step.ok).length;
  const failed = total - passed;
  const criticalFailed = report.steps.filter((step) => step.method === 'N/A' && step.critical).length;
  report.summary = { total, passed, failed, criticalFailed };
}

async function main() {
  let token = '';
  let doctorUserId = '';
  let patientId = '';
  let consultationId = '';
  let postVisitSessionId = '';

  const uniqueSuffix = `${Date.now()}`.slice(-8);

  await runStep('Login doctor', async () => {
    const res = await httpRequest({
      label: 'Doctor login',
      method: 'POST',
      url: `${EHR_API_BASE}/auth/login`,
      tenantId: TENANT_ID,
      json: { email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD },
    });
    token = res.data?.token;
    doctorUserId = res.data?.user?.id;
    if (!token || !doctorUserId) {
      throw new Error('Doctor login missing token or user ID');
    }
    report.artifacts.doctorUserId = doctorUserId;
  });

  await runStep('Create smoke patient', async () => {
    const payload = {
      firstName: `Tele${uniqueSuffix.slice(0, 4)}`,
      lastName: `Post${uniqueSuffix.slice(4)}`,
      dateOfBirth: '1992-03-10',
      gender: 'female',
      nationalId: `63-${uniqueSuffix}-T-90`,
      phone: `+26377${uniqueSuffix}`,
      email: `tele.post.${uniqueSuffix}@example.com`,
      address: '11 Workflow Avenue',
      city: 'Harare',
      emergencyContactName: 'Tele Smoke',
      emergencyContactPhone: `+26378${uniqueSuffix}`,
      emergencyContactRelationship: 'Sibling',
      medicalHistory: 'Telemedicine and post-visit AI smoke test',
    };
    const res = await httpRequest({
      label: 'Patient create',
      method: 'POST',
      url: `${EHR_API_BASE}/patients`,
      tenantId: TENANT_ID,
      token,
      json: payload,
      expectedStatus: [201],
    });
    patientId = res.data?.id;
    if (!patientId) throw new Error('Patient ID missing from create response');
    report.artifacts.patient = {
      id: patientId,
      patientNumber: res.data?.patientNumber || null,
      name: `${res.data?.firstName || payload.firstName} ${res.data?.lastName || payload.lastName}`,
    };
  });

  await runStep('Create telemedicine consultation', async () => {
    const scheduledStartTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const res = await httpRequest({
      label: 'Telemedicine consultation create',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations`,
      tenantId: TENANT_ID,
      token,
      json: {
        patientId,
        doctorId: doctorUserId,
        consultationType: 'video',
        scheduledStartTime,
      },
      expectedStatus: [201, 200],
    });
    consultationId = res.data?.id;
    if (!consultationId) throw new Error('Consultation ID missing');
    report.artifacts.consultation = {
      id: consultationId,
      scheduledStartTime,
    };
  });

  await runStep('Join doctor to consultation', async () => {
    await httpRequest({
      label: 'Telemedicine join doctor',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/join`,
      tenantId: TENANT_ID,
      token,
      json: {
        userId: doctorUserId,
        role: 'doctor',
      },
    });
  });

  await runStep('Join patient to consultation (simulated)', async () => {
    await httpRequest({
      label: 'Telemedicine join patient',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/join`,
      tenantId: TENANT_ID,
      token,
      json: {
        userId: patientId,
        role: 'patient',
      },
    });
  });

  await runStep('Fetch meeting URL', async () => {
    const res = await httpRequest({
      label: 'Telemedicine meeting URL',
      method: 'GET',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/meeting-url`,
      tenantId: TENANT_ID,
      token,
    });
    const meetingUrl = res.data?.meetingUrl || res.data?.meeting_url || null;
    report.artifacts.meetingUrl = meetingUrl;
  });

  await runStep('Record telemedicine technical issue', async () => {
    await httpRequest({
      label: 'Telemedicine technical issue',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/technical-issue`,
      tenantId: TENANT_ID,
      token,
      json: {
        consultationId,
        logType: 'connection_issue',
        severity: 'medium',
        description: 'Smoke test transient jitter event',
      },
      expectedStatus: [201, 200],
    });
  }, { critical: false });

  await runStep('Update connection quality', async () => {
    await httpRequest({
      label: 'Telemedicine connection quality',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/connection-quality?role=doctor&quality=good`,
      tenantId: TENANT_ID,
      token,
      expectedStatus: [200, 201],
    });
  }, { critical: false });

  await runStep('Grant and check consent', async () => {
    await httpRequest({
      label: 'Telemedicine grant consent',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consents`,
      tenantId: TENANT_ID,
      token,
      json: {
        patientId,
        consentType: 'general_telehealth',
        consentStatus: 'granted',
      },
      expectedStatus: [201, 200, 400],
    });

    const check = await httpRequest({
      label: 'Telemedicine check consent',
      method: 'GET',
      url: `${EHR_API_BASE}/telemedicine/consents/check?patientId=${encodeURIComponent(patientId)}&consentType=general_telehealth`,
      tenantId: TENANT_ID,
      token,
    });
    if (check.data?.hasConsent !== true) {
      throw new Error('Expected active general telehealth consent');
    }
  });

  await runStep('Record remote monitoring readings + verify alert', async () => {
    await httpRequest({
      label: 'Telemedicine monitoring normal',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/monitoring/readings`,
      tenantId: TENANT_ID,
      token,
      json: {
        patientId,
        monitoringType: 'blood_glucose',
        readingValue: 128,
        readingUnit: 'mg/dL',
        notes: 'Normal follow-up value',
      },
      expectedStatus: [201, 200],
    });

    await httpRequest({
      label: 'Telemedicine monitoring critical',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/monitoring/readings`,
      tenantId: TENANT_ID,
      token,
      json: {
        patientId,
        monitoringType: 'blood_glucose',
        readingValue: 282,
        readingUnit: 'mg/dL',
        notes: 'Critical smoke test alert value',
      },
      expectedStatus: [201, 200],
    });

    const alerts = await httpRequest({
      label: 'Telemedicine monitoring alerts list',
      method: 'GET',
      url: `${EHR_API_BASE}/telemedicine/monitoring/alerts`,
      tenantId: TENANT_ID,
      token,
    });
    const rows = Array.isArray(alerts.data) ? alerts.data : [];
    const hasPatientAlert = rows.some((row) => row?.patient_id === patientId || row?.patientId === patientId);
    if (!hasPatientAlert) {
      throw new Error('Expected at least one active monitoring alert for smoke patient');
    }
    report.artifacts.monitoringAlertCount = rows.length;
  });

  await runStep('End consultation and verify completion', async () => {
    await httpRequest({
      label: 'Telemedicine end consultation',
      method: 'POST',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}/end`,
      tenantId: TENANT_ID,
      token,
      expectedStatus: [200, 201],
    });

    const consultation = await httpRequest({
      label: 'Telemedicine get consultation after end',
      method: 'GET',
      url: `${EHR_API_BASE}/telemedicine/consultations/${consultationId}`,
      tenantId: TENANT_ID,
      token,
    });
    if (String(consultation.data?.status || '').toLowerCase() !== 'completed') {
      throw new Error('Consultation did not transition to completed');
    }

    const bills = await httpRequest({
      label: 'Billing list by patient',
      method: 'GET',
      url: `${EHR_API_BASE}/billing/bills?patientId=${encodeURIComponent(patientId)}&limit=20&page=1`,
      tenantId: TENANT_ID,
      token,
    });
    const rows = Array.isArray(bills.data?.bills) ? bills.data.bills : [];
    const teleBill = rows.find((row) =>
      String(row?.notes || '').toLowerCase().includes('telemedicine consultation completed'),
    );
    if (!teleBill) {
      throw new Error('Expected telemedicine bill entry for completed consultation');
    }
    report.artifacts.telemedicineBillId = teleBill.id;
  });

  await runStep('Create post-visit session from consultation', async () => {
    const res = await httpRequest({
      label: 'Post-visit create session',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions`,
      tenantId: TENANT_ID,
      token,
      json: {
        patientId,
        consultationId,
        sourceType: 'telemedicine',
        language: 'en',
      },
      expectedStatus: [201, 200],
    });
    postVisitSessionId = res.data?.id;
    if (!postVisitSessionId) throw new Error('Post-visit session ID missing');
    report.artifacts.postVisitSessionId = postVisitSessionId;
  });

  await runStep('Publish safety gate before review (expected failure)', async () => {
    await httpRequest({
      label: 'Post-visit publish pre-review gate',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/publish`,
      tenantId: TENANT_ID,
      token,
      json: {
        note: 'Pre-review gate check',
      },
      expectedStatus: [400, 403, 409],
    });
  }, { critical: false });

  await runStep('Transcribe session audio + generate draft artifacts', async () => {
    const wavBuffer = createSilentWavBuffer(1, 16000);
    const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const form = new FormData();
    form.append('audio', audioBlob, `tele-post-smoke-${Date.now()}.wav`);
    form.append('language', 'en');
    form.append('temperature', '0');
    form.append('prompt', 'Medical consultation smoke test. Include clinical details.');

    const transcribeRes = await httpRequest({
      label: 'Post-visit transcribe session',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/transcribe`,
      tenantId: TENANT_ID,
      token,
      formData: form,
      expectedStatus: [200, 201],
      timeoutMs: Math.max(REQUEST_TIMEOUT_MS, 120000),
    });
    report.artifacts.transcriptionSummary = {
      language: transcribeRes.data?.transcription?.language || transcribeRes.data?.transcript?.language || null,
      textPreview: clip(
        transcribeRes.data?.transcription?.text ||
          transcribeRes.data?.transcript?.text ||
          transcribeRes.data?.text ||
          '',
        180,
      ),
    };

    const draft = await httpRequest({
      label: 'Post-visit draft fetch',
      method: 'GET',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/draft`,
      tenantId: TENANT_ID,
      token,
    });
    const artifacts = Array.isArray(draft.data?.artifacts) ? draft.data.artifacts : [];
    const artifactTypes = artifacts.map((row) => row?.type).filter(Boolean);
    if (!artifactTypes.includes('visit_summary') || !artifactTypes.includes('recommendation_bundle')) {
      throw new Error(`Expected visit_summary and recommendation_bundle artifacts, got: ${artifactTypes.join(', ')}`);
    }
    report.artifacts.draftArtifactTypes = artifactTypes;
  });

  await runStep('Run intra-visit audio safety analysis', async () => {
    const wavBuffer = createSilentWavBuffer(1, 16000);
    const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const form = new FormData();
    form.append('audio', audioBlob, `intravisit-smoke-${Date.now()}.wav`);

    const res = await httpRequest({
      label: 'Post-visit intravisit analyze audio',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/intravisit/analyze-audio`,
      tenantId: TENANT_ID,
      token,
      formData: form,
      expectedStatus: [200, 201],
      timeoutMs: Math.max(REQUEST_TIMEOUT_MS, 120000),
    });

    if (!res.data || typeof res.data !== 'object') {
      throw new Error('Intra-visit audio response missing payload');
    }
    if (!Object.prototype.hasOwnProperty.call(res.data, 'transcript')) {
      throw new Error('Intra-visit audio response missing transcript');
    }
  }, { critical: false });

  await runStep('Run intra-visit text safety analysis', async () => {
    await httpRequest({
      label: 'Post-visit intravisit analyze text',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/intravisit/analyze`,
      tenantId: TENANT_ID,
      token,
      json: {
        text: 'Patient reports crushing chest pain and severe shortness of breath with dizziness.',
        source: 'smoke_test_script',
      },
      expectedStatus: [200, 201],
    });
  }, { critical: false });

  await runStep('Review summary and recommendation artifacts', async () => {
    await httpRequest({
      label: 'Post-visit review visit summary',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/review`,
      tenantId: TENANT_ID,
      token,
      json: {
        artifactType: 'visit_summary',
        action: 'accept',
        reason: 'Smoke validation acceptance',
      },
      expectedStatus: [200, 201],
    });

    await httpRequest({
      label: 'Post-visit review recommendation bundle',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/review`,
      tenantId: TENANT_ID,
      token,
      json: {
        artifactType: 'recommendation_bundle',
        action: 'accept',
        reason: 'Smoke validation acceptance',
      },
      expectedStatus: [200, 201],
    });
  });

  await runStep('Publish post-visit session with safety acknowledgements', async () => {
    const draft = await httpRequest({
      label: 'Post-visit draft for publish acknowledgements',
      method: 'GET',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/draft`,
      tenantId: TENANT_ID,
      token,
    });
    const superseded = (Array.isArray(draft.data?.ruleCitations) ? draft.data.ruleCitations : [])
      .filter((row) => row?.isSuperseded === true)
      .map((row) => row?.id)
      .filter(Boolean);

    const publishPayload = {
      note: 'Smoke publish after doctor review',
      publishMetadata: { source: 'smoke_tele_post_script' },
      acknowledgedSupersededCitationIds: superseded,
      acknowledgedMedicationHighRisk: true,
    };

    const published = await httpRequest({
      label: 'Post-visit publish',
      method: 'POST',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/publish`,
      tenantId: TENANT_ID,
      token,
      json: publishPayload,
      expectedStatus: [200, 201],
    });
    report.artifacts.publishStatus = published.data?.status || null;
  });

  await runStep('Validate FHIR projection export', async () => {
    const fhir = await httpRequest({
      label: 'Post-visit FHIR projection',
      method: 'GET',
      url: `${EHR_API_BASE}/post-visit/sessions/${postVisitSessionId}/fhir`,
      tenantId: TENANT_ID,
      token,
      expectedStatus: [200],
    });
    const exportVersion = fhir.data?.exportVersion || null;
    if (!exportVersion) {
      throw new Error('FHIR projection missing exportVersion');
    }
    report.artifacts.fhirExportVersion = exportVersion;
  });
}

main()
  .then(() => {
    summarize();
    report.completedAt = new Date().toISOString();
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Smoke telemedicine+post-visit complete. Report: ${reportPath}`);
  })
  .catch((error) => {
    summarize();
    report.completedAt = new Date().toISOString();
    report.failure = error instanceof Error ? error.message : String(error);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(`Smoke telemedicine+post-visit failed. Report: ${reportPath}`);
    console.error(report.failure);
    process.exitCode = 1;
  });
