import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Syringe,
  AlertTriangle,
  Thermometer,
  Users,
  BarChart3,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

const authHeaders = (token: string, tenantSlug: string) => ({
  'X-Tenant-ID': tenantSlug,
  Authorization: `Bearer ${token}`,
});

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    given: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    due: 'bg-yellow-100 text-yellow-800',
    upcoming: 'bg-blue-100 text-blue-800',
    missed: 'bg-gray-100 text-gray-800',
    contraindicated: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, string> = {
    mild: 'bg-green-100 text-green-800',
    moderate: 'bg-yellow-100 text-yellow-800',
    severe: 'bg-red-100 text-red-800',
    fatal: 'bg-red-800 text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[severity] ?? 'bg-gray-100 text-gray-700'}`}>
      {severity}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ImmunizationDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [activeTab, setActiveTab] = useState<'schedule' | 'defaulters' | 'coldchain' | 'aefi' | 'coverage' | 'lots'>('schedule');
  const [loading, setLoading] = useState(false);

  // Patient schedule
  const [patientId, setPatientId] = useState('');
  const [dob, setDob] = useState('');
  const [countryCode, setCountryCode] = useState('ZW');
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  // Defaulters
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [defaultersTotal, setDefaultersTotal] = useState(0);

  // Cold chain
  const [excursions, setExcursions] = useState<any[]>([]);
  const [tempForm, setTempForm] = useState({
    storageLocation: '',
    temperatureCelsius: '',
    recordedAt: new Date().toISOString().slice(0, 16),
    vaccineLotId: '',
  });

  // AEFI
  const [aefiList, setAefiList] = useState<any[]>([]);
  const [aefiForm, setAefiForm] = useState({
    patientId: '',
    eventType: '',
    onsetDate: '',
    severity: 'mild',
    description: '',
    hospitalized: false,
    reportedToMoh: false,
  });

  // Coverage
  const [coverage, setCoverage] = useState<any[]>([]);

  // Lots
  const [lots, setLots] = useState<any[]>([]);
  const [lotForm, setLotForm] = useState({
    lotNumber: '',
    vaccineName: '',
    manufacturer: '',
    expiryDate: '',
    quantityReceived: '',
    quantityRemaining: '',
    storageLocation: '',
  });

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    if (!patientId || !dob) return;
    setLoading(true);
    try {
      const [sched, recs] = await Promise.all([
        ehrAxios.get(`/epi/schedule/${patientId}`, {
          params: { dob, countryCode },
          headers: authHeaders(token, tenantSlug!),
        }),
        ehrAxios.get(`/epi/records/${patientId}`, {
          headers: authHeaders(token, tenantSlug!),
        }),
      ]);
      setScheduleData(sched.data ?? []);
      setRecords(recs.data ?? []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [patientId, dob, countryCode, token, tenantSlug]);

  const fetchDefaulters = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await ehrAxios.get('/epi/defaulters', {
        params: { countryCode, limit: 100 },
        headers: authHeaders(token, tenantSlug!),
      });
      const result = resp.data ?? {};
      setDefaulters(Array.isArray(result) ? result : result.data ?? []);
      setDefaultersTotal(result.total ?? 0);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load defaulters');
    } finally {
      setLoading(false);
    }
  }, [countryCode, token, tenantSlug]);

  const fetchExcursions = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await ehrAxios.get('/epi/cold-chain/excursions', {
        params: { days: 30 },
        headers: authHeaders(token, tenantSlug!),
      });
      setExcursions(resp.data ?? []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load cold chain data');
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug]);

  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await ehrAxios.get('/epi/coverage', {
        headers: authHeaders(token, tenantSlug!),
      });
      setCoverage(resp.data ?? []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug]);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await ehrAxios.get('/epi/lots', {
        headers: authHeaders(token, tenantSlug!),
      });
      setLots(resp.data ?? []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load vaccine lots');
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug]);

  useEffect(() => {
    if (activeTab === 'defaulters') fetchDefaulters();
    if (activeTab === 'coldchain') fetchExcursions();
    if (activeTab === 'coverage') fetchCoverage();
    if (activeTab === 'lots') fetchLots();
  }, [activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const submitTempLog = async () => {
    if (!tempForm.storageLocation || !tempForm.temperatureCelsius || !tempForm.recordedAt) {
      showError('Validation', 'Storage location, temperature, and recorded-at are required');
      return;
    }
    try {
      await ehrAxios.post(
        '/epi/cold-chain',
        {
          ...tempForm,
          temperatureCelsius: parseFloat(tempForm.temperatureCelsius),
        },
        { headers: authHeaders(token, tenantSlug!) },
      );
      showSuccess('Success', 'Temperature log recorded');
      setTempForm({ storageLocation: '', temperatureCelsius: '', recordedAt: new Date().toISOString().slice(0, 16), vaccineLotId: '' });
      fetchExcursions();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to record temperature');
    }
  };

  const submitAefi = async () => {
    if (!aefiForm.patientId || !aefiForm.eventType || !aefiForm.onsetDate || !aefiForm.description) {
      showError('Validation', 'Patient ID, event type, onset date, and description are required');
      return;
    }
    try {
      await ehrAxios.post('/epi/aefi', aefiForm, {
        headers: authHeaders(token, tenantSlug!),
      });
      showSuccess('Success', 'AEFI report submitted');
      setAefiForm({ patientId: '', eventType: '', onsetDate: '', severity: 'mild', description: '', hospitalized: false, reportedToMoh: false });
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to submit AEFI report');
    }
  };

  const fetchPatientAefi = async () => {
    if (!aefiForm.patientId) return;
    try {
      const resp = await ehrAxios.get(`/epi/aefi/${aefiForm.patientId}`, {
        headers: authHeaders(token, tenantSlug!),
      });
      setAefiList(resp.data ?? []);
    } catch (e: any) {
      showError('Error', 'Failed to load AEFI history');
    }
  };

  const submitLot = async () => {
    if (!lotForm.lotNumber || !lotForm.vaccineName || !lotForm.expiryDate || !lotForm.quantityReceived) {
      showError('Validation', 'Lot number, vaccine name, expiry date, and quantity received are required');
      return;
    }
    try {
      await ehrAxios.post(
        '/epi/lots',
        {
          ...lotForm,
          quantityReceived: parseInt(lotForm.quantityReceived),
          quantityRemaining: parseInt(lotForm.quantityRemaining || lotForm.quantityReceived),
        },
        { headers: authHeaders(token, tenantSlug!) },
      );
      showSuccess('Success', 'Vaccine lot added');
      setLotForm({ lotNumber: '', vaccineName: '', manufacturer: '', expiryDate: '', quantityReceived: '', quantityRemaining: '', storageLocation: '' });
      fetchLots();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to add vaccine lot');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'schedule', label: 'Patient Schedule', icon: <Syringe className="w-4 h-4" /> },
    { id: 'defaulters', label: 'Defaulters', icon: <Users className="w-4 h-4" /> },
    { id: 'coldchain', label: 'Cold Chain', icon: <Thermometer className="w-4 h-4" /> },
    { id: 'aefi', label: 'AEFI', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'coverage', label: 'Coverage', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'lots', label: 'Vaccine Lots', icon: <Activity className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Syringe className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">EPI / Immunization Registry</h1>
              <p className="text-sm text-gray-500">Vaccination records, cold chain, AEFI, DHIS2 sync</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {/* Patient Schedule Tab */}
        {activeTab === 'schedule' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Look up patient EPI schedule</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Patient ID (UUID)"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                />
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Date of birth"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Country code (e.g. ZW)"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  maxLength={3}
                />
                <button
                  onClick={fetchSchedule}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" /> Load Schedule
                </button>
              </div>
            </div>

            {scheduleData.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-800">EPI Schedule</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Vaccine</th>
                      <th className="px-4 py-3 text-left">Dose</th>
                      <th className="px-4 py-3 text-left">Due Date</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scheduleData.map((item: any, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.schedule?.vaccine_name || item.schedule?.vaccineName}</td>
                        <td className="px-4 py-3">{item.schedule?.dose_number || item.schedule?.doseNumber}</td>
                        <td className="px-4 py-3 text-gray-600">{item.dueDate}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {records.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Vaccination History</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Vaccine</th>
                      <th className="px-4 py-3 text-left">Dose</th>
                      <th className="px-4 py-3 text-left">Administered</th>
                      <th className="px-4 py-3 text-left">Lot</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.vaccine_name || r.vaccineName}</td>
                        <td className="px-4 py-3">{r.dose_number || r.doseNumber}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.administered_at || r.administeredAt
                            ? new Date(r.administered_at || r.administeredAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.lot_number || r.lotNumber || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Defaulters Tab */}
        {activeTab === 'defaulters' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Defaulters — patients with overdue doses
                {defaultersTotal > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{defaulters.length}</span>
                )}
              </h2>
              <button
                onClick={fetchDefaulters}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {defaulters.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center text-gray-500">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                No defaulters found for the current filter.
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Patient</th>
                      <th className="px-4 py-3 text-left">DOB</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Vaccine</th>
                      <th className="px-4 py-3 text-left">Dose</th>
                      <th className="px-4 py-3 text-left">Due Date</th>
                      <th className="px-4 py-3 text-left">Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {defaulters.map((d: any, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {d.first_name} {d.last_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{d.date_of_birth}</td>
                        <td className="px-4 py-3 text-gray-600">{d.phone || '—'}</td>
                        <td className="px-4 py-3">{d.vaccine_name}</td>
                        <td className="px-4 py-3">{d.dose_number}</td>
                        <td className="px-4 py-3 text-gray-600">{d.due_date}</td>
                        <td className="px-4 py-3">
                          <span className="text-red-600 font-semibold">{d.days_overdue}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Cold Chain Tab */}
        {activeTab === 'coldchain' && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Log temperature form */}
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-blue-500" />
                Record Temperature Log
              </h2>
              <div className="space-y-3">
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Storage location (e.g. Fridge 1)"
                  value={tempForm.storageLocation}
                  onChange={(e) => setTempForm({ ...tempForm, storageLocation: e.target.value })}
                />
                <input
                  type="number"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Temperature (°C)"
                  value={tempForm.temperatureCelsius}
                  onChange={(e) => setTempForm({ ...tempForm, temperatureCelsius: e.target.value })}
                />
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={tempForm.recordedAt}
                  onChange={(e) => setTempForm({ ...tempForm, recordedAt: e.target.value })}
                />
                <button
                  onClick={submitTempLog}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                >
                  Record Temperature
                </button>
              </div>
            </div>

            {/* Excursions */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Cold Chain Excursions (last 30 days)
                </h2>
                <button onClick={fetchExcursions} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {excursions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  No excursions in the last 30 days
                </div>
              ) : (
                <div className="space-y-2">
                  {excursions.map((ex: any) => (
                    <div key={ex.id} className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-red-800">{ex.storage_location || ex.storageLocation}</span>
                        <span className="text-red-700 font-bold">
                          {ex.temperature_celsius || ex.temperatureCelsius}°C
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mt-1">
                        {ex.recorded_at || ex.recordedAt
                          ? new Date(ex.recorded_at || ex.recordedAt).toLocaleString()
                          : '—'}
                      </p>
                      {(ex.excursion_action || ex.excursionAction) && (
                        <p className="text-gray-700 text-xs mt-1">Action: {ex.excursion_action || ex.excursionAction}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AEFI Tab */}
        {activeTab === 'aefi' && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AEFI report form */}
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Report Adverse Event (AEFI)
              </h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="Patient ID (UUID)"
                    value={aefiForm.patientId}
                    onChange={(e) => setAefiForm({ ...aefiForm, patientId: e.target.value })}
                  />
                  <button
                    onClick={fetchPatientAefi}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Load history
                  </button>
                </div>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Event type (e.g. Anaphylaxis, Local reaction)"
                  value={aefiForm.eventType}
                  onChange={(e) => setAefiForm({ ...aefiForm, eventType: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Onset date"
                    value={aefiForm.onsetDate}
                    onChange={(e) => setAefiForm({ ...aefiForm, onsetDate: e.target.value })}
                  />
                  <select
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={aefiForm.severity}
                    onChange={(e) => setAefiForm({ ...aefiForm, severity: e.target.value })}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="fatal">Fatal</option>
                  </select>
                </div>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Description of adverse event..."
                  value={aefiForm.description}
                  onChange={(e) => setAefiForm({ ...aefiForm, description: e.target.value })}
                />
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={aefiForm.hospitalized}
                      onChange={(e) => setAefiForm({ ...aefiForm, hospitalized: e.target.checked })}
                    />
                    Hospitalized
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={aefiForm.reportedToMoh}
                      onChange={(e) => setAefiForm({ ...aefiForm, reportedToMoh: e.target.checked })}
                    />
                    Reported to MoH
                  </label>
                </div>
                <button
                  onClick={submitAefi}
                  className="w-full bg-orange-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-700"
                >
                  Submit AEFI Report
                </button>
              </div>
            </div>

            {/* AEFI history */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4">AEFI History</h2>
              {aefiList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Enter patient ID and click &quot;Load history&quot;</p>
              ) : (
                <div className="space-y-3">
                  {aefiList.map((aefi: any) => (
                    <div key={aefi.id} className="border rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{aefi.event_type || aefi.eventType}</span>
                        <SeverityBadge severity={aefi.severity} />
                      </div>
                      <p className="text-gray-600">Onset: {aefi.onset_date || aefi.onsetDate}</p>
                      <p className="text-gray-700">{aefi.description}</p>
                      {(aefi.hospitalized) && (
                        <span className="text-xs text-red-600">Hospitalized</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coverage Tab */}
        {activeTab === 'coverage' && !loading && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex justify-between">
              <h2 className="font-semibold text-gray-800">Coverage Rate — Current Month</h2>
              <button onClick={fetchCoverage} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            {coverage.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No immunization data for the current period.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Vaccine</th>
                    <th className="px-4 py-3 text-left">Dose</th>
                    <th className="px-4 py-3 text-left">Doses Given</th>
                    <th className="px-4 py-3 text-left">Coverage Bar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coverage.map((c: any, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.vaccineName}</td>
                      <td className="px-4 py-3">{c.doseNumber}</td>
                      <td className="px-4 py-3">{c.given}</td>
                      <td className="px-4 py-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, c.given)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{c.given}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Lots Tab */}
        {activeTab === 'lots' && !loading && (
          <div className="space-y-6">
            {/* Add lot form */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Add Vaccine Lot
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Lot number"
                  value={lotForm.lotNumber}
                  onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Vaccine name"
                  value={lotForm.vaccineName}
                  onChange={(e) => setLotForm({ ...lotForm, vaccineName: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Manufacturer"
                  value={lotForm.manufacturer}
                  onChange={(e) => setLotForm({ ...lotForm, manufacturer: e.target.value })}
                />
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Expiry date"
                  value={lotForm.expiryDate}
                  onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                />
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Quantity received"
                  value={lotForm.quantityReceived}
                  onChange={(e) => setLotForm({ ...lotForm, quantityReceived: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Storage location"
                  value={lotForm.storageLocation}
                  onChange={(e) => setLotForm({ ...lotForm, storageLocation: e.target.value })}
                />
              </div>
              <button
                onClick={submitLot}
                className="mt-3 bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Add Lot
              </button>
            </div>

            {/* Lots table */}
            {lots.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex justify-between">
                  <h3 className="font-semibold text-gray-800">Active Vaccine Lots</h3>
                  <button onClick={fetchLots} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Lot #</th>
                      <th className="px-4 py-3 text-left">Vaccine</th>
                      <th className="px-4 py-3 text-left">Manufacturer</th>
                      <th className="px-4 py-3 text-left">Expiry</th>
                      <th className="px-4 py-3 text-left">Remaining</th>
                      <th className="px-4 py-3 text-left">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lots.map((lot: any) => (
                      <tr key={lot.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{lot.lot_number || lot.lotNumber}</td>
                        <td className="px-4 py-3 font-medium">{lot.vaccine_name || lot.vaccineName}</td>
                        <td className="px-4 py-3 text-gray-600">{lot.manufacturer || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{lot.expiry_date || lot.expiryDate}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${(lot.quantity_remaining || lot.quantityRemaining) < 10 ? 'text-red-600' : 'text-green-700'}`}>
                            {lot.quantity_remaining ?? lot.quantityRemaining}
                          </span>
                          <span className="text-gray-400 text-xs"> / {lot.quantity_received ?? lot.quantityReceived}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{lot.storage_location || lot.storageLocation || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImmunizationDashboard;
