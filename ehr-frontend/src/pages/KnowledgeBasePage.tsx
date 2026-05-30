import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, Clock, AlertCircle, Trash2,
  RefreshCw, Database, Activity, BarChart3, Search, Filter,
  ChevronDown, ChevronUp, Loader2, BookOpen, Layers, AlertTriangle,
} from 'lucide-react';

const DOCUMENT_TYPES = ['guideline', 'protocol', 'formulary', 'policy', 'research'];
const SPECIALTIES = ['general', 'cardiology', 'pharmacy', 'radiology', 'paediatrics', 'oncology', 'hiv', 'tb', 'mental_health'];

const ALL_DOMAINS: Record<string, string> = {
  infectious_disease: 'Infectious Disease',
  cardiology: 'Cardiology',
  obstetrics: 'Obstetrics',
  pediatrics: 'Pediatrics',
  endocrinology: 'Endocrinology / DM',
  oncology: 'Oncology',
  respiratory: 'Respiratory',
  mental_health: 'Mental Health',
  nutrition: 'Nutrition',
  surgery: 'Surgery',
  nephrology: 'Nephrology',
  neurology: 'Neurology',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  emergency: 'Emergency / Critical Care',
  reproductive_health: 'Reproductive Health',
  general: 'General / Other',
};

const EHR_API = (window as any).__RUNTIME_CONFIG__?.ehrApi || process.env.REACT_APP_EHR_API_URL || '';

function tenantId(): string {
  return localStorage.getItem('ehr_tenant') || localStorage.getItem('tenantId') || '';
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${localStorage.getItem('ehr_token') || localStorage.getItem('token') || ''}`,
    'X-Tenant-ID': tenantId(),
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const r = await fetch(`${EHR_API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export const KnowledgeBasePage: React.FC = () => {
  const [tab, setTab] = useState<'coverage' | 'corpus' | 'upload' | 'jobs'>('coverage');

  // Coverage
  const [coverage, setCoverage] = useState<any>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  // Tenant documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Upload form
  const [form, setForm] = useState({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Corpus search
  const [domainFilter, setDomainFilter] = useState('');
  const [corpusDocs, setCorpusDocs] = useState<any[]>([]);
  const [corpusLoading, setCorpusLoading] = useState(false);

  const loadCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try { setCoverage(await apiFetch('/knowledge/corpus/coverage')); } catch { /* non-critical */ }
    finally { setCoverageLoading(false); }
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try { setDocuments(await apiFetch('/knowledge/documents')); } catch { setDocuments([]); }
    finally { setDocsLoading(false); }
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const r = await apiFetch('/knowledge/ingest/jobs?limit=20');
      setJobs(r.jobs || []);
    } catch { setJobs([]); }
    finally { setJobsLoading(false); }
  }, []);

  const loadCorpusDocs = useCallback(async (domain?: string) => {
    setCorpusLoading(true);
    try {
      const qs = domain ? `?domain=${encodeURIComponent(domain)}` : '';
      const r = await apiFetch(`/knowledge/corpus/documents${qs}`);
      setCorpusDocs(r.documents || []);
    } catch { setCorpusDocs([]); }
    finally { setCorpusLoading(false); }
  }, []);

  useEffect(() => { loadCoverage(); loadDocuments(); loadJobs(); }, [loadCoverage, loadDocuments, loadJobs]);

  // Poll active job
  useEffect(() => {
    const running = jobs.find(j => j.status === 'running' || j.status === 'queued');
    if (!running) { setActiveJob(null); if (pollRef.current) clearInterval(pollRef.current); return; }
    const poll = async () => {
      try {
        const r = await apiFetch(`/knowledge/ingest/status/${running.jobId}`);
        setActiveJob(r);
        if (r.status === 'completed' || r.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          loadCoverage(); loadJobs();
        }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs, loadCoverage, loadJobs]);

  const handleUpload = async () => {
    if (!selectedFile || !form.title) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    try {
      await fetch(`${EHR_API}/knowledge/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ehr_token') || localStorage.getItem('token') || ''}`, 'X-Tenant-ID': tenantId() },
        body: fd,
      });
      setSelectedFile(null);
      setForm({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
      await loadDocuments();
    } catch (e: any) { alert('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };

  const statusChip = (status: string) => {
    if (status === 'completed') return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle size={10} />Completed</span>;
    if (status === 'processing') return <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><Loader2 size={10} className="animate-spin" />Processing</span>;
    if (status === 'failed') return <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><AlertCircle size={10} />Failed</span>;
    if (status === 'running') return <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5"><Loader2 size={10} className="animate-spin" />Running</span>;
    return <span className="text-xs text-slate-400">{status}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clinical Knowledge Base</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage, monitor, and analyse the RAG corpus powering all AI clinical recommendations.
            </p>
          </div>
          <button onClick={() => { loadCoverage(); loadDocuments(); loadJobs(); }}
            className="inline-flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-xl px-4 py-2 hover:bg-slate-50">
            <RefreshCw size={14} />Refresh
          </button>
        </div>

        {/* Active job banner */}
        {activeJob && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Ingestion in progress</span>
              </div>
              <span className="text-xs text-blue-600">{activeJob.liveProgress?.elapsedSeconds}s elapsed</span>
            </div>
            {activeJob.liveProgress && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-blue-700 mb-1">
                  <span>{activeJob.liveProgress.currentFile || 'Processing...'}</span>
                  <span>{activeJob.liveProgress.processedFiles}/{activeJob.liveProgress.totalFiles} files · {activeJob.liveProgress.totalChunks} chunks</span>
                </div>
                <div className="h-1.5 rounded-full bg-blue-200">
                  <div className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.round(100 * (activeJob.liveProgress.processedFiles || 0) / Math.max(activeJob.liveProgress.totalFiles || 1, 1))}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {([
            { key: 'coverage', label: 'Domain Coverage', icon: BarChart3 },
            { key: 'corpus', label: 'WHO Corpus', icon: BookOpen },
            { key: 'upload', label: 'Tenant Documents', icon: FileText },
            { key: 'jobs', label: 'Ingestion Jobs', icon: Activity },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'corpus') loadCorpusDocs(domainFilter || undefined); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── COVERAGE TAB ── */}
        {tab === 'coverage' && (
          <div className="space-y-5">
            {coverageLoading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>}
            {!coverageLoading && coverage && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total chunks', value: coverage.totalChunks?.toLocaleString() ?? '—', color: 'text-blue-700', bg: 'bg-blue-50' },
                    { label: 'Documents', value: coverage.totalDocuments ?? '—', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Covered domains', value: coverage.coveredDomains?.length ?? 0, color: 'text-violet-700', bg: 'bg-violet-50' },
                    { label: 'Missing domains', value: coverage.missingDomains?.length ?? 0, color: 'text-red-700', bg: 'bg-red-50' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                      <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Missing domains alert */}
                {coverage.missingDomains?.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={15} className="text-red-500" />
                      <span className="text-sm font-semibold text-red-700">Missing clinical domains — upload guidelines to cover these areas</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {coverage.missingDomains.map((d: string) => (
                        <span key={d} className="inline-block text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
                          {ALL_DOMAINS[d] ?? d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sparse domains warning */}
                {coverage.sparseDomains?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={15} className="text-amber-500" />
                      <span className="text-sm font-semibold text-amber-700">Sparse domains (&lt;20 chunks) — consider adding more documents</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {coverage.sparseDomains.map((d: string) => (
                        <span key={d} className="inline-block text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                          {ALL_DOMAINS[d] ?? d} · {coverage.domainCoverage?.[d]?.chunks} chunks
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Domain grid */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Domain Breakdown</h2>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(ALL_DOMAINS).map(([key, label]) => {
                      const info = coverage.domainCoverage?.[key] ?? { chunks: 0, covered: false };
                      const maxChunks = Math.max(...Object.values(coverage.domainCoverage ?? {}).map((v: any) => v.chunks), 1);
                      const pct = Math.round((info.chunks / maxChunks) * 100);
                      return (
                        <div key={key} className={`rounded-xl border p-3 ${info.covered ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-700">{label}</span>
                            <span className={`text-xs font-bold ${info.covered ? 'text-emerald-600' : 'text-red-500'}`}>
                              {info.chunks} chunks
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${info.covered ? 'bg-emerald-500' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top documents from coverage */}
                {coverage.documents?.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Documents in Corpus ({coverage.documents.length})</h2>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5 text-left">File</th>
                            <th className="px-4 py-2.5 text-left">Domains</th>
                            <th className="px-4 py-2.5 text-right">Chunks</th>
                            <th className="px-4 py-2.5 text-right">Pages</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {coverage.documents.slice(0, 50).map((doc: any) => (
                            <tr key={doc.fileName} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <FileText size={13} className="text-slate-400 shrink-0" />
                                  <span className="font-medium text-slate-800 truncate max-w-[240px]" title={doc.fileName}>{doc.fileName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {(doc.domains || []).map((d: string) => (
                                    <span key={d} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-1.5 py-0.5">
                                      {ALL_DOMAINS[d] ?? d}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-600">{doc.chunkCount}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-500">{doc.pageCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {coverage.documents.length > 50 && (
                        <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t">
                          Showing top 50 of {coverage.documents.length} documents
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {!coverageLoading && !coverage && (
              <div className="text-center py-16 text-slate-400">
                <Database size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No coverage data available. Run an ingestion job first.</p>
                <button onClick={loadCoverage} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
              </div>
            )}
          </div>
        )}

        {/* ── CORPUS TAB ── */}
        {tab === 'corpus' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={domainFilter}
                  onChange={e => { setDomainFilter(e.target.value); loadCorpusDocs(e.target.value || undefined); }}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white appearance-none">
                  <option value="">All domains</option>
                  {Object.entries(ALL_DOMAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <span className="text-xs text-slate-500">{corpusDocs.length} documents</span>
            </div>

            {corpusLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={24} /></div>}
            {!corpusLoading && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {corpusDocs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    No documents found{domainFilter ? ` in domain "${ALL_DOMAINS[domainFilter] ?? domainFilter}"` : ''}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Filename</th>
                        <th className="px-4 py-2.5 text-left">Domains</th>
                        <th className="px-4 py-2.5 text-right">Chunks</th>
                        <th className="px-4 py-2.5 text-right">Pages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {corpusDocs.map((doc: any) => (
                        <tr key={doc.fileName} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <FileText size={13} className="text-slate-400 shrink-0" />
                              <span className="text-slate-800 truncate max-w-[280px]" title={doc.fileName}>{doc.fileName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(doc.domains || []).map((d: string) => (
                                <span key={d} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-1.5 py-0.5">
                                  {ALL_DOMAINS[d] ?? d}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-600">{doc.chunkCount}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500">{doc.pageCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── UPLOAD TAB ── */}
        {tab === 'upload' && (
          <div className="space-y-5">
            {/* Upload form */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Upload Tenant-Specific Document</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    placeholder="e.g. MoHCC HIV Guidelines 2024" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Type *</label>
                  <select value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Specialty</label>
                  <select value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">All specialties</option>
                    {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Source Organization</label>
                  <input value={form.sourceOrganization} onChange={e => setForm(f => ({ ...f, sourceOrganization: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. WHO, MoHCC, NICE" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 bg-white">
                  <Upload size={14} className="text-slate-500" />
                  <span className="text-slate-600">{selectedFile ? selectedFile.name : 'Choose file (PDF / DOCX / TXT)'}</span>
                  <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={handleUpload} disabled={!selectedFile || !form.title || uploading}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {uploading ? <><Loader2 size={14} className="animate-spin" />Processing…</> : <><Upload size={14} />Upload & Ingest</>}
                </button>
              </div>
            </div>

            {/* Document list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Uploaded Documents ({documents.length})</h2>
                <button onClick={loadDocuments} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <RefreshCw size={11} />Refresh
                </button>
              </div>
              {docsLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={20} /></div>}
              {!docsLoading && documents.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  No documents uploaded yet. Upload your first clinical guideline above.
                </div>
              )}
              {!docsLoading && documents.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Title</th>
                        <th className="px-4 py-2.5 text-left">Type / Specialty</th>
                        <th className="px-4 py-2.5 text-center">Chunks</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documents.map((doc: any) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{doc.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{doc.sourceOrganization || '—'} · v{doc.version || '1.0'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{doc.documentType} / {doc.specialty || 'all'}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">{doc.chunkCount ?? '—'}</td>
                          <td className="px-4 py-3 text-center">{statusChip(doc.ingestionStatus)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => {
                              fetch(`${EHR_API}/knowledge/documents/${doc.id}`, {
                                method: 'DELETE', headers: authHeaders() as any,
                              }).then(() => setDocuments(prev => prev.filter(d => d.id !== doc.id)));
                            }} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── JOBS TAB ── */}
        {tab === 'jobs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Recent Ingestion Jobs</h2>
              <button onClick={loadJobs} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <RefreshCw size={11} />Refresh
              </button>
            </div>
            {jobsLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={20} /></div>}
            {!jobsLoading && jobs.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                No ingestion jobs yet.
              </div>
            )}
            {!jobsLoading && jobs.map((job: any) => (
              <div key={job.jobId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusChip(job.status)}
                    <span className="text-xs font-mono text-slate-400">{job.jobId?.slice(0, 8)}</span>
                    <span className="text-xs text-slate-500">{job.payload?.source_mode === 'uploaded_file' ? job.payload?.filename : 'Corpus sync'}</span>
                  </div>
                  <span className="text-xs text-slate-400">{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</span>
                </div>
                {job.result && (
                  <div className="grid grid-cols-3 gap-3 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <span>Files: <strong className="text-slate-700">{job.result.totalFiles}</strong></span>
                    <span>New chunks: <strong className="text-slate-700">{job.result.newChunks}</strong></span>
                    <span>Skipped: <strong className="text-slate-700">{job.result.skippedFiles}</strong></span>
                  </div>
                )}
                {job.status === 'running' && job.liveProgress && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-blue-600 mb-1">
                      <span>{job.liveProgress.currentFile || 'Processing...'}</span>
                      <span>{job.liveProgress.processedFiles}/{job.liveProgress.totalFiles}</span>
                    </div>
                    <div className="h-1 rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.round(100 * (job.liveProgress.processedFiles || 0) / Math.max(job.liveProgress.totalFiles || 1, 1))}%` }} />
                    </div>
                  </div>
                )}
                {job.status === 'failed' && job.error && (
                  <p className="mt-2 text-xs text-red-500 bg-red-50 rounded px-2 py-1">{job.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
