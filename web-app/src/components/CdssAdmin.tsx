import React, { useEffect, useRef, useState } from 'react';
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
        return `${base} bg-emerald-100 text-[#6EE7C2]`;
      case 'queued':
        return `${base} bg-white/[0.04] text-[#C5D5EE]`;
      default:
        return `${base} bg-white/[0.04] text-[#8FA8CC]`;
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
  const [auditPageInput, setAuditPageInput] = useState<string>('1');
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
  const [jobsSortKey, setJobsSortKey] = useState<'jobId' | 'type' | 'status' | 'started_at' | 'finished_at'>(() => {
    try { return (localStorage.getItem('cdssAdmin.jobsSortKey') as any) || 'started_at'; } catch { return 'started_at'; }
  });
  const [jobsSortDir, setJobsSortDir] = useState<'asc' | 'desc'>(() => {
    try { return (localStorage.getItem('cdssAdmin.jobsSortDir') as any) || 'desc'; } catch { return 'desc'; }
  });
  const defaultJobsWidths = { jobId: 140, type: 140, status: 120, started: 160, finished: 160, message: 320, actions: 120 };
  const [jobsColWidths, setJobsColWidths] = useState<{ jobId: number; type: number; status: number; started: number; finished: number; message: number; actions: number }>(() => {
    try {
      const raw = localStorage.getItem('cdssAdmin.jobsColWidths');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? { ...defaultJobsWidths, ...parsed } : defaultJobsWidths;
    } catch {
      return defaultJobsWidths;
    }
  });
  const defaultAuditWidths = { time: 180, actor: 140, action: 180, payload: 520 };
  const [auditColWidths, setAuditColWidths] = useState<{ time: number; actor: number; action: number; payload: number }>(() => {
    try {
      const raw = localStorage.getItem('cdssAdmin.auditColWidths');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? { ...defaultAuditWidths, ...parsed } : defaultAuditWidths;
    } catch {
      return defaultAuditWidths;
    }
  });
  const resizingRef = useRef<{ table: 'jobs' | 'audit'; key: string; startX: number; startWidth: number } | null>(null);
  const [exportingAll, setExportingAll] = useState<boolean>(false);
  const [exportAllCount, setExportAllCount] = useState<number>(0);
  const [auditActorQuery, setAuditActorQuery] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.auditActorQuery') || ''; } catch { return ''; }
  });
  const [auditActionQuery, setAuditActionQuery] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.auditActionQuery') || ''; } catch { return ''; }
  });
  const [auditDateFrom, setAuditDateFrom] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.auditDateFrom') || ''; } catch { return ''; }
  });
  const [auditDateTo, setAuditDateTo] = useState<string>(() => {
    try { return localStorage.getItem('cdssAdmin.auditDateTo') || ''; } catch { return ''; }
  });
  const [ingestionHistory, setIngestionHistory] = useState<any[]>([]);
  const [ingestionSearch, setIngestionSearch] = useState<string>('');
  const [auditSortKey, setAuditSortKey] = useState<'time' | 'actor' | 'action'>(() => {
    try { return (localStorage.getItem('cdssAdmin.auditSortKey') as any) || 'time'; } catch { return 'time'; }
  });
  const [auditSortDir, setAuditSortDir] = useState<'asc' | 'desc'>(() => {
    try { return (localStorage.getItem('cdssAdmin.auditSortDir') as any) || 'desc'; } catch { return 'desc'; }
  });

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [st, se, meResp, au, jobs, history] = await Promise.all([
        cdssAdminAPI.getStatus(),
        cdssAdminAPI.getSettings(),
        cdssAdminAPI.getMetrics(),
        cdssAdminAPI.getAuditLogs(auditLimit, auditOffset, {
          actor: auditActorQuery.trim() || undefined,
          action: auditActionQuery.trim() || undefined,
          startDate: auditDateFrom || undefined,
          endDate: auditDateTo || undefined,
          sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
          sortDir: auditSortDir,
        }),
        cdssAdminAPI.getAdminJobs(50),
        cdssAdminAPI.getIngestionHistory(200),
      ]);
      setStatus(st);
      setSettings(se?.settings || se);
      setMetrics(meResp.metrics || meResp);
      if (meResp.rateLimit) setRateLimit(meResp.rateLimit);
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: auditOffset });
      setIngestJobs(jobs?.jobs || []);
      setIngestionHistory(history?.records || []);
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
          const jobs = await cdssAdminAPI.getAdminJobs(50);
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
    try { localStorage.setItem('cdssAdmin.jobsColWidths', JSON.stringify(jobsColWidths)); } catch {}
  }, [jobsColWidths]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditColWidths', JSON.stringify(auditColWidths)); } catch {}
  }, [auditColWidths]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.jobsSortKey', jobsSortKey); } catch {}
  }, [jobsSortKey]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.jobsSortDir', jobsSortDir); } catch {}
  }, [jobsSortDir]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditActorQuery', auditActorQuery); } catch {}
  }, [auditActorQuery]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditActionQuery', auditActionQuery); } catch {}
  }, [auditActionQuery]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditDateFrom', auditDateFrom); } catch {}
  }, [auditDateFrom]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditDateTo', auditDateTo); } catch {}
  }, [auditDateTo]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditSortKey', auditSortKey); } catch {}
  }, [auditSortKey]);
  useEffect(() => {
    try { localStorage.setItem('cdssAdmin.auditSortDir', auditSortDir); } catch {}
  }, [auditSortDir]);

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
        const [jobs, history] = await Promise.all([
          cdssAdminAPI.getAdminJobs(50),
          cdssAdminAPI.getIngestionHistory(200),
        ]);
        setIngestJobs(jobs?.jobs || []);
        setIngestionHistory(history?.records || []);
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
      const jobId = res?.data?.jobId || res?.data?.job_id;
      setMessage(jobId ? `Reindex started • Job ${jobId}` : 'Reindex requested');
      setAutoRefresh(true);
      const jobs = await cdssAdminAPI.getAdminJobs(50);
      setIngestJobs(jobs?.jobs || []);
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
      const jobId = res?.data?.jobId || res?.data?.job_id;
      setMessage(jobId ? `Cache flush started • Job ${jobId}` : 'Cache flushed');
      setAutoRefresh(true);
      const jobs = await cdssAdminAPI.getAdminJobs(50);
      setIngestJobs(jobs?.jobs || []);
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
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, auditOffset, {
        actor: auditActorQuery.trim() || undefined,
        action: auditActionQuery.trim() || undefined,
        startDate: auditDateFrom || undefined,
        endDate: auditDateTo || undefined,
        sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
        sortDir: auditSortDir,
      });
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
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset, {
        actor: auditActorQuery.trim() || undefined,
        action: auditActionQuery.trim() || undefined,
        startDate: auditDateFrom || undefined,
        endDate: auditDateTo || undefined,
        sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
        sortDir: auditSortDir,
      });
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
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset, {
        actor: auditActorQuery.trim() || undefined,
        action: auditActionQuery.trim() || undefined,
        startDate: auditDateFrom || undefined,
        endDate: auditDateTo || undefined,
        sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
        sortDir: auditSortDir,
      });
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
  useEffect(() => {
    const p = Math.floor(auditOffset / auditLimit) + 1;
    setAuditPageInput(String(p));
  }, [auditOffset, auditLimit]);

  const handleAuditJump = async () => {
    const n = Number(auditPageInput);
    const page = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    const newOffset = (page - 1) * auditLimit;
    setAuditOffset(newOffset);
    setLoading(true);
    try {
      const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset, {
        actor: auditActorQuery.trim() || undefined,
        action: auditActionQuery.trim() || undefined,
        startDate: auditDateFrom || undefined,
        endDate: auditDateTo || undefined,
        sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
        sortDir: auditSortDir,
      });
      setAudit({ logs: au?.logs || [], limit: auditLimit, offset: newOffset });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = (ingestJobs || [])
    .filter(j => (statusFilter === 'all' ? true : j.status === statusFilter))
    .filter(j => (jobIdQuery.trim().length === 0 ? true : String(j.jobId || '').toLowerCase().includes(jobIdQuery.trim().toLowerCase())));

  const sortedJobs = [...filteredJobs].sort((a: any, b: any) => {
    const key = jobsSortKey;
    const dir = jobsSortDir === 'asc' ? 1 : -1;
    const va = key === 'started_at' || key === 'finished_at' ? new Date(a[key] || 0).getTime() : String(a[key] || '');
    const vb = key === 'started_at' || key === 'finished_at' ? new Date(b[key] || 0).getTime() : String(b[key] || '');
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const toggleSort = (key: 'jobId' | 'type' | 'status' | 'started_at' | 'finished_at') => {
    if (jobsSortKey === key) {
      setJobsSortDir(jobsSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setJobsSortKey(key);
      setJobsSortDir(key === 'jobId' ? 'asc' : 'desc');
    }
  };
  const sortIndicator = (key: string) => jobsSortKey === key ? (jobsSortDir === 'asc' ? '▲' : '▼') : '';

  const exportJobsCsv = () => {
    const headers = ['jobId', 'type', 'status', 'started_at', 'finished_at', 'message'];
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')].concat(
      filteredJobs.map((j: any) =>
        [j.jobId, j.type || '', j.status, j.started_at, j.finished_at || '', j.message || ''].map((x: any) => esc(String(x))).join(',')
      )
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jobs-filtered.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const beginResize = (table: 'jobs' | 'audit', key: string, current: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { table, key, startX: e.clientX, startWidth: current };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = ev.clientX - resizingRef.current.startX;
      const w = Math.max(80, resizingRef.current.startWidth + dx);
      if (resizingRef.current.table === 'jobs') {
        setJobsColWidths((prev) => ({ ...prev, [resizingRef.current!.key]: w }));
      } else {
        setAuditColWidths((prev) => ({ ...prev, [resizingRef.current!.key]: w }));
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const exportAuditCsv = () => {
    const rows = auditRows;
    const headers = ['created_at', 'actor', 'action', 'payload'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [headers.join(',')].concat(
      rows.map((r: any) => {
        const payload = JSON.stringify(r?.payload || {});
        return [String(r?.created_at || ''), String(r?.actor || ''), String(r?.action || ''), payload].map((x) => esc(String(x))).join(',');
      })
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllAuditCsv = async () => {
    setExportingAll(true);
    setExportAllCount(0);
    try {
      const headers = ['created_at', 'actor', 'action', 'payload'];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines: string[] = [headers.join(',')];
      const pageSize = 500;
      let offset = 0;
      while (true) {
        const au = await cdssAdminAPI.getAuditLogs(pageSize, offset, {
          actor: auditActorQuery.trim() || undefined,
          action: auditActionQuery.trim() || undefined,
          startDate: auditDateFrom || undefined,
          endDate: auditDateTo || undefined,
          sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
          sortDir: auditSortDir,
        });
        const rows: any[] = au?.logs || [];
        if (!rows.length) break;
        for (const r of rows) {
          const payload = JSON.stringify(r?.payload || {});
          lines.push([String(r?.created_at || ''), String(r?.actor || ''), String(r?.action || ''), payload].map((x) => esc(String(x))).join(','));
        }
        setExportAllCount((c) => c + rows.length);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-logs-all.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingAll(false);
    }
  };

  const resetJobsColWidths = () => {
    setJobsColWidths(defaultJobsWidths);
  };
  const resetAuditColWidths = () => {
    setAuditColWidths(defaultAuditWidths);
  };

  const relTime = (v: any) => {
    if (!v) return '-';
    const t = new Date(v).getTime();
    if (!Number.isFinite(t)) return '-';
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  const [nowTick, setNowTick] = useState<number>(0);
  useEffect(() => {
    const i = setInterval(() => setNowTick((v) => v + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const auditRows = audit?.logs || [];
  const filteredIngestionHistory = (ingestionHistory || []).filter((item: any) => {
    const q = ingestionSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      item?.fileName,
      item?.versionLabel,
      item?.fileSha256,
      item?.owner,
      item?.jobId,
      item?.status,
      item?.sourceMode,
    ].map((v) => String(v || '').toLowerCase()).join(' ');
    return haystack.includes(q);
  });

  const toggleAuditSort = (key: 'time' | 'actor' | 'action') => {
    if (auditSortKey === key) {
      setAuditSortDir(auditSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setAuditSortKey(key);
      setAuditSortDir(key === 'time' ? 'desc' : 'asc');
    }
  };
  const auditSortIndicator = (key: string) => auditSortKey === key ? (auditSortDir === 'asc' ? '▲' : '▼') : '';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const au = await cdssAdminAPI.getAuditLogs(auditLimit, auditOffset, {
          actor: auditActorQuery.trim() || undefined,
          action: auditActionQuery.trim() || undefined,
          startDate: auditDateFrom || undefined,
          endDate: auditDateTo || undefined,
          sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
          sortDir: auditSortDir,
        });
        setAudit({ logs: au?.logs || [], limit: auditLimit, offset: auditOffset });
      } finally {
        setLoading(false);
      }
    })();
  }, [auditSortKey, auditSortDir]);

  useEffect(() => {
    const handle = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const newOffset = 0;
          setAuditOffset(newOffset);
          const au = await cdssAdminAPI.getAuditLogs(auditLimit, newOffset, {
            actor: auditActorQuery.trim() || undefined,
            action: auditActionQuery.trim() || undefined,
            startDate: auditDateFrom || undefined,
            endDate: auditDateTo || undefined,
            sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
            sortDir: auditSortDir,
          });
          setAudit({ logs: au?.logs || [], limit: auditLimit, offset: newOffset });
        } finally {
          setLoading(false);
        }
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [auditActorQuery, auditActionQuery, auditDateFrom, auditDateTo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const au = await cdssAdminAPI.getAuditLogs(auditLimit, 0, {
          actor: auditActorQuery.trim() || undefined,
          action: auditActionQuery.trim() || undefined,
          startDate: auditDateFrom || undefined,
          endDate: auditDateTo || undefined,
          sortKey: auditSortKey === 'time' ? 'created_at' : auditSortKey,
          sortDir: auditSortDir,
        });
        setAudit({ logs: au?.logs || [], limit: auditLimit, offset: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [auditLimit]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">🧠 CDSS Administration</h2>
          <div className="text-sm text-[#7A9AB8]">Manage AI features, ingestion, caching and audit trails</div>
        </div>
        {loading && <span className="text-sm text-[#FF7A40]">Processing…</span>}
      </div>

      {message && (
        <div className="p-3 rounded-xl text-sm bg-[#00C896]/10 border border-emerald-200 text-[#4DDBB0]">{message}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#0A1525] border border-white/[0.10] shadow-sm rounded-2xl p-4 border-t-4 border-indigo-500">
          <div className="text-xs font-semibold text-[#8FA8CC] uppercase tracking-wide">LLM</div>
          <div className="mt-2 text-sm space-y-1 text-white">
            <div>Enabled: {String(status?.llm?.enabled ?? '')}</div>
            <div>Model: {status?.llm?.model || '-'}</div>
            <div>API URL: {status?.llm?.api_url || '-'}</div>
          </div>
        </div>
        <div className="bg-[#0A1525] border border-white/[0.10] shadow-sm rounded-2xl p-4 border-t-4 border-amber-500">
          <div className="text-xs font-semibold text-[#8FA8CC] uppercase tracking-wide">RAG</div>
          <div className="mt-2 text-sm space-y-1 text-white">
            <div>Enabled: {String(status?.rag?.enabled ?? '')}</div>
            <div>Documents: {status?.rag?.documents ?? '-'}</div>
            <div>Cache: {status?.rag?.cache_enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
        <div className="bg-[#0A1525] border border-white/[0.10] shadow-sm rounded-2xl p-4 border-t-4 border-emerald-500">
          <div className="text-xs font-semibold text-[#8FA8CC] uppercase tracking-wide">Metrics</div>
          <div className="mt-2 text-sm space-y-1 text-white">
            <div>Doc count: {metrics?.documents ?? '-'}</div>
            <div>Cache keys: {metrics?.cache_keys ?? '-'}</div>
            <div>RAG cache: {metrics?.rag_cache ? `${metrics.rag_cache.hit} hit / ${metrics.rag_cache.miss} miss (${metrics.rag_cache.hit_rate_percent}% hit)` : '-'}</div>
            <div>LLM cache: {metrics?.llm_cache ? `${metrics.llm_cache.hit} hit / ${metrics.llm_cache.miss} miss (${metrics.llm_cache.hit_rate_percent}% hit)` : '-'}</div>
            {rateLimit && (
              <div className="text-xs text-[#7A9AB8] mt-1">Rate limit: {rateLimit.remaining}/{rateLimit.limit} • resets in {rateLimit.reset}s</div>
            )}
          </div>
          <button
            onClick={handleRefreshMetrics}
            className="mt-3 px-3 py-1.5 text-sm rounded-2xl bg-[#060C16] text-white shadow-sm hover:bg-[#0D1829] transition"
          >
            Refresh
          </button>
          <button
            onClick={handleResetMetrics}
            className="mt-3 ml-2 px-3 py-1.5 text-sm rounded-2xl bg-rose-700 text-white shadow-sm hover:bg-rose-800 transition"
          >
            Reset Counters
          </button>
        </div>
      </div>

      <div className="bg-[#0A1525] border border-white/[0.10] shadow-sm rounded-2xl p-5 space-y-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-[#7A9AB8] uppercase">Configuration</div>
            <div className="mt-1 text-sm font-semibold text-white">🔧 Settings</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className="block text-xs text-[#8FA8CC] uppercase mb-1">LLM Model Name</label>
            <input
              className="w-full border border-white/[0.10] rounded-2xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              value={settings?.llm_model_name || ''}
              onChange={(e) => setSettings({ ...settings, llm_model_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8FA8CC] uppercase mb-1">LLM API URL</label>
            <input
              className="w-full border border-white/[0.10] rounded-2xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              value={settings?.llm_api_url || ''}
              onChange={(e) => setSettings({ ...settings, llm_api_url: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8FA8CC] uppercase mb-1">RAG Enabled</label>
            <select
              className="w-full border border-white/[0.10] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              value={String(settings?.rag_enabled ?? true)}
              onChange={(e) => setSettings({ ...settings, rag_enabled: e.target.value === 'true' })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8FA8CC] uppercase mb-1">Cache TTL (seconds)</label>
            <input
              type="number"
              className="w-full border border-white/[0.10] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              value={String(settings?.cache_ttl_seconds ?? 300)}
              onChange={(e) => setSettings({ ...settings, cache_ttl_seconds: Number(e.target.value || 0) })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-2xl bg-[#060C16] text-white shadow-sm hover:bg-[#0D1829] transition disabled:opacity-50"
            disabled={saveCooldown > 0}
            title={saveCooldown > 0 ? `Rate limited • wait ${saveCooldown}s` : 'Save settings'}
          >
            Save
          </button>
        </div>
      </div>

      <div className="bg-[#0A1525] border border-white/[0.10] shadow-sm rounded-2xl p-5 space-y-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-[#7A9AB8] uppercase">Pipelines</div>
            <div className="mt-1 text-sm font-semibold text-white">📚 Ingestion & Index</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="text-sm w-full sm:w-auto text-white file:mr-3 file:rounded-md file:border file:border-white/[0.10] file:bg-white/[0.04] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/[0.06]"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={handleIngest}
            className="px-4 py-2 rounded-2xl bg-blue-600 text-white disabled:opacity-50 shadow-sm hover:bg-blue-700 transition w-full sm:w-auto"
            disabled={ingestCooldown > 0}
            title={ingestCooldown > 0 ? `Rate limited • wait ${ingestCooldown}s` : 'Upload a PDF and start ingestion'}
          >
            Upload & Ingest
          </button>
          <button
            onClick={handleReindex}
            className="px-4 py-2 rounded-2xl bg-amber-600 text-white disabled:opacity-50 shadow-sm hover:bg-amber-700 transition w-full sm:w-auto"
            disabled={reindexCooldown > 0}
            title={reindexCooldown > 0 ? `Rate limited • wait ${reindexCooldown}s` : 'Rebuild vector + BM25 indexes'}
          >
            Reindex
          </button>
          <button
            onClick={handleFlushCache}
            className="px-4 py-2 rounded-2xl bg-rose-600 text-white disabled:opacity-50 shadow-sm hover:bg-rose-700 transition w-full sm:w-auto"
            disabled={flushCooldown > 0}
            title={flushCooldown > 0 ? `Rate limited • wait ${flushCooldown}s` : 'Delete cache entries'}
          >
            Flush Cache
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <label className="text-xs text-[#8FA8CC]">Auto-refresh</label>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <label className="text-xs text-[#8FA8CC]">Every (s)</label>
            <input
              type="number"
              className="w-16 border border-white/[0.10] rounded px-2 py-1 text-sm"
              value={String(refreshSecs)}
              onChange={(e) => setRefreshSecs(Math.max(2, Number(e.target.value || 5)))}
            />
            <button
              onClick={async () => {
                const jobs = await cdssAdminAPI.getAdminJobs(50);
                setIngestJobs(jobs?.jobs || []);
              }}
              className="px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition"
            >
              Refresh Now
            </button>
            <div className="ml-3 flex items-center gap-2">
              <label className="text-xs text-[#8FA8CC]">Dense</label>
              <input type="checkbox" checked={denseMode} onChange={(e) => setDenseMode(e.target.checked)} />
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mt-2 mb-1">
            <div className="text-xs font-semibold text-[#8FA8CC] uppercase">Jobs</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
                placeholder="Search Job ID"
                value={jobIdQuery}
                onChange={(e) => setJobIdQuery(e.target.value)}
              />
              <select
                className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
                <option value="completed">Completed</option>
                <option value="queued">Queued</option>
              </select>
              <span className={`inline-block px-2 py-0.5 rounded ${runningCount > 0 ? 'bg-emerald-100 text-[#6EE7C2]' : 'bg-white/[0.04] text-[#8FA8CC]'}`}>
                Running: {runningCount}
              </span>
              <button
                className="ml-2 px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition"
                onClick={() => { setStatusFilter('all'); setJobIdQuery(''); }}
                title="Clear status filter and Job ID search"
              >
                Clear Filters
              </button>
              <button
                className="px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition"
                onClick={resetJobsColWidths}
                title="Reset column widths"
              >
                Reset Cols
              </button>
              <button
                className="px-2 py-1 text-xs rounded bg-[#00C896] text-white hover:bg-emerald-700 transition"
                onClick={exportJobsCsv}
                title="Export current Jobs view to CSV"
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-auto rounded-2xl border border-white/[0.07] max-h-96">
            <table className={`min-w-full ${denseMode ? 'text-xs' : 'text-sm'}`} style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="text-left text-[#8FA8CC] uppercase text-xs bg-[#080E1A] border-b border-white/[0.07] sticky top-0 z-10">
                  <th style={{ width: jobsColWidths.jobId }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3`}>
                    <div className="relative pr-2">
                      <button onClick={() => toggleSort('jobId')} className="text-left w-full">
                        Job ID <span className="text-[#5A78A0]">{sortIndicator('jobId')}</span>
                      </button>
                      <div onMouseDown={beginResize('jobs', 'jobId', jobsColWidths.jobId)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.type }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <button onClick={() => toggleSort('type')} className="text-left w-full">
                        Type <span className="text-[#5A78A0]">{sortIndicator('type')}</span>
                      </button>
                      <div onMouseDown={beginResize('jobs', 'type', jobsColWidths.type)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.status }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <button onClick={() => toggleSort('status')} className="text-left w-full">
                        Status <span className="text-[#5A78A0]">{sortIndicator('status')}</span>
                      </button>
                      <div onMouseDown={beginResize('jobs', 'status', jobsColWidths.status)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.started }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <button onClick={() => toggleSort('started_at')} className="text-left w-full">
                        Started <span className="text-[#5A78A0]">{sortIndicator('started_at')}</span>
                      </button>
                      <div onMouseDown={beginResize('jobs', 'started', jobsColWidths.started)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.finished }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <button onClick={() => toggleSort('finished_at')} className="text-left w-full">
                        Finished <span className="text-[#5A78A0]">{sortIndicator('finished_at')}</span>
                      </button>
                      <div onMouseDown={beginResize('jobs', 'finished', jobsColWidths.finished)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.message }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <span>Message</span>
                      <div onMouseDown={beginResize('jobs', 'message', jobsColWidths.message)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                  <th style={{ width: jobsColWidths.actions }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    <div className="relative pr-2">
                      <span>Actions</span>
                      <div onMouseDown={beginResize('jobs', 'actions', jobsColWidths.actions)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((j, idx) => (
                  <tr key={idx} className={`border-t border-white/[0.05] ${idx % 2 === 1 ? 'bg-[#080E1A]/50' : ''} hover:bg-[#080E1A]`}>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3 font-mono text-xs`}>
                      {j.jobId}
                      <button
                        className="ml-2 px-1 py-0.5 text-[10px] rounded bg-white/[0.06] text-[#C5D5EE]"
                        onClick={() => navigator.clipboard?.writeText(String(j.jobId || '')).catch(() => {})}
                        title="Copy Job ID"
                      >
                        Copy
                      </button>
                    </td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-white/[0.04] text-[#C5D5EE]">
                        {j.type || 'ingest'}
                      </span>
                    </td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}><span className={statusChip(j.status)}>{j.status}</span></td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`} title={j.started_at || ''}>{relTime(j.started_at)}{nowTick ? '' : ''}</td>
                    <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`} title={j.finished_at || ''}>{j.finished_at ? relTime(j.finished_at) : '-' }{nowTick ? '' : ''}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 text-xs text-[#7A9AB8] max-w-xl truncate`} title={j.message || ''}>{j.message || '-'}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                    {(j.status === 'failed' || j.status === 'completed') && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await cdssAdminAPI.retryAdminJob(j.jobId);
                            if (res?.rateLimit) setRateLimit(res.rateLimit);
                            const jobId = res?.data?.jobId || res?.data?.job_id;
                            setMessage(`Retry started • Job ${jobId || ''}`);
                            const jobs = await cdssAdminAPI.getAdminJobs(50);
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

      <div className="bg-[#0A1525] border border-white/[0.10] rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#C5D5EE]">🗂 Ingestion History</div>
            <div className="text-xs text-[#7A9AB8] mt-1">
              Track ingested document versions, hashes, and duplicate uploads.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              placeholder="Search file/version/hash"
              value={ingestionSearch}
              onChange={(e) => setIngestionSearch(e.target.value)}
            />
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const history = await cdssAdminAPI.getIngestionHistory(200, ingestionSearch.trim() || undefined);
                  setIngestionHistory(history?.records || []);
                } catch {
                  setMessage('Failed to refresh ingestion history');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-3 py-1.5 text-sm rounded bg-[#060C16] text-white hover:bg-[#0D1829] transition"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto border border-white/[0.07] rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#080E1A] border-b border-white/[0.07] text-left text-[#8FA8CC] uppercase text-xs">
              <tr>
                <th className="py-2 px-3">Document</th>
                <th className="py-2 px-3">Version</th>
                <th className="py-2 px-3">SHA-256</th>
                <th className="py-2 px-3">Chunks</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Ingested</th>
                <th className="py-2 px-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngestionHistory.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 px-3 text-xs text-[#7A9AB8]">
                    No ingestion records yet.
                  </td>
                </tr>
              )}
              {filteredIngestionHistory.map((row: any, idx: number) => (
                <tr key={`${row?.jobId || 'job'}-${idx}`} className="border-t border-white/[0.05] hover:bg-[#080E1A]/70">
                  <td className="py-2 px-3">
                    <div className="font-medium text-white">{row?.fileName || 'Unknown'}</div>
                    <div className="text-[11px] text-[#7A9AB8]">Job {row?.jobId || '-'}</div>
                  </td>
                  <td className="py-2 px-3 text-xs text-[#C5D5EE]">{row?.versionLabel || 'n/a'}</td>
                  <td className="py-2 px-3 text-xs font-mono text-[#8FA8CC]">
                    {row?.fileSha256 ? `${String(row.fileSha256).slice(0, 12)}…` : 'n/a'}
                    {row?.duplicate ? (
                      <span className="ml-2 inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                        duplicate
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 px-3 text-xs text-[#C5D5EE]">{row?.chunkCount ?? '-'}</td>
                  <td className="py-2 px-3">
                    <span className={statusChip(String(row?.status || 'unknown'))}>{String(row?.status || 'unknown')}</span>
                  </td>
                  <td className="py-2 px-3 text-xs text-[#8FA8CC]" title={row?.ingestedAt || ''}>
                    {row?.ingestedAt ? relTime(row.ingestedAt) : '-'}
                  </td>
                  <td className="py-2 px-3 text-xs text-[#C5D5EE]">{row?.owner || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#0A1525] border border-white/[0.10] rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-[#C5D5EE]">🧾 Audit Logs</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleAuditPrev} disabled={auditOffset <= 0} className="px-3 py-1.5 text-sm rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 disabled:opacity-50 transition">Prev</button>
            <span className="text-xs text-[#7A9AB8]">page {Math.floor(auditOffset / auditLimit) + 1}</span>
            <span className="text-xs text-[#5A78A0]">•</span>
            <span className="text-xs text-[#7A9AB8]">offset {auditOffset}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#7A9AB8]">page</span>
              <input
                className="w-16 border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
                value={auditPageInput}
                onChange={(e) => setAuditPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuditJump(); }}
              />
              <button onClick={handleAuditJump} className="px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition">Go</button>
            </div>
            <input
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              placeholder="Filter actor"
              value={auditActorQuery}
              onChange={(e) => setAuditActorQuery(e.target.value)}
              title="Filter by actor"
            />
            <input
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              placeholder="Filter action"
              value={auditActionQuery}
              onChange={(e) => setAuditActionQuery(e.target.value)}
              title="Filter by action"
            />
            <input
              type="date"
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              value={auditDateFrom}
              onChange={(e) => setAuditDateFrom(e.target.value)}
              title="From date"
            />
            <input
              type="date"
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              value={auditDateTo}
              onChange={(e) => setAuditDateTo(e.target.value)}
              title="To date"
            />
            <button
              onClick={() => { setAuditActorQuery(''); setAuditActionQuery(''); setAuditDateFrom(''); setAuditDateTo(''); }}
              className="px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition"
              title="Clear audit filters"
            >
              Clear
            </button>
            <select
              className="border border-white/[0.10] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-400"
              value={auditLimit}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                setAuditLimit(newLimit);
                setAuditOffset(0);
              }}
            >
              <option value={20}>limit 20</option>
              <option value={50}>limit 50</option>
              <option value={100}>limit 100</option>
            </select>
            <button onClick={handleAuditNext} className="px-3 py-1.5 text-sm rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition">Next</button>
            <button onClick={resetAuditColWidths} className="px-3 py-1.5 text-sm rounded bg-white/[0.06] text-[#C5D5EE] hover:bg-slate-300 transition">Reset Cols</button>
            <button onClick={exportAllAuditCsv} disabled={exportingAll} className="px-3 py-1.5 text-sm rounded bg-emerald-700 text-white disabled:opacity-50 hover:bg-emerald-800 transition">{exportingAll ? `Exporting… ${exportAllCount}` : 'Export All CSV'}</button>
            <button onClick={exportAuditCsv} className="px-3 py-1.5 text-sm rounded bg-[#00C896] text-white hover:bg-emerald-700 transition">Export CSV</button>
            <button onClick={handleRefreshAudit} className="px-3 py-1.5 text-sm rounded bg-[#060C16] text-white hover:bg-[#0D1829] transition">Refresh</button>
          </div>
        </div>
        <div className="overflow-auto rounded-2xl border border-white/[0.07] max-h-80">
          <table className={`min-w-full ${denseMode ? 'text-xs' : 'text-sm'}`} style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="text-left text-[#8FA8CC] uppercase text-xs bg-[#080E1A] border-b border-white/[0.07] sticky top-0 z-10">
                <th style={{ width: auditColWidths.time }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3`}>
                  <div className="relative pr-2">
                    <button onClick={() => toggleAuditSort('time')} className="text-left w-full">
                      Time <span className="text-[#5A78A0]">{auditSortIndicator('time')}</span>
                    </button>
                    <div onMouseDown={beginResize('audit', 'time', auditColWidths.time)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                  </div>
                </th>
                <th style={{ width: auditColWidths.actor }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                  <div className="relative pr-2">
                    <button onClick={() => toggleAuditSort('actor')} className="text-left w-full">
                      Actor <span className="text-[#5A78A0]">{auditSortIndicator('actor')}</span>
                    </button>
                    <div onMouseDown={beginResize('audit', 'actor', auditColWidths.actor)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                  </div>
                </th>
                <th style={{ width: auditColWidths.action }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                  <div className="relative pr-2">
                    <button onClick={() => toggleAuditSort('action')} className="text-left w-full">
                      Action <span className="text-[#5A78A0]">{auditSortIndicator('action')}</span>
                    </button>
                    <div onMouseDown={beginResize('audit', 'action', auditColWidths.action)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                  </div>
                </th>
                <th style={{ width: auditColWidths.payload }} className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>
                  <div className="relative pr-2">
                    <span>Payload</span>
                    <div onMouseDown={beginResize('audit', 'payload', auditColWidths.payload)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-slate-300 opacity-0 hover:opacity-100"></div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((log: any, idx: number) => (
                <tr key={idx} className={`border-t border-white/[0.05] ${idx % 2 === 1 ? 'bg-[#080E1A]/50' : ''} hover:bg-[#080E1A]`}>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 pl-3 text-[#C5D5EE]`} title={log.created_at || ''}>{relTime(log.created_at)}{nowTick ? '' : ''}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{log.actor}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4`}>{log.action}</td>
                  <td className={`${denseMode ? 'py-1' : 'py-2'} pr-4 text-xs text-[#8FA8CC]`}>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 whitespace-pre-wrap bg-[#080E1A] border border-white/[0.07] rounded p-2">{JSON.stringify(log.payload || {}, null, 2)}</pre>
                      <button
                        className="px-2 py-1 text-xs rounded bg-white/[0.06] text-[#C5D5EE]"
                        onClick={() => navigator.clipboard?.writeText(JSON.stringify(log.payload || {}, null, 2)).catch(() => {})}
                        title="Copy payload JSON"
                      >
                        Copy
                      </button>
                    </div>
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
