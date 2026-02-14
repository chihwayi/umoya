import React, { useEffect, useState } from 'react';
import { cdssAdminAPI } from '../services/api';

type Status = {
  llm?: { enabled?: boolean; model?: string; api_url?: string };
  rag?: { enabled?: boolean; documents?: number | null; cache_enabled?: boolean };
};

export const CdssAdmin: React.FC = () => {
  const statusChip = (s: string) => {
    const base = 'inline-block px-2 py-0.5 text-xs rounded';
    switch (s) {
      case 'running':
        return `${base} bg-amber-100 text-amber-800`;
      case 'failed':
        return `${base} bg-rose-100 text-rose-700`;
      case 'completed':
        return `${base} bg-emerald-100 text-emerald-700`;
      case 'queued':
        return `${base} bg-slate-100 text-slate-700`;
      default:
        return `${base} bg-slate-100 text-slate-600`;
    }
  };
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [rateLimit, setRateLimit] = useState<{ limit: number; remaining: number; reset: number } | null>(null);
  const [audit, setAudit] = useState<{ logs: any[]; limit: number; offset: number } | null>(null);
  const [auditLimit, setAuditLimit] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('cdssAdmin.auditLimit'));
      return Number.isFinite(v) && v > 0 ? v : 20;
    } catch {
      return 20;
    }
  });
  const [auditOffset, setAuditOffset] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('cdssAdmin.auditOffset'));
      return Number.isFinite(v) && v >= 0 ? v : 0;
    } catch {
      return 0;
    }
  });
  const [ingestJobs, setIngestJobs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    try { return localStorage.getItem('cdssAdmin.autoRefresh') !== 'false'; } catch { return true; }
  });
  const [refreshSecs, setRefreshSecs] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('cdssAdmin.refreshSecs');
      const n = Number(raw);
      return Number.isFinite(n) && n >= 2 ? n : 5;
    } catch { return 5; }
  });
  const runningCount = ingestJobs.filter(j => j.status === 'running').length;
  const [retryCooldown, setRetryCooldown] = useState<number>(0);
  const [reindexCooldown, setReindexCooldown] = useState<number>(0);
  const [flushCooldown, setFlushCooldown] = useState<number>(0);
  const [ingestCooldown, setIngestCooldown] = useState<number>(0);
  const [saveCooldown, setSaveCooldown] = useState<number>(0);
  const [denseMode, setDenseMode] = useState<boolean>(() => {
    try { return localStorage.getItem('cdssAdmin.denseMode') === 'true'; } catch { return false; }
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.statusFilter') || 'all'; } catch { return 'all'; }
  });
  const [jobIdQuery, setJobIdQuery] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.jobIdQuery') || ''; } catch { return ''; }
  });

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

  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.autoRefresh', String(autoRefresh)); } catch {}
  }, [autoRefresh]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.refreshSecs', String(refreshSecs)); } catch {}
  }, [refreshSecs]);

  useEffect(() => {
    if (runningCount === 0 && autoRefresh) {
      setAutoRefresh(false);
    }
  }, [runningCount]);

  useEffect(() => {
    if (retryCooldown <= 0) return;
    const t = setInterval(() => {
      setRetryCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [retryCooldown]);

  useEffect(() => {
    if (reindexCooldown <= 0) return;
    const t = setInterval(() => {
      setReindexCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [reindexCooldown]);

  useEffect(() => {
    if (flushCooldown <= 0) return;
    const t = setInterval(() => {
      setFlushCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [flushCooldown]);

  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.denseMode', String(denseMode)); } catch {}
  }, [denseMode]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.statusFilter', statusFilter); } catch {}
  }, [statusFilter]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.jobIdQuery', jobIdQuery); } catch {}
  }, [jobIdQuery]);

  useEffect(() => {
    if (ingestCooldown <= 0) return;
    const t = setInterval(() => {
      setIngestCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [ingestCooldown]);

  useEffect(() => {
    if (saveCooldown <= 0) return;
    const t = setInterval(() => {
      setSaveCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [saveCooldown]);

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
      const res = await cdssAdminAPI.updateSettings(payload);
      if (res?.rateLimit) setRateLimit(res.rateLimit);
      setMessage('Settings updated');
      await loadAll();
    } catch (e: any) {
      const reset = Number(e?.response?.headers?.['x-ratelimit-reset'] || 0);
      if (e?.response?.status === 429 && reset > 0) {
        setSaveCooldown(reset);
      }
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
      if (res?.rateLimit) setRateLimit(res.rateLimit);
      const jobId = res?.data?.jobId || res?.data?.job_id;
      setMessage(jobId ? `Ingestion started • Job ${jobId}` : 'Ingestion started');
      setAutoRefresh(true);
      try {
        const jobs = await cdssAdminAPI.getIngestJobs(20);
        setIngestJobs(jobs?.jobs || []);
      } catch {}
    } catch (e: any) {
      const reset = Number(e?.response?.headers?.['x-ratelimit-reset'] || 0);
      if (e?.response?.status === 429 && reset > 0) {
        setIngestCooldown(reset);
      }
      setMessage(e?.response?.data?.detail || 'Failed to start ingestion');
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await cdssAdminAPI.reindex();
      if (res?.rateLimit) setRateLimit(res.rateLimit);
      setMessage('Reindex requested');
      await loadAll();
    } catch (e: any) {
      const reset = Number(e?.response?.headers?.['x-ratelimit-reset'] || 0);
      if (e?.response?.status === 429 && reset > 0) {
        setReindexCooldown(reset);
      }
      setMessage(e?.response?.data?.detail || 'Failed to reindex');
    } finally {
      setLoading(false);
    }
  };

  const handleFlushCache = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await cdssAdminAPI.flushCache();
      if (res?.rateLimit) setRateLimit(res.rateLimit);
      setMessage('Cache flushed');
    } catch (e: any) {
      const reset = Number(e?.response?.headers?.['x-ratelimit-reset'] || 0);
      if (e?.response?.status === 429 && reset > 0) {
        setFlushCooldown(reset);
      }
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

  useEffect(() => {
    try {
      localStorage.setItem('cdssAdmin.auditLimit', String(auditLimit));
    } catch {}
  }, [auditLimit]);
  useEffect(() => {
    try {
      localStorage.setItem('cdssAdmin.auditOffset', String(auditOffset));
    } catch {}
  }, [auditOffset]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">🧠 CDSS Administration</h2>
          <div className="text-sm text-slate-500">Manage AI features, ingestion, caching and audit trails</div>
        </div>
        {loading && <span className="text-sm text-amber-600">Processing…</span>}
      </div>

      {message && (
        <div className="p-3 rounded-md text-sm bg-emerald-50 border border-emerald-200 text-emerald-800">{message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase">LLM</div>
          <div className="mt-2 text-sm">
            <div>Enabled: {String(status?.llm?.enabled ?? '')}</div>
            <div>Model: {status?.llm?.model || '-'}</div>
            <div>API URL: {status?.llm?.api_url || '-'}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase">RAG</div>
          <div className="mt-2 text-sm">
            <div>Enabled: {String(status?.rag?.enabled ?? '')}</div>
            <div>Documents: {status?.rag?.documents ?? '-'}</div>
            <div>Cache: {status?.rag?.cache_enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase">Metrics</div>
          <div className="mt-2 text-sm">
            <div>Doc count: {metrics?.documents ?? '-'}</div>
            <div>Cache keys: {metrics?.cache_keys ?? '-'}</div>
            <div>RAG cache: {metrics?.rag_cache ? `${metrics.rag_cache.hit} hit / ${metrics.rag_cache.miss} miss (${metrics.rag_cache.hit_rate_percent}% hit)` : '-'}</div>
            <div>LLM cache: {metrics?.llm_cache ? `${metrics.llm_cache.hit} hit / ${metrics.llm_cache.miss} miss (${metrics.llm_cache.hit_rate_percent}% hit)` : '-'}</div>
            {rateLimit && (
              <div className="text-xs text-slate-500 mt-1">Rate limit: {rateLimit.remaining}/{rateLimit.limit} • resets in {rateLimit.reset}s</div>
            )}
          </div>
          <button onClick={handleRefreshMetrics} className="mt-3 px-3 py-1.5 text-sm rounded bg-slate-900 text-white shadow">
            Refresh
          </button>
          <button onClick={handleResetMetrics} className="mt-3 ml-2 px-3 py-1.5 text-sm rounded bg-rose-700 text-white shadow">
            Reset Counters
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-800">🔧 Settings</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-1">LLM Model Name</label>
            <input
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={settings?.llm_model_name || ''}
              onChange={(e) => setSettings({ ...settings, llm_model_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-1">LLM API URL</label>
            <input
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={settings?.llm_api_url || ''}
              onChange={(e) => setSettings({ ...settings, llm_api_url: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-1">RAG Enabled</label>
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
            <label className="block text-xs text-slate-600 uppercase mb-1">Cache TTL (seconds)</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={String(settings?.cache_ttl_seconds ?? 300)}
              onChange={(e) => setSettings({ ...settings, cache_ttl_seconds: Number(e.target.value || 0) })}
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
            disabled={saveCooldown > 0}
            title={saveCooldown > 0 ? `Rate limited • wait ${saveCooldown}s` : 'Save settings'}
          >
            Save
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-800">📚 Ingestion & Index</div>
        <div className="flex items-center space-x-3">
          <input className="text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            onClick={handleIngest}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={ingestCooldown > 0}
            title={ingestCooldown > 0 ? `Rate limited • wait ${ingestCooldown}s` : 'Upload a PDF and start ingestion'}
          >
            Upload & Ingest
          </button>
          <button
            onClick={handleReindex}
            className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-50"
            disabled={reindexCooldown > 0}
            title={reindexCooldown > 0 ? `Rate limited • wait ${reindexCooldown}s` : 'Rebuild vector + BM25 indexes'}
          >
            Reindex
          </button>
          <button
            onClick={handleFlushCache}
            className="px-4 py-2 rounded bg-rose-600 text-white disabled:opacity-50"
            disabled={flushCooldown > 0}
            title={flushCooldown > 0 ? `Rate limited • wait ${flushCooldown}s` : 'Delete cache entries'}
          >
            Flush Cache
          </button>
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
            <div className="ml-3 flex items-center gap-2">
              <label className="text-xs text-slate-600">Dense</label>
              <input type="checkbox" checked={denseMode} onChange={(e) => setDenseMode(e.target.checked)} />
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mt-2 mb-1">
            <div className="text-xs font-semibold text-slate-600 uppercase">Jobs</div>
            <div className="flex items-center gap-2">
              <input
                className="border border-slate-300 rounded px-2 py-1 text-xs"
                placeholder="Search Job ID"
                value={jobIdQuery}
                onChange={(e) => setJobIdQuery(e.target.value)}
              />
              <select
                className="border border-slate-300 rounded px-2 py-1 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
                <option value="completed">Completed</option>
                <option value="queued">Queued</option>
              </select>
              <span className={`inline-block px-2 py-0.5 rounded ${runningCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                Running: {runningCount}
              </span>
              <button
                className="ml-2 px-2 py-1 text-xs rounded bg-slate-200 text-slate-700"
                onClick={() => { setStatusFilter('all'); setJobIdQuery(''); }}
                title="Clear status filter and Job ID search"
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200 max-h-96">
            <table className={`min-w-full ${denseMode ? 'text-xs' : 'text-sm'}`}>
              <thead>
                <tr className="text-left text-slate-600 uppercase text-xs bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3`}>Job ID</th>
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Status</th>
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Started</th>
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Finished</th>
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Message</th>
                  <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(ingestJobs || [])
                  .filter(j => (statusFilter === 'all' ? true : j.status === statusFilter))
                  .filter(j => (jobIdQuery.trim().length === 0 ? true : String(j.jobId || '').toLowerCase().includes(jobIdQuery.trim().toLowerCase())))
                  .map((j, idx) => (
                  <tr key={idx} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''} hover:bg-slate-50`}>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3 font-mono text-xs`}>{j.jobId}</td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}><span className={statusChip(j.status)}>{j.status}</span></td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{j.started_at}</td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{j.finished_at || '-'}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 text-xs text-slate-500 max-w-xl truncate`} title={j.message || ''}>{j.message || '-'}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    {(j.status === 'failed' || j.status === 'completed') && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await cdssAdminAPI.retryIngestJob(j.jobId);
                            if (res?.rateLimit) setRateLimit(res.rateLimit);
                            const jobId = res?.data?.jobId || res?.data?.job_id;
                            setMessage(`Retry started • Job ${jobId || ''}`);
                            const jobs = await cdssAdminAPI.getIngestJobs(20);
                            setIngestJobs(jobs?.jobs || []);
                          } catch (e: any) {
                            const reset = Number(e?.response?.headers?.['x-ratelimit-reset'] || 0);
                            if (e?.response?.status === 429 && reset > 0) {
                              setRetryCooldown(reset);
                            }
                            setMessage(e?.response?.data?.detail || 'Retry failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
                        title={retryCooldown > 0 ? `Rate limited • wait ${retryCooldown}s` : 'Retry this job'}
                        disabled={retryCooldown > 0}
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
          <div className="text-sm font-semibold text-slate-700">🧾 Audit Logs</div>
          <div className="flex items-center gap-2">
            <button onClick={handleAuditPrev} disabled={auditOffset <= 0} className="px-3 py-1.5 text-sm rounded bg-slate-200 text-slate-700 disabled:opacity-50">Prev</button>
            <span className="text-xs text-slate-500">offset {auditOffset} • limit {auditLimit}</span>
            <button onClick={handleAuditNext} className="px-3 py-1.5 text-sm rounded bg-slate-200 text-slate-700">Next</button>
            <button onClick={handleRefreshAudit} className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white">Refresh</button>
          </div>
        </div>
        <div className="overflow-auto rounded-lg border border-slate-200 max-h-80">
          <table className={`min-w-full ${denseMode ? 'text-xs' : 'text-sm'}`}>
            <thead>
              <tr className="text-left text-slate-600 uppercase text-xs bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3`}>Time</th>
                <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Actor</th>
                <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Action</th>
                <th className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {(audit?.logs || []).map((log, idx) => (
                <tr key={idx} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''} hover:bg-slate-50`}>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3 text-slate-700`}>{log.created_at}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{log.actor}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{log.action}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 text-xs text-slate-600`}>
                    <pre className="whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-2">{JSON.stringify(log.payload || {}, null, 2)}</pre>
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
