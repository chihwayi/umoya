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

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [st, se, me] = await Promise.all([
        cdssAdminAPI.getStatus(),
        cdssAdminAPI.getSettings(),
        cdssAdminAPI.getMetrics(),
      ]);
      setStatus(st);
      setSettings(se?.settings || se);
      setMetrics(me);
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to load CDSS admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

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
      await cdssAdminAPI.ingest(file || undefined);
      setMessage('Ingestion started');
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
      const me = await cdssAdminAPI.getMetrics();
      setMetrics(me);
      setMessage('Metrics refreshed');
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || 'Failed to load metrics');
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
          </div>
          <button onClick={handleRefreshMetrics} className="mt-3 px-3 py-1.5 text-sm rounded bg-slate-900 text-white">
            Refresh
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
        </div>
      </div>
    </div>
  );
};

