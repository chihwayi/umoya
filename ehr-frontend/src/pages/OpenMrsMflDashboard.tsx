import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Link2, RefreshCw, Send, UploadCloud } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'links' | 'logs' | 'facilities';

interface OpenMrsMflDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface LinkRow {
  id: string;
  patientId: string;
  openmrsUuid: string;
  openmrsBaseUrl: string;
  syncStatus: string;
  lastSyncedAt: string | null;
}

interface LogRow {
  id: string;
  patientId: string | null;
  openmrsUuid: string | null;
  direction: string;
  resourceType: string;
  status: string;
  errorMessage: string | null;
  syncedAt: string;
}

interface FacilityRow {
  id: string;
  mflCode: string;
  facilityName: string;
  county: string | null;
  facilityType: string | null;
  phone: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
}

const authHeaders = (token: string, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': tenantSlug,
});

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
      active
        ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const OpenMrsMflDashboard: React.FC<OpenMrsMflDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('links');
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [facilitiesTotal, setFacilitiesTotal] = useState(0);

  const [linkForm, setLinkForm] = useState({
    patientId: '',
    openmrsUuid: '',
    openmrsBaseUrl: '',
  });

  const [logFilters, setLogFilters] = useState({
    direction: '',
    page: 1,
    limit: 20,
  });

  const [facilityFilters, setFacilityFilters] = useState({
    county: '',
    search: '',
    page: 1,
    limit: 20,
  });

  const headers = useMemo(() => authHeaders(token, tenantSlug), [token, tenantSlug]);

  const loadLinks = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/openmrs/links', { headers });
    setLinks(Array.isArray(data) ? data : []);
  }, [headers, tenantSlug, token]);

  const loadLogs = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/openmrs/sync-logs', {
      headers,
      params: logFilters,
    });
    setLogs(Array.isArray(data?.data) ? data.data : []);
    setLogsTotal(Number(data?.total || 0));
  }, [headers, logFilters, tenantSlug, token]);

  const loadFacilities = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/mfl/facilities', {
      headers,
      params: facilityFilters,
    });
    setFacilities(Array.isArray(data?.data) ? data.data : []);
    setFacilitiesTotal(Number(data?.total || 0));
  }, [facilityFilters, headers, tenantSlug, token]);

  const refreshAll = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await Promise.all([loadLinks(), loadLogs(), loadFacilities()]);
    } catch (error: any) {
      showError('Refresh failed', apiError(error, 'Unable to load OpenMRS and Kenya MFL data.'));
    } finally {
      setLoading(false);
    }
  }, [loadFacilities, loadLinks, loadLogs, showError, tenantSlug, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleLinkPatient = async () => {
    if (!linkForm.patientId.trim() || !linkForm.openmrsUuid.trim() || !linkForm.openmrsBaseUrl.trim()) {
      showError('Missing fields', 'Patient ID, OpenMRS UUID, and base URL are all required.');
      return;
    }

    try {
      await ehrAxios.post('/openmrs/link', linkForm, { headers });
      showSuccess('Patient linked', 'The patient is now connected to the OpenMRS instance.');
      setLinkForm({ patientId: '', openmrsUuid: '', openmrsBaseUrl: '' });
      await Promise.all([loadLinks(), loadLogs()]);
    } catch (error: any) {
      showError('Link failed', apiError(error, 'Unable to create or update the OpenMRS patient link.'));
    }
  };

  const handlePush = async (patientId: string) => {
    try {
      await ehrAxios.post(`/openmrs/${patientId}/push`, {}, { headers });
      showSuccess('Push complete', 'The local patient resource was pushed to OpenMRS.');
      await Promise.all([loadLinks(), loadLogs()]);
    } catch (error: any) {
      showError('Push failed', apiError(error, 'Unable to push the patient resource to OpenMRS.'));
    }
  };

  const handlePull = async (patientId: string) => {
    try {
      await ehrAxios.get(`/openmrs/${patientId}/pull`, { headers });
      showSuccess('Pull complete', 'The patient record was refreshed from OpenMRS.');
      await Promise.all([loadLinks(), loadLogs()]);
    } catch (error: any) {
      showError('Pull failed', apiError(error, 'Unable to pull the patient resource from OpenMRS.'));
    }
  };

  const handleSyncFacilities = async () => {
    try {
      const { data } = await ehrAxios.post('/mfl/sync', {}, { headers });
      showSuccess('MFL sync finished', `Synced ${Number(data?.synced || 0)} facility record(s).`);
      await loadFacilities();
    } catch (error: any) {
      showError('MFL sync failed', apiError(error, 'Unable to sync facilities from the Kenya MFL API.'));
    }
  };

  const totalLogPages = Math.max(1, Math.ceil(logsTotal / logFilters.limit));
  const totalFacilityPages = Math.max(1, Math.ceil(facilitiesTotal / facilityFilters.limit));

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}`)}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to EHR
            </button>
            <h1 className="text-3xl font-semibold text-white">OpenMRS FHIR & Kenya MFL</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Manage OpenMRS patient cross-links, review sync activity, and keep tenant facility references aligned with the Kenya Master Facility List.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <TabButton active={tab === 'links'} icon={<Link2 className="h-4 w-4" />} label="OpenMRS Links" onClick={() => setTab('links')} />
          <TabButton active={tab === 'logs'} icon={<UploadCloud className="h-4 w-4" />} label="Sync Logs" onClick={() => setTab('logs')} />
          <TabButton active={tab === 'facilities'} icon={<Building2 className="h-4 w-4" />} label="MFL Facilities" onClick={() => setTab('facilities')} />
        </div>

        {tab === 'links' && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Link Patient to OpenMRS</h2>
              <div className="mt-4 space-y-3">
                <input
                  value={linkForm.patientId}
                  onChange={(event) => setLinkForm((current) => ({ ...current, patientId: event.target.value }))}
                  placeholder="Patient ID"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <input
                  value={linkForm.openmrsUuid}
                  onChange={(event) => setLinkForm((current) => ({ ...current, openmrsUuid: event.target.value }))}
                  placeholder="OpenMRS UUID"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <input
                  value={linkForm.openmrsBaseUrl}
                  onChange={(event) => setLinkForm((current) => ({ ...current, openmrsBaseUrl: event.target.value }))}
                  placeholder="https://openmrs.example.org"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleLinkPatient}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  <Link2 className="h-4 w-4" />
                  Save Link
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-lg font-semibold text-white">Linked Patients</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950/60 text-left text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient ID</th>
                      <th className="px-4 py-3 font-medium">OpenMRS UUID</th>
                      <th className="px-4 py-3 font-medium">Sync Status</th>
                      <th className="px-4 py-3 font-medium">Last Synced</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {links.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-950/40">
                        <td className="px-4 py-3 text-white">{row.patientId}</td>
                        <td className="px-4 py-3 text-slate-300">{row.openmrsUuid}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.syncStatus === 'synced'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : row.syncStatus === 'failed'
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-amber-500/15 text-amber-300'
                          }`}>
                            {row.syncStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : 'Never'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handlePush(row.patientId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:text-white"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Push
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePull(row.patientId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:text-white"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Pull
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!links.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No OpenMRS patient links yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-white">OpenMRS Sync Logs</h2>
              <div className="flex flex-wrap gap-3">
                <select
                  value={logFilters.direction}
                  onChange={(event) => setLogFilters((current) => ({ ...current, direction: event.target.value, page: 1 }))}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">All directions</option>
                  <option value="push">Push</option>
                  <option value="pull">Pull</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadLogs()}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/60 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Direction</th>
                    <th className="px-4 py-3 font-medium">Resource</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                    <th className="px-4 py-3 font-medium">Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-950/40">
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.direction === 'push' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-violet-500/15 text-violet-300'
                        }`}>
                          {row.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{row.resourceType}</td>
                      <td className="px-4 py-3 text-slate-300">{row.status}</td>
                      <td className="px-4 py-3 text-slate-300">{row.patientId || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.errorMessage || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(row.syncedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!logs.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No sync log entries found for this tenant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Page {logFilters.page} of {totalLogPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={logFilters.page <= 1}
                  onClick={() => setLogFilters((current) => ({ ...current, page: current.page - 1 }))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={logFilters.page >= totalLogPages}
                  onClick={() => setLogFilters((current) => ({ ...current, page: current.page + 1 }))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'facilities' && (
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-white">Kenya MFL Facilities</h2>
              <div className="flex flex-wrap gap-3">
                <input
                  value={facilityFilters.search}
                  onChange={(event) => setFacilityFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
                  placeholder="Search name or MFL code"
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <input
                  value={facilityFilters.county}
                  onChange={(event) => setFacilityFilters((current) => ({ ...current, county: event.target.value, page: 1 }))}
                  placeholder="County"
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => void loadFacilities()}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={handleSyncFacilities}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  <UploadCloud className="h-4 w-4" />
                  Sync from Kenya MFL
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/60 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">MFL Code</th>
                    <th className="px-4 py-3 font-medium">Facility</th>
                    <th className="px-4 py-3 font-medium">County</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {facilities.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-950/40">
                      <td className="px-4 py-3 text-white">{row.mflCode}</td>
                      <td className="px-4 py-3 text-slate-300">{row.facilityName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.county || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{row.facilityType || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{row.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!facilities.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No MFL facilities available yet. Run a sync to populate this tenant cache.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Page {facilityFilters.page} of {totalFacilityPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={facilityFilters.page <= 1}
                  onClick={() => setFacilityFilters((current) => ({ ...current, page: current.page - 1 }))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={facilityFilters.page >= totalFacilityPages}
                  onClick={() => setFacilityFilters((current) => ({ ...current, page: current.page + 1 }))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenMrsMflDashboard;
