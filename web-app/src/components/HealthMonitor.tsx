import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { healthAPI, tenantAPI, RuntimeEndpointConfig } from '../services/api';

interface HealthStatus {
  tenantId: string;
  tenantName: string;
  databaseStatus: 'healthy' | 'unhealthy' | 'unknown';
  connectionTime: number;
  lastChecked: Date;
  error?: string;
}

interface SystemHealth {
  totalTenants: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  lastCheck: number | null;
  averageConnectionTime: number;
}

interface PlatformServiceEntry {
  id: string;
  name: string;
  description: string;
  containerName?: string;
  restartable: boolean;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  checkedAt: string;
  container?: {
    status: string;
    running: boolean;
    health?: string;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
  } | null;
  endpoint?: {
    reachable: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  } | null;
}

interface RuntimeTestResult {
  id: 'whisper' | 'ocr' | 'ollama';
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  statusCode?: number;
  message: string;
  details?: Record<string, any>;
}

interface RuntimeTestEntry {
  id: 'whisper' | 'ocr' | 'ollama';
  name: string;
  description: string;
  restartTargetServiceId?: string;
  latest?: RuntimeTestResult;
  health: 'healthy' | 'degraded' | 'unknown';
}

interface PlatformOverview {
  generatedAt: string;
  docker: {
    available: boolean;
    socketPath: string;
    error?: string;
  };
  services: PlatformServiceEntry[];
  runtimeTests: RuntimeTestEntry[];
}

const statusPillClass = (status: string): string => {
  switch (status) {
    case 'healthy':
    case 'running':
      return 'text-[#6EE7C2] bg-[#00C896]/10 border border-emerald-200';
    case 'degraded':
    case 'unhealthy':
      return 'text-[#FFBD9A] bg-[#FF7A40]/10 border border-amber-200';
    case 'down':
    case 'stopped':
    case 'missing':
      return 'text-rose-700 bg-rose-50 border border-rose-200';
    default:
      return 'text-[#8FA8CC] bg-[#080E1A] border border-white/[0.07]';
  }
};

export const HealthMonitor: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [tenantHealth, setTenantHealth] = useState<HealthStatus[]>([]);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeEndpointConfig | null>(null);
  const [runtimeConfigDraft, setRuntimeConfigDraft] = useState<RuntimeEndpointConfig | null>(null);
  const [runtimeConfigDirty, setRuntimeConfigDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const [serviceActionMessage, setServiceActionMessage] = useState<string | null>(null);
  const [serviceActionError, setServiceActionError] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [restartingServiceId, setRestartingServiceId] = useState<string | null>(null);
  const [testingRuntimeId, setTestingRuntimeId] = useState<string | null>(null);
  const [savingRuntimeConfig, setSavingRuntimeConfig] = useState(false);

  const loadHealthData = useCallback(async () => {
    const data = await healthAPI.getSystemHealth();
    const system: SystemHealth = data.system;
    const tenants: HealthStatus[] = (data.tenants || []).map((tenant: any) => ({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      databaseStatus: tenant.databaseStatus,
      connectionTime: tenant.connectionTime,
      lastChecked: tenant.lastChecked ? new Date(tenant.lastChecked) : new Date(),
      error: tenant.error,
    }));

    setSystemHealth(system);
    setTenantHealth(tenants);
  }, []);

  const loadPlatformServices = useCallback(async () => {
    const data = await healthAPI.getPlatformServices();
    setPlatformOverview(data);
    setPlatformError(null);
  }, []);

  const loadRuntimeConfig = useCallback(async () => {
    const data = await healthAPI.getRuntimeConfig();
    setRuntimeConfig(data);
    if (!runtimeConfigDirty || !runtimeConfigDraft) {
      setRuntimeConfigDraft(data);
      setRuntimeConfigDirty(false);
    }
  }, [runtimeConfigDirty, runtimeConfigDraft]);

  const loadAll = useCallback(async () => {
    const [healthResult, platformResult, runtimeConfigResult] = await Promise.allSettled([
      loadHealthData(),
      loadPlatformServices(),
      loadRuntimeConfig(),
    ]);

    if (healthResult.status === 'rejected') {
      console.error('Failed to load tenant health data:', healthResult.reason);
      setSystemHealth(null);
      setTenantHealth([]);
    }

    if (platformResult.status === 'rejected') {
      const message =
        platformResult.reason?.response?.data?.message ||
        platformResult.reason?.message ||
        'Failed to load platform services.';
      console.error('Failed to load platform services:', platformResult.reason);
      setPlatformOverview(null);
      setPlatformError(message);
    }

    if (runtimeConfigResult.status === 'rejected') {
      const message =
        runtimeConfigResult.reason?.response?.data?.message ||
        runtimeConfigResult.reason?.message ||
        'Failed to load runtime endpoint configuration.';
      setServiceActionError(message);
    }

    setLoading(false);
  }, [loadHealthData, loadPlatformServices, loadRuntimeConfig]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 35000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleRefreshNow = async () => {
    try {
      setRefreshing(true);
      setServiceActionMessage(null);
      setServiceActionError(null);
      await Promise.all([healthAPI.refreshSystemHealth(), loadPlatformServices()]);
      await Promise.all([loadHealthData(), loadRuntimeConfig()]);
      setServiceActionMessage('System and platform services refreshed.');
    } catch (error: any) {
      console.error('Failed to refresh health data:', error);
      setServiceActionError(error?.response?.data?.message || error?.message || 'Failed to refresh health data.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRepairAll = async () => {
    try {
      setRepairing(true);
      setRepairMessage(null);
      const result = await tenantAPI.repairAllTenants();
      setRepairMessage(`Schema applied to ${result.count} tenants`);
      await loadHealthData();
    } catch (error: any) {
      setRepairMessage(error?.response?.data?.message || error?.message || 'Failed to repair tenants');
    } finally {
      setRepairing(false);
    }
  };

  const handleRestartService = async (serviceId: string) => {
    try {
      setRestartingServiceId(serviceId);
      setServiceActionMessage(null);
      setServiceActionError(null);
      const result = await healthAPI.restartPlatformService(serviceId);
      setServiceActionMessage(`${result.serviceName || serviceId} restart initiated.`);
      await loadPlatformServices();
    } catch (error: any) {
      setServiceActionError(error?.response?.data?.message || error?.message || `Failed to restart ${serviceId}`);
    } finally {
      setRestartingServiceId(null);
    }
  };

  const handleRunRuntimeTest = async (testId: 'whisper' | 'ocr' | 'ollama') => {
    try {
      setTestingRuntimeId(testId);
      setServiceActionMessage(null);
      setServiceActionError(null);
      const result = await healthAPI.runRuntimeTest(testId);
      setServiceActionMessage(result?.message || `${testId.toUpperCase()} test completed.`);
      await loadPlatformServices();
    } catch (error: any) {
      setServiceActionError(error?.response?.data?.message || error?.message || `Failed to test ${testId}`);
    } finally {
      setTestingRuntimeId(null);
    }
  };

  const handleRuntimeConfigFieldChange = (field: keyof RuntimeEndpointConfig, value: string) => {
    setRuntimeConfigDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    setRuntimeConfigDirty(true);
  };

  const handleSaveRuntimeConfig = async () => {
    if (!runtimeConfigDraft) return;
    try {
      setSavingRuntimeConfig(true);
      setServiceActionMessage(null);
      setServiceActionError(null);
      const payload = {
        tenantServiceUrl: runtimeConfigDraft.tenantServiceUrl?.trim() || null,
        ehrServiceUrl: runtimeConfigDraft.ehrServiceUrl?.trim() || null,
        cdssServiceUrl: runtimeConfigDraft.cdssServiceUrl?.trim() || null,
        medicalAidDemoUrl: runtimeConfigDraft.medicalAidDemoUrl?.trim() || null,
        superAdminWebUrl: runtimeConfigDraft.superAdminWebUrl?.trim() || null,
        ehrFrontendUrl: runtimeConfigDraft.ehrFrontendUrl?.trim() || null,
        ollamaBaseUrl: runtimeConfigDraft.ollamaBaseUrl?.trim() || null,
        whisperPath: runtimeConfigDraft.whisperPath?.trim() || null,
        ocrPath: runtimeConfigDraft.ocrPath?.trim() || null,
        ollamaTagsPath: runtimeConfigDraft.ollamaTagsPath?.trim() || null,
      };
      const updated = await healthAPI.updateRuntimeConfig(payload);
      setRuntimeConfig(updated);
      setRuntimeConfigDraft(updated);
      setRuntimeConfigDirty(false);
      setServiceActionMessage('Runtime endpoint routing saved. Health probes and tests now use updated targets.');
      await loadPlatformServices();
    } catch (error: any) {
      setServiceActionError(
        error?.response?.data?.message || error?.message || 'Failed to save runtime endpoint routing.',
      );
    } finally {
      setSavingRuntimeConfig(false);
    }
  };

  const platformSummary = useMemo(() => {
    const services = platformOverview?.services || [];
    const healthy = services.filter((service) => service.health === 'healthy').length;
    const degraded = services.filter((service) => service.health === 'degraded').length;
    const down = services.filter((service) => service.health === 'down').length;
    return {
      total: services.length,
      healthy,
      degraded,
      down,
    };
  }, [platformOverview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Platform Reliability</p>
            <h2 className="mt-1 text-2xl font-semibold">System Health & Service Control</h2>
            <p className="mt-1 text-sm text-emerald-100">
              Monitor services, test AI runtimes (Whisper/OCR/Ollama), and restart failed components from one panel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-white/90 flex items-center rounded-2xl border border-white/30 px-3 py-1.5">
              <span className="w-2 h-2 bg-emerald-200 rounded-full mr-2 animate-pulse"></span>
              Live Monitoring
            </div>
            <button
              type="button"
              onClick={handleRefreshNow}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-1.5 rounded-2xl text-xs font-semibold bg-white text-[#6EE7C2] hover:bg-[#00C896]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing && (
                <span className="mr-2 inline-block h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              )}
              Refresh now
            </button>
            <button
              type="button"
              onClick={handleRepairAll}
              disabled={repairing}
              className="inline-flex items-center px-3 py-1.5 rounded-2xl text-xs font-semibold bg-[#060C16]/75 text-white hover:bg-[#060C16] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {repairing && (
                <span className="mr-2 inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Repair all tenant schema
            </button>
          </div>
        </div>
        {(repairMessage || serviceActionMessage || serviceActionError) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {repairMessage && (
              <span className="text-xs rounded-full px-3 py-1 bg-white/15 border border-white/25">{repairMessage}</span>
            )}
            {serviceActionMessage && (
              <span className="text-xs rounded-full px-3 py-1 bg-[#00C896]/100/30 border border-emerald-200/50">{serviceActionMessage}</span>
            )}
            {serviceActionError && (
              <span className="text-xs rounded-full px-3 py-1 bg-rose-500/30 border border-rose-200/50">{serviceActionError}</span>
            )}
          </div>
        )}
      </section>

      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-white/[0.07] shadow-sm">
            <p className="text-sm font-medium text-[#7A9AB8]">Total Tenants</p>
            <p className="text-2xl font-bold text-white mt-1">{systemHealth.totalTenants}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-white/[0.07] shadow-sm">
            <p className="text-sm font-medium text-[#7A9AB8]">Healthy</p>
            <p className="text-2xl font-bold text-white mt-1">{systemHealth.healthy}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-white/[0.07] shadow-sm">
            <p className="text-sm font-medium text-[#7A9AB8]">Issues</p>
            <p className="text-2xl font-bold text-white mt-1">{systemHealth.unhealthy}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-white/[0.07] shadow-sm">
            <p className="text-sm font-medium text-[#7A9AB8]">Avg DB Latency</p>
            <p className="text-2xl font-bold text-white mt-1">{Math.round(systemHealth.averageConnectionTime)}ms</p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] bg-[#080E1A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Runtime Endpoint Routing</h3>
            <p className="text-xs text-[#7A9AB8] mt-1">
              Configure ports/hosts for platform monitoring and AI smoke tests. Leave blank to use environment defaults.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {runtimeConfig?.hasOverrides ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF7A40]/10 text-[#FFBD9A] border border-amber-200">
                Overrides Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#00C896]/10 text-[#6EE7C2] border border-emerald-200">
                Env Defaults
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveRuntimeConfig}
              disabled={!runtimeConfigDraft || !runtimeConfigDirty || savingRuntimeConfig}
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00C896] text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingRuntimeConfig ? 'Saving...' : 'Save Routing'}
            </button>
          </div>
        </div>
        {runtimeConfigDraft && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'tenantServiceUrl', label: 'Tenant Service URL' },
              { key: 'ehrServiceUrl', label: 'EHR Service URL' },
              { key: 'cdssServiceUrl', label: 'CDSS Service URL' },
              { key: 'medicalAidDemoUrl', label: 'Medical Aid Demo URL' },
              { key: 'superAdminWebUrl', label: 'Super Admin Web URL' },
              { key: 'ehrFrontendUrl', label: 'EHR Frontend URL' },
              { key: 'ollamaBaseUrl', label: 'Ollama Base URL' },
              { key: 'whisperPath', label: 'Whisper Test Path' },
              { key: 'ocrPath', label: 'OCR Test Path' },
              { key: 'ollamaTagsPath', label: 'Ollama Tags Path' },
            ].map((field) => {
              const key = field.key as keyof RuntimeEndpointConfig;
              const source = runtimeConfig?.sources?.[field.key] || 'env';
              return (
                <label key={field.key} className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#8FA8CC]">{field.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        source === 'override'
                          ? 'bg-[#FF7A40]/10 text-[#FFBD9A] border border-amber-200'
                          : 'bg-white/[0.04] text-[#8FA8CC] border border-white/[0.07]'
                      }`}
                    >
                      {source}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={(runtimeConfigDraft[key] as any) || ''}
                    onChange={(event) => handleRuntimeConfigFieldChange(key, event.target.value)}
                    className="w-full border border-white/[0.10] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] bg-[#080E1A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Platform Services</h3>
            <p className="text-xs text-[#7A9AB8] mt-1">
              {platformSummary.total > 0
                ? `${platformSummary.healthy}/${platformSummary.total} healthy · ${platformSummary.degraded} degraded · ${platformSummary.down} down`
                : 'Platform service telemetry unavailable'}
            </p>
            {platformError && (
              <p className="text-xs text-rose-600 mt-1">{platformError}</p>
            )}
          </div>
          <div className="text-xs">
            <span className={`px-3 py-1 rounded-full ${statusPillClass(platformOverview?.docker?.available ? 'healthy' : 'down')}`}>
              Docker socket: {platformOverview?.docker?.available ? 'available' : 'unavailable'}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {(platformOverview?.services || []).map((service) => (
            <div key={service.id} className="px-6 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-white">{service.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusPillClass(service.health)}`}>
                      {service.health.toUpperCase()}
                    </span>
                    {service.containerName && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] text-[#8FA8CC] bg-white/[0.04] border border-white/[0.07]">
                        {service.containerName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#7A9AB8] mt-1">{service.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#7A9AB8]">
                    {service.container && (
                      <span>
                        Container: <strong className="text-[#C5D5EE]">{service.container.status}</strong>
                      </span>
                    )}
                    {service.endpoint && (
                      <span>
                        Endpoint: <strong className="text-[#C5D5EE]">{service.endpoint.statusCode || (service.endpoint.reachable ? 'ok' : 'n/a')}</strong>
                        {service.endpoint.latencyMs ? ` · ${service.endpoint.latencyMs}ms` : ''}
                      </span>
                    )}
                    <span>Checked: {new Date(service.checkedAt).toLocaleTimeString()}</span>
                  </div>
                  {(service.container?.error || service.endpoint?.error) && (
                    <p className="text-xs text-rose-600 mt-1">
                      {service.container?.error || service.endpoint?.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {service.restartable && (
                    <button
                      type="button"
                      onClick={() => handleRestartService(service.id)}
                      disabled={restartingServiceId === service.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00C896] text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restartingServiceId === service.id ? 'Restarting...' : 'Restart Service'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] bg-[#080E1A]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">AI Runtime Tests</h3>
          <p className="text-xs text-[#7A9AB8] mt-1">Run built-in tests to validate Whisper transcription, OCR/vision, and Ollama model runtime.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {(platformOverview?.runtimeTests || []).map((test) => (
            <article key={test.id} className="rounded-lg border border-white/[0.07] bg-[#080E1A]/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">{test.name}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusPillClass(test.health)}`}>
                  {test.health.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#7A9AB8] mt-1">{test.description}</p>
              <div className="mt-3 space-y-1 text-xs text-[#8FA8CC]">
                <p>
                  Last: {test.latest ? new Date(test.latest.checkedAt).toLocaleString() : 'Not run yet'}
                </p>
                {test.latest && (
                  <>
                    <p>Status: {test.latest.statusCode || 'n/a'} · {test.latest.latencyMs}ms</p>
                    <p className={test.latest.ok ? 'text-[#6EE7C2]' : 'text-rose-700'}>{test.latest.message}</p>
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRunRuntimeTest(test.id)}
                  disabled={testingRuntimeId === test.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#060C16] text-white hover:bg-[#0D1829] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingRuntimeId === test.id ? 'Testing...' : 'Run Test'}
                </button>
                {test.restartTargetServiceId && (
                  <button
                    type="button"
                    onClick={() => handleRestartService(test.restartTargetServiceId!)}
                    disabled={restartingServiceId === test.restartTargetServiceId}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-300 text-[#6EE7C2] bg-white hover:bg-[#00C896]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {restartingServiceId === test.restartTargetServiceId ? 'Restarting...' : 'Restart Target'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] bg-[#080E1A]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Tenant Database Health</h3>
        </div>

        {tenantHealth.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {tenantHealth.map((tenant) => (
              <div key={tenant.tenantId} className="p-6 hover:bg-[#080E1A] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">{tenant.tenantName}</h4>
                    <div className="flex items-center mt-1 space-x-4">
                      <span className="text-xs text-[#7A9AB8]">Checked: {tenant.lastChecked.toLocaleTimeString()}</span>
                      {tenant.error && <span className="text-xs text-rose-600">{tenant.error}</span>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-xs text-[#7A9AB8] mb-1">Latency</p>
                      <p className="text-sm font-medium text-white">{tenant.connectionTime}ms</p>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusPillClass(tenant.databaseStatus)}`}>
                        {tenant.databaseStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <h3 className="text-sm font-medium text-white">No health data available</h3>
            <p className="text-sm text-[#7A9AB8] mt-1">System monitoring is active but no tenant data has been collected yet.</p>
          </div>
        )}
      </section>
    </div>
  );
};
