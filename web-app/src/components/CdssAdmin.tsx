import React, { useEffect, useState } from 'react';
import { cdssAdminAPI } from '../services/api';

type Status = {
  llm?: { enabled?: boolean; model?: string; api_url?: string };
  rag?: { enabled?: boolean; documents?: number | null; cache_enabled?: boolean };
};

export const CdssAdmin: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [rateLimit, setRateLimit] = useState<{ limit: number; remaining: number; reset: number } | null>(null);
  const [audit, setAudit] = useState<{ logs: any[]; limit: number; offset: number } | null>(null);
  const [auditLimit, setAuditLimit] = useState<number>(20);
  const [auditOffset, setAuditOffset] = useState<number>(0);
  const [ingestJobs, setIngestJobs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshSecs, setRefreshSecs] = useState<number>(5);

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [st, se, meResp, au, jobs] = await Promise.all([
        cdssAdminAPI.getStatus(),
        cdssAdminAPI.getSettings(),
        cdssAdminAPI.getMetrics(),
        cdssAdminAPI.getAuditLogs(auditLimit, auditOffset),
        cdssAdminAPI.getIngestJobs(20),
      ]);
      setStatus(st);
      setSettings(se?.settings || se);
      setMetrics(meResp.metrics || meResp);
      if (meResp.rateLimit) setRateLimit(meResp.rateLimit);
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: auditOffset });
      setIngestJobs(jobs?.jobs || []);
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to load CDSS admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let timer: any;
    if (autoRefresh) {
      const tick = async () => {
        try {
          const jobs = await cdssAdminAPI.getIngestJobs(20);
          setIngestJobs(jobs?.jobs || []);
        } catch {}
      };
      timer = setInterval(tick, Math.max(2, refreshSecs) * 1000);
      tick();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh, refreshSecs]);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload: any = {
        llm_enabled: settings?.llm_enabled,
        llm_api_url: settings?.llm_api_url,
        llm_model_name: settings?.llm_model_name,
        rag_enabled: settings?.rag_enabled,
        cache_ttl_seconds: Number(settings?.cache_ttl_seconds || 0),
        cache_namespace: settings?.cache_namespace,
        allow_pdf_uploads: settings?.allow_pdf_uploads,
      };
      await cdssAdminAPI.updateSettings(payload);
      setMessage('Settings updated');
      await loadAll();
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await cdssAdminAPI.ingest(file || undefined);
      const jobId = res?.jobId || res?.job_id;
      setMessage(jobId ? `Ingestion started • Job ${jobId}` : 'Ingestion started');
      try {
        const jobs = await cdssAdminAPI.getIngestJobs(20);
        setIngestJobs(jobs?.jobs || []);
      } catch {}
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to start ingestion');
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setLoading(true);
    setMessage('');
    try {
      await cdssAdminAPI.reindex();
      setMessage('Reindex requested');
      await loadAll();
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to reindex');
    } finally {
      setLoading(false);
    }
  };

  const handleFlushCache = async () => {
    setLoading(true);
    setMessage('');
    try {
      await cdssAdminAPI.flushCache();
      setMessage('Cache flushed');
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to flush cache');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMetrics = async () => {
    setLoading(true);
    setMessage('');
    try {
      const meResp = await cdssAdminAPI.getMetrics();
      setMetrics(meResp.metrics || meResp);
      if (meResp.rateLimit) setRateLimit(meResp.rateLimit);
      setMessage('Metrics refreshed');
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMetrics = async () => {
    setLoading(true);
    setMessage('');
    try {
      await cdssAdminAPI.resetMetrics();
      const meResp = await cdssAdminAPI.getMetrics();
      setMetrics(meResp.metrics || meResp);
      if (meResp.rateLimit) setRateLimit(meResp.rateLimit);
      setMessage('Metrics counters reset');
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to reset metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAudit = async () => {
    setLoading(true);
    setMessage('');
    try {
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, auditOffset);
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: auditOffset });
      setMessage('Audit logs refreshed');
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleAuditNext = async () => {
    const newOffset = auditOffset + auditLimit;
    setAuditOffset(newOffset);
    setLoading(true);
    try {
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset);
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: newOffset });
    } finally {
      setLoading(false);
    }
  };

  const handleAuditPrev = async () => {
    const newOffset = Math.max(0, auditOffset - auditLimit);
    setAuditOffset(newOffset);
    setLoading(true);
    try {
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset);
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: newOffset });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">CDSS Admin</h2>
        {loading && <span className="text-sm text-slate-500">Processing...</span>}
      </div>

      {message && (
        <div className="p-3 rounded-md text-sm bg-slate-50 border border-slate-200">{message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">LLM</div>
          <div className="mt-2 text-sm">
            <div>Enabled: {String(status?.llm?.enabled ?? '')}</div>
            <div>Model: {status?.llm?.model || '-'}</div>
            <div>API URL: {status?.llm?.api_url || '-'}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">RAG</div>
          <div className="mt-2 text-sm">
            <div>Enabled: {String(status?.rag?.enabled ?? '')}</div>
            <div>Documents: {status?.rag?.documents ?? '-'}</div>
            <div>Cache: {status?.rag?.cache_enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Metrics</div>
          <div className="mt-2 text-sm">
            <div>Doc count: {metrics?.documents ?? '-'}</div>
            <div>Cache keys: {metrics?.cache_keys ?? '-'}</div>
            <div>RAG cache: {metrics?.rag_cache ? `${metrics.rag_cache.hit} hit / ${metrics.rag_cache.miss} miss (${metrics.rag_cache.hit_rate_percent}% hit)` : '-'}</div>
            <div>LLM cache: {metrics?.llm_cache ? `${metrics.llm_cache.hit} hit / ${metrics.llm_cache.miss} miss (${metrics.llm_cache.hit_rate_percent}% hit)` : '-'}</div>
            {rateLimit && (
              <div className="text-xs text-slate-500 mt-1">Rate limit: {rateLimit.remaining}/{rateLimit.limit} • resets in {rateLimit.reset}s</div>
            )}
          </div>
          <button onClick={handleRefreshMetrics} className="mt-3 px-3 py-1.5 text-sm rounded bg-slate-900 text-white">
            Refresh
          </button>
          <button onClick={handleResetMetrics} className="mt-3 ml-2 px-3 py-1.5 text-sm rounded bg-rose-700 text-white">
            Reset Counters
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Settings</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">LLM Model Name</label>
            <input
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={settings?.llm_model_name || ''}
              onChange={(e) => setSettings({ ...settings, llm_model_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">LLM API URL</label>
            <input
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={settings?.llm_api_url || ''}
              onChange={(e) => setSettings({ ...settings, llm_api_url: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">RAG Enabled</label>
            <select
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={String(settings?.rag_enabled ?? true)}
              onChange={(e) => setSettings({ ...settings, rag_enabled: e.target.value === 'true' })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">Cache TTL (seconds)</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={String(settings?.cache_ttl_seconds ?? 300)}
              onChange={(e) => setSettings({ ...settings, cache_ttl_seconds: Number(e.target.value || 0) })}
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave} className="px-4 py-2 rounded bg-slate-900 text-white">Save</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Ingestion & Index</div>
        <div className="flex items-center space-x-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button onClick={handleIngest} className="px-4 py-2 rounded bg-blue-600 text-white">Upload & Ingest</button>
          <button onClick={handleReindex} className="px-4 py-2 rounded bg-amber-600 text-white">Reindex</button>
          <button onClick={handleFlushCache} className="px-4 py-2 rounded bg-rose-600 text-white">Flush Cache</button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-slate-600">Auto-refresh</label>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <label className="text-xs text-slate-600">Every (s)</label>
            <input
              type="number"
              className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
              value={String(refreshSecs)}
              onChange={(e) => setRefreshSecs(Math.max(2, Number(e.target.value || 5)))}
            />
            <button
              onClick={async () => {
                const jobs = await cdssAdminAPI.getIngestJobs(20);
                setIngestJobs(jobs?.jobs || []);
              }}
              className="px-2 py-1 text-xs rounded bg-slate-200 text-slate-700"
            >
              Refresh Now
            </button>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mt-2 mb-1">Jobs</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Job ID</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Finished</th>
                  <th className="py-2 pr-4">Message</th>
                </tr>
              </thead>
              <tbody>
                {(ingestJobs || []).map((j, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{j.jobId}</td>
                    <td className="py-2 pr-4">{j.status}</td>
                    <td className="py-2 pr-4">{j.started_at}</td>
                    <td className="py-2 pr-4">{j.finished_at || '-'}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{j.message || '-'}</td>
                  <td className="py-2 pr-4">
                    {(j.status === 'failed' || j.status === 'completed') && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await cdssAdminAPI.retryIngestJob(j.jobId);
                            setMessage(`Retry started • Job ${res?.jobId || ''}`);
                            const jobs = await cdssAdminAPI.getIngestJobs(20);
                            setIngestJobs(jobs?.jobs || []);
                          } catch (e: any) {
                            setMessage(e?.response?.data?.detail || 'Retry failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="px-2 py-1 text-xs rounded bg-blue-600 text-white"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Audit Logs</div>
          <div className="flex items-center gap-2">
            <button onClick={handleAuditPrev} disabled={auditOffset <= 0} className="px-3 py-1.5 text-sm rounded bg-slate-200 text-slate-700 disabled:opacity-50">Prev</button>
            <span className="text-xs text-slate-500">offset {auditOffset} • limit {auditLimit}</span>
            <button onClick={handleAuditNext} className="px-3 py-1.5 text-sm rounded bg-slate-200 text-slate-700">Next</button>
            <button onClick={handleRefreshAudit} className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white">Refresh</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Payload</th>
              </tr>
            </thead>
            <tbody>
              {(audit?.logs || []).map((log, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="py-2 pr-4 text-slate-700">{log.created_at}</td>
                  <td className="py-2 pr-4">{log.actor}</td>
                  <td className="py-2 pr-4">{log.action}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.payload || {}, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
