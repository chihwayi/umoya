import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const scenario = process.argv[2] || 'all';

function assertFilesExist(label, files) {
  const missing = files.filter((file) => !fs.existsSync(path.join(cwd, file)));
  if (missing.length > 0) {
    throw new Error(`${label}: missing files -> ${missing.join(', ')}`);
  }
  console.log(`[mobile-app:e2e] ${label}: ok (${files.length} checks)`);
}

function runTenantAndAuthSmoke() {
  assertFilesExist('tenant-auth-shell', [
    'src/app/index.tsx',
    'src/app/clinic/select.tsx',
    'src/app/clinic/confirm.tsx',
    'src/app/auth/provider-login.tsx',
    'src/app/auth/patient-login.tsx',
    'src/services/api/tenant.ts',
    'src/lib/tenant/tenant-resolver.ts'
  ]);
}

function runProviderSmoke() {
  assertFilesExist('provider-workflows', [
    'src/app/doctor/rounds.tsx',
    'src/app/doctor/postvisit.tsx',
    'src/app/doctor/messages.tsx',
    'src/app/nurse/shift.tsx',
    'src/app/nurse/vitals.tsx',
    'src/features/provider/hooks/useProviderWorkflows.ts',
    'src/services/api/provider.ts'
  ]);
}

function runPatientSmoke() {
  assertFilesExist('patient-workflows', [
    'src/app/patient/home.tsx',
    'src/app/patient/postvisit.tsx',
    'src/app/patient/medications.tsx',
    'src/app/patient/bills.tsx',
    'src/app/patient/my-health.tsx',
    'src/features/patient/hooks/usePatientHome.ts',
    'src/services/api/patient.ts'
  ]);
}

function runReleaseHardeningSmoke() {
  assertFilesExist('release-hardening', [
    'src/app/notifications.tsx',
    'src/app/_layout.tsx',
    'src/lib/auth/invalidation.ts',
    'src/lib/network/online-policy.ts',
    'src/lib/security/device-security.ts',
    'src/lib/observability/mobile-metrics.ts',
    'src/features/shared/ui/LogoutButton.tsx'
  ]);
}

try {
  if (scenario === 'all') {
    runTenantAndAuthSmoke();
    runProviderSmoke();
    runPatientSmoke();
    runReleaseHardeningSmoke();
  } else if (scenario === 'tenant-auth') {
    runTenantAndAuthSmoke();
  } else if (scenario === 'provider-workflows') {
    runProviderSmoke();
  } else if (scenario === 'patient-workflows') {
    runPatientSmoke();
  } else if (scenario === 'release-hardening') {
    runReleaseHardeningSmoke();
  } else {
    throw new Error(`Unknown scenario \"${scenario}\".`);
  }

  console.log(`[mobile-app:e2e] Scenario \"${scenario}\" smoke checks passed.`);
} catch (error) {
  console.error(`[mobile-app:e2e] Scenario \"${scenario}\" failed.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
