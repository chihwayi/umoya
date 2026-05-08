import React, { useMemo, useState } from 'react';
import { migrationAPI } from '../services/api';
import type { MigrationDryRunResult, MigrationImportResult, MigrationJob, Tenant } from '../types';

interface DataMigrationPanelProps {
  tenants: Tenant[];
}

function Metric({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
      <p className="text-[10px] font-semibold text-[#7A9AB8]">{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

export function DataMigrationPanel({ tenants }: DataMigrationPanelProps) {
  const activeTenants = useMemo(() => tenants.filter((tenant) => tenant.status !== 'cancelled'), [tenants]);
  const [tenantId, setTenantId] = useState(activeTenants[0]?.id || '');
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [dryRun, setDryRun] = useState<MigrationDryRunResult | null>(null);
  const [importResult, setImportResult] = useState<MigrationImportResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTenant = activeTenants.find((tenant) => tenant.id === tenantId);
  const canImport = Boolean(job && dryRun && dryRun.errorRows === 0);

  const resetResults = () => {
    setJob(null);
    setDryRun(null);
    setImportResult(null);
    setError(null);
  };

  const upload = async () => {
    if (!tenantId || !file) {
      setError('Choose a tenant and a CSV file first.');
      return;
    }
    setLoading('upload');
    setError(null);
    setDryRun(null);
    setImportResult(null);
    try {
      const uploaded = await migrationAPI.uploadMigrationFile(tenantId, file);
      setJob(uploaded);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(null);
    }
  };

  const runDryRun = async () => {
    if (!tenantId || !job) return;
    setLoading('dry-run');
    setError(null);
    try {
      const result = await migrationAPI.runDryRun(tenantId, job.id);
      setDryRun(result);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Dry run failed');
    } finally {
      setLoading(null);
    }
  };

  const runImport = async () => {
    if (!tenantId || !job) return;
    setLoading('import');
    setError(null);
    try {
      const result = await migrationAPI.importMigration(tenantId, job.id);
      setImportResult(result);
    } catch (err: any) {
      const message = err.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || err.message || 'Import failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#2B7FFF]/20 bg-gradient-to-br from-[#2B7FFF]/[0.06] to-[#00C896]/[0.04] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#5A9AFF]">Patient Data Migration</p>
            <h2 className="mt-1 text-xl font-black text-white">Dry-run CSV import toolkit</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#7A9AB8]">
              Upload patient CSV files, validate rows against the tenant database, and import only safe non-duplicate records.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                resetResults();
              }}
              className="min-w-[16rem] rounded-xl border border-white/[0.08] bg-[#08101D] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#2B7FFF]/60"
            >
              {activeTenants.length === 0 && <option value="">No tenants available</option>}
              {activeTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.clinicName}</option>
              ))}
            </select>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-bold text-[#C5D5EE] hover:bg-white/[0.07]">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  resetResults();
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">{selectedTenant?.clinicName || 'Select a tenant'}</p>
              <p className="mt-1 text-xs text-[#7A9AB8]">{file?.name || 'No CSV selected'}</p>
            </div>
            {job && (
              <span className="rounded-full border border-[#00C896]/25 bg-[#00C896]/10 px-2.5 py-1 text-[10px] font-bold text-[#00C896]">
                {job.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={upload}
              disabled={loading !== null || !file || !tenantId}
              className="rounded-xl bg-[#2B7FFF] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#4A93FF] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading === 'upload' ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={runDryRun}
              disabled={loading !== null || !job}
              className="rounded-xl border border-[#00C896]/30 bg-[#00C896]/10 px-4 py-2.5 text-sm font-black text-[#00C896] transition hover:bg-[#00C896]/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading === 'dry-run' ? 'Checking...' : 'Dry Run'}
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={loading !== null || !canImport}
              className="rounded-xl border border-[#FFB020]/30 bg-[#FFB020]/10 px-4 py-2.5 text-sm font-black text-[#FFD27A] transition hover:bg-[#FFB020]/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading === 'import' ? 'Importing...' : 'Import'}
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4A6A8A]">Accepted columns</p>
            <p className="mt-2 text-xs leading-6 text-[#9BB0CA]">
              first_name, last_name, date_of_birth, gender, patient_number, id_number, phone, email, address, city,
              emergency_contact_name, emergency_contact_phone, medical_aid_name, medical_aid_number, allergies, chronic_conditions.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Rows" value={dryRun?.totalRows ?? job?.totalRows ?? 0} color="#2B7FFF" />
            <Metric label="Valid" value={dryRun?.validRows ?? 0} color="#00C896" />
            <Metric label="Duplicates" value={dryRun?.duplicateRows ?? 0} color="#FFB020" />
            <Metric label="Errors" value={dryRun?.errorRows ?? 0} color="#FF4D6A" />
          </div>

          {importResult && (
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Inserted" value={importResult.insertedRows} color="#00C896" />
              <Metric label="Skipped" value={importResult.skippedRows} color="#FFB020" />
              <Metric label="Failed" value={importResult.failedRows} color="#FF4D6A" />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A1525]/80">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-sm font-bold text-white">Validation Issues</p>
            </div>
            {!dryRun || dryRun.issues.length === 0 ? (
              <div className="p-6 text-sm text-[#7A9AB8]">
                {dryRun ? 'No issues found. This file is ready to import.' : 'Run a dry-run to review errors and duplicates.'}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.06]">
                {dryRun.issues.map((issue, index) => (
                  <div key={`${issue.rowNumber}-${issue.field}-${index}`} className="grid gap-2 px-4 py-3 md:grid-cols-[5rem_7rem_1fr] md:items-center">
                    <span className="text-xs font-mono text-[#7A9AB8]">Row {issue.rowNumber}</span>
                    <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold ${
                      issue.severity === 'error'
                        ? 'border-red-400/25 bg-red-400/10 text-red-200'
                        : 'border-yellow-400/25 bg-yellow-400/10 text-yellow-200'
                    }`}>
                      {issue.severity}
                    </span>
                    <span className="text-sm text-[#C5D5EE]">{issue.field ? `${issue.field}: ` : ''}{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
