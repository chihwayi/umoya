import React, { useCallback, useEffect, useState } from 'react';
import { Cable, Loader2, PlugZap, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesDeviceIntegrationProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
};

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

const DiabetesDeviceIntegration: React.FC<DiabetesDeviceIntegrationProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
}) => {
  const { showError, showSuccess } = useNotification();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    deviceType: 'cgm',
    deviceBrand: '',
    deviceModel: '',
    integrationType: 'api',
    syncFrequency: '15m',
  });

  const fetchDevices = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const response = await diabetesApi.listDevices(registryId, token, tenantSlug);
      setDevices(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load devices', error);
      showError('Unable to load devices', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, showError]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddDevice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before adding a device.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patientId,
        deviceType: formState.deviceType,
        deviceBrand: formState.deviceBrand || undefined,
        deviceModel: formState.deviceModel || undefined,
        integrationType: formState.integrationType,
        syncFrequency: formState.syncFrequency,
      };
      await diabetesApi.registerDevice(registryId, token, tenantSlug, payload);
      showSuccess('Device registered', `${formState.deviceType.toUpperCase()} device connected.`);
      setShowForm(false);
      setFormState({
        deviceType: 'cgm',
        deviceBrand: '',
        deviceModel: '',
        integrationType: 'api',
        syncFrequency: '15m',
      });
      await fetchDevices();
    } catch (error) {
      console.error('Failed to register device', error);
      showError('Unable to register device', 'Please verify the details and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view connected devices.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Device mesh</p>
          <h3 className="text-xl font-semibold text-slate-900">Connected wearables</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-slate-800"
          >
            <PlugZap className="h-3.5 w-3.5" />
            Connect device
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAddDevice} className="mt-4 mx-6 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <select
            name="deviceType"
            value={formState.deviceType}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:ring focus:ring-slate-100"
          >
            <option value="cgm">CGM</option>
            <option value="insulin_pump">Insulin pump</option>
            <option value="glucose_meter">Glucose meter</option>
            <option value="smart_pen">Smart pen</option>
            <option value="fitness_tracker">Fitness tracker</option>
          </select>
          <input
            type="text"
            name="deviceBrand"
            value={formState.deviceBrand}
            onChange={handleFormChange}
            placeholder="Brand"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:ring focus:ring-slate-100"
          />
          <input
            type="text"
            name="deviceModel"
            value={formState.deviceModel}
            onChange={handleFormChange}
            placeholder="Model"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:ring focus:ring-slate-100"
          />
          <select
            name="integrationType"
            value={formState.integrationType}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:ring focus:ring-slate-100"
          >
            <option value="api">API</option>
            <option value="hl7">HL7</option>
            <option value="fhir">FHIR</option>
            <option value="manual">Manual</option>
            <option value="healthkit">HealthKit</option>
            <option value="google_fit">Google Fit</option>
          </select>
          <input
            type="text"
            name="syncFrequency"
            value={formState.syncFrequency}
            onChange={handleFormChange}
            placeholder="Sync frequency"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:ring focus:ring-slate-100"
          />
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Register device
            </button>
          </div>
        </form>
      )}

      <div className="p-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading devices...
          </div>
        )}
        {!loading && devices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            No devices connected yet.
          </div>
        )}
        {!loading &&
          devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <Cable className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {device.device_type?.replace('_', ' ') ?? 'Device'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {device.device_brand ?? 'Brand'} {device.device_model ?? ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Last sync:{' '}
                    {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusBadge[device.integration_status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {device.integration_status ?? 'active'}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DiabetesDeviceIntegration;


