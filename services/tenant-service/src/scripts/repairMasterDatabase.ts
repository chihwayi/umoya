import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from '../services/database-provisioning.service';

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseBundles(raw: string | undefined): string[] {
  const fallback = ['sprint114_clinical_rag', 'sprint116_risk_stratification_self_learning'];
  if (!raw) {
    return fallback;
  }

  const bundles = raw
    .split(',')
    .map((bundle) => bundle.trim())
    .filter(Boolean);

  return bundles.length > 0 ? bundles : fallback;
}

async function main() {
  const masterUrl = process.env.DATABASE_URL;
  if (!masterUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const strict = parseBooleanEnv(process.env.REPAIR_STRICT, true);
  const bundles = parseBundles(process.env.MASTER_PROVISION_BUNDLES);

  const master = new DataSource({ type: 'postgres', url: masterUrl });
  await master.initialize();

  try {
    const prov = new DatabaseProvisioningService(master);
    console.log(`Applying bundles [${bundles.join(', ')}] to master database [strict=${strict}]`);

    const result = await prov.applyClinicSchema(masterUrl, {
      strict,
      bundles,
      appliedBy: 'repair_master_database_script',
    });

    if (result.pendingBundles.length > 0) {
      const message = result.pendingBundles
        .map((bundle) => `${bundle.bundleId} (${bundle.lastError})`)
        .join('; ');
      console.error(`⚠️ Master database still has unresolved bundles: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.log('✅ Master database provisioning completed');
  } finally {
    await master.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
