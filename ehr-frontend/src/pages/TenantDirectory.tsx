import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi, cdssApi } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Building2, ArrowRight, QrCode, Database, Upload, X, FileText } from 'lucide-react';
import { TenantQRModal } from '../components/TenantQRModal';

interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  status: string;
  logoUrl?: string;
  subscriptionTier?: string;
}

const ITEMS_PER_PAGE = 9;

interface IngestLiveProgress {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  currentFile: string | null;
  elapsedSeconds: number;
  status: string;
}

const CDSSIngestPanel: React.FC<{
  status: 'idle' | 'running' | 'done' | 'error';
  progress: IngestLiveProgress | null;
  error: string;
  onSync: () => void;
  onUpload: (file: File) => void;
}> = ({ status, progress, error, onSync, onUpload }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fmt = (s: number) => s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;

  const processed = progress?.processedFiles ?? 0;
  const total = progress?.totalFiles ?? 0;
  const skipped = progress?.skippedFiles ?? 0;
  const chunks = progress?.totalChunks ?? 0;
  const elapsed = progress?.elapsedSeconds ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const rate = elapsed > 0 && processed > 0 ? processed / elapsed : null;
  const eta = rate && status === 'running' && total > processed ? (total - processed) / rate : null;
  const currentFileName = progress?.currentFile
    ? progress.currentFile.split('/').pop() ?? progress.currentFile
    : null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') setUploadFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadFile(f);
  };

  const handleConfirmUpload = () => {
    if (uploadFile) {
      onUpload(uploadFile);
      setUploadFile(null);
      setShowUpload(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowUpload(v => !v); setUploadFile(null); }}
          disabled={status === 'running'}
          title="Upload a single updated guideline PDF"
          className="inline-flex items-center gap-2 rounded-full border border-[#3B9EFF]/30 bg-[#3B9EFF]/10 px-4 py-3 text-sm font-medium text-[#7DB9FF] transition hover:border-[#3B9EFF]/60 hover:bg-[#3B9EFF]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Upload Guideline
        </button>
        <button
          onClick={onSync}
          disabled={status === 'running'}
          className="inline-flex items-center gap-2 rounded-full border border-[#0AA98A]/30 bg-[#0AA98A]/10 px-5 py-3 text-sm font-medium text-[#7DE8CA] transition hover:border-[#0AA98A]/60 hover:bg-[#0AA98A]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'running' ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#0AA98A]" /> : <Database className="h-4 w-4" />}
          {status === 'running' ? 'Ingesting...' : status === 'done' ? 'Re-sync Guidelines' : 'Sync CDSS Guidelines'}
        </button>
      </div>

      {/* Single-file upload dropzone */}
      {showUpload && status !== 'running' && (
        <div className="w-80 rounded-2xl border border-[#3B9EFF]/20 bg-[#0A1525]/90 p-4 shadow-lg backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7DB9FF]">Upload updated guideline PDF</span>
            <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="text-[#4A6080] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploadFile && fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 transition ${dragOver ? 'border-[#3B9EFF]/60 bg-[#3B9EFF]/10' : 'border-white/15 hover:border-[#3B9EFF]/40'}`}
          >
            {uploadFile ? (
              <div className="flex items-center gap-2 text-xs text-[#7DB9FF]">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate max-w-[200px]" title={uploadFile.name}>{uploadFile.name}</span>
                <button onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="ml-1 text-[#4A6080] hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-[#4A6080]" />
                <p className="text-center text-[11px] text-[#4A6080]">Drop PDF here or click to select<br /><span className="text-[#3B9EFF]/70">PDF only · max 50 MB</span></p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
          {uploadFile && (
            <button
              onClick={handleConfirmUpload}
              className="mt-3 w-full rounded-xl bg-[#3B9EFF] py-2 text-xs font-semibold text-white transition hover:bg-[#1a6aee]"
            >
              Ingest this guideline
            </button>
          )}
          <p className="mt-2 text-[10px] text-[#3A5070]">Existing files are skipped automatically via SHA-256 manifest — only new or changed PDFs are re-indexed.</p>
        </div>
      )}

      {/* Progress panel — shown while running or after completion */}
      {(status === 'running' || status === 'done') && progress && (
        <div className="w-80 rounded-2xl border border-white/10 bg-[#0A1525]/90 p-4 shadow-lg backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#7DE8CA]">
              {status === 'done' ? 'Ingest complete' : 'Ingesting guidelines...'}
            </span>
            <span className="tabular-nums text-[#7A92B8]">{processed} / {total} files</span>
          </div>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-[#0AA98A] transition-all duration-300"
              style={{ width: `${pct}%`, boxShadow: status === 'running' ? '0 0 8px rgba(0,200,150,0.6)' : 'none' }}
            />
          </div>
          <div className="mb-2 flex justify-between text-[11px] text-[#587296]">
            <span>{pct}%{status === 'running' && eta !== null ? ` · ~${fmt(eta)} left` : ''}</span>
            <span>Elapsed: {fmt(elapsed)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 px-3 py-2 text-center text-[11px]">
            <div>
              <div className="font-semibold text-white">{processed}</div>
              <div className="text-[#4A6080]">ingested</div>
            </div>
            <div>
              <div className="font-semibold text-[#7A92B8]">{skipped}</div>
              <div className="text-[#4A6080]">skipped</div>
            </div>
            <div>
              <div className="font-semibold text-[#7DB9FF]">{chunks.toLocaleString()}</div>
              <div className="text-[#4A6080]">chunks</div>
            </div>
          </div>
          {status === 'running' && currentFileName && (
            <p className="mt-2 truncate text-[11px] text-[#4A6080]" title={currentFileName}>
              ↳ {currentFileName}
            </p>
          )}
          {status === 'done' && (
            <p className="mt-2 text-[11px] text-[#7DE8CA]">BM25 index rebuilt · {chunks.toLocaleString()} chunks in ChromaDB</p>
          )}
        </div>
      )}

      {status === 'error' && error && (
        <span className="max-w-xs text-right text-xs text-[#FF7D92]">{error}</span>
      )}
    </div>
  );
};

const TenantDirectory: React.FC = () => {
  const navigate = useNavigate();
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya-dark-transparent.png`;

  // CDSSIngestPanel is only for super-admins logged in to the admin portal (web-app on :3011)
  const isSuperAdmin = (() => {
    try { return Boolean(localStorage.getItem('auth_token')); } catch { return false; }
  })();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [qrTenant, setQrTenant] = useState<Tenant | null>(null);
  const [ingestStatus, setIngestStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [ingestProgress, setIngestProgress] = useState<IngestLiveProgress | null>(null);
  const [ingestError, setIngestError] = useState('');
  const ingestPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (ingestPollRef.current) { clearInterval(ingestPollRef.current); ingestPollRef.current = null; } };

  const startIngestPoll = (jobId: string) => {
    stopPoll();
    ingestPollRef.current = setInterval(async () => {
      try {
        const res = await cdssApi.getIngestStatus(jobId);
        const d = res.data;
        if (d.liveProgress) setIngestProgress(d.liveProgress);
        if (d.status === 'completed' || (d.liveProgress?.status === 'completed')) {
          stopPoll();
          setIngestStatus('done');
        } else if (d.status === 'error' || d.status === 'failed') {
          stopPoll();
          setIngestError(d.error ?? 'Ingest failed');
          setIngestStatus('error');
        }
      } catch { /* poll silently */ }
    }, 800);
  };

  const handleSync = async () => {
    setIngestStatus('running');
    setIngestProgress(null);
    setIngestError('');
    stopPoll();
    try {
      const res = await cdssApi.triggerIngest();
      startIngestPoll(res.data.jobId);
    } catch (err: any) {
      setIngestError(err?.response?.data?.detail || err?.message || 'Unknown error');
      setIngestStatus('error');
    }
  };

  const handleUploadGuideline = async (file: File) => {
    setIngestStatus('running');
    setIngestProgress(null);
    setIngestError('');
    stopPoll();
    try {
      const res = await cdssApi.triggerIngest(file);
      startIngestPoll(res.data.jobId);
    } catch (err: any) {
      setIngestError(err?.response?.data?.detail || err?.message || 'Upload failed');
      setIngestStatus('error');
    }
  };

  useEffect(() => () => stopPoll(), []);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await tenantApi.getActiveTenants();
        setTenants(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch tenants', err);
        setError('Failed to load clinic directory');
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) =>
      tenant.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [tenants, searchQuery]);

  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleTenantSelect = (subdomain: string) => {
    navigate(`/ehr/${subdomain}`);
  };

  const getTierColor = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'enterprise':
        return 'border-[#A66CFF]/40 bg-[#A66CFF]/14 text-[#E4D6FF]';
      case 'professional':
        return 'border-[#3B9EFF]/40 bg-[#3B9EFF]/14 text-[#CFE0FF]';
      default:
        return 'border-white/10 bg-white/5 text-[#B9CBE6]';
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080E1A] text-[#E8F0FF]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-[-12rem] mx-auto h-[34rem] w-[34rem] rounded-full bg-[#0AA98A]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[18rem] h-[24rem] w-[24rem] rounded-full bg-[#3B9EFF]/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-[22rem] w-[22rem] rounded-full bg-[#E8614D]/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#080E1A]/75 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="transition hover:opacity-80"
                  title="Back to Umoya overview"
                >
                  <img src={logoSrc} alt="Umoya logo" className="h-8 w-auto sm:h-10" />
                </button>
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Umoya</div>
                  <h1 style={{ fontFamily: '"Fraunces", serif' }} className="text-2xl leading-none text-white">
                    Existing Clinic Access
                  </h1>
                  <p className="mt-1 text-sm text-[#8EA7CD]">
                    Search your clinic, then continue to the live Umoya workspace.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row md:items-center md:justify-end">
                <button
                  onClick={() => navigate('/#request-access')}
                  className="inline-flex items-center justify-center rounded-full border border-[#253A58] bg-[#0E1829]/90 px-5 py-3 text-sm font-medium text-white transition hover:border-[#0AA98A]/50 hover:bg-[#13233A]"
                >
                  Request test access
                </button>
                {isSuperAdmin && (
                  <CDSSIngestPanel
                    status={ingestStatus}
                    progress={ingestProgress}
                    error={ingestError}
                    onSync={handleSync}
                    onUpload={handleUploadGuideline}
                  />
                )}
                <div className="relative w-full md:max-w-md">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-5 w-5 text-[#587296]" />
                  </div>
                  <input
                    type="text"
                    className="block w-full rounded-full border border-[#253A58] bg-[#091320] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#4A6080] focus:border-[#3B9EFF] focus:outline-none focus:ring-2 focus:ring-[#3B9EFF]/20"
                    placeholder="Search by clinic name or subdomain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex-1 max-w-7xl w-full px-4 py-10 sm:px-6 lg:px-8">
          <section className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[30px] border border-[#253A58] bg-[#0E1829]/92 p-7 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Tenant Directory</div>
              <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-3 text-4xl leading-tight text-white">
                Pick your clinic and continue into the right Umoya environment.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#AFC1DF]">
                This page is for existing tenants already using Umoya. If you are evaluating the platform,
                return to the main page and request guided access so we can prepare the correct trial environment.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Secure tenant routing', 'Doctor workspaces', 'Patient portal', 'PostVisit AI', 'FHIR + SNOMED', 'DHIS2-ready'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A8BEDD]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Active clinics', String(filteredTenants.length), '#0AA98A'],
                ['Fast access', '1 click', '#3B9EFF'],
                ['Status', 'Operational', '#FFB020'],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="text-xs uppercase tracking-[0.22em] text-[#7A92B8]">{label}</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                  <div className="mt-4 h-1.5 rounded-full" style={{ backgroundColor: `${color}33` }}>
                    <div className="h-1.5 rounded-full" style={{ width: '68%', backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/5 text-center backdrop-blur-xl">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#0AA98A]"></div>
              <p className="font-medium text-[#B4C7E6]">Loading clinic directory...</p>
            </div>
          ) : error ? (
            <div className="mx-auto flex h-64 max-w-lg flex-col items-center justify-center rounded-[32px] border border-[#FF4D6A]/20 bg-[#FF4D6A]/8 px-6 text-center">
              <div className="mb-4 rounded-full border border-[#FF4D6A]/20 bg-[#FF4D6A]/10 p-4">
                <Building2 className="h-8 w-8 text-[#FF7D92]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Connection error</h3>
              <p className="mt-2 text-sm text-[#E9B4C0]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 rounded-full border border-white/10 bg-white/8 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Try again
              </button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/5 px-6 text-center backdrop-blur-xl">
              <div className="mb-4 rounded-full border border-white/10 bg-[#0E1829] p-4">
                <Search className="h-8 w-8 text-[#6E84A7]" />
              </div>
              <h3 className="text-lg font-medium text-white">No clinics found</h3>
              <p className="mt-2 text-sm text-[#9FB3D3]">
                We could not find any clinics matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between px-1">
                <div className="text-sm font-medium text-[#9FB3D3]">
                  Showing {filteredTenants.length} active {filteredTenants.length === 1 ? 'clinic' : 'clinics'}
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="text-sm font-medium text-[#7DE8CA] transition hover:text-white"
                >
                  Back to overview
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {paginatedTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant.subdomain)}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.98))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-[#0AA98A]/30"
                  >
                    {/* QR button — top-right, stops propagation so card click doesn't fire */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrTenant(tenant); }}
                      title="View / Print QR code"
                      className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#0AA98A]/30 bg-[#0AA98A]/10 text-[#7DE8CA] opacity-0 transition duration-200 hover:bg-[#0AA98A]/25 group-hover:opacity-100"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <div className="absolute right-5 top-5 opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-hover:opacity-0">
                      <ArrowRight className="h-5 w-5 text-[#7DE8CA]" />
                    </div>

                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-[#102139]">
                        {tenant.logoUrl ? (
                          <img src={tenant.logoUrl} alt={tenant.clinicName} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <Building2 className="h-7 w-7 text-[#3B9EFF]" />
                        )}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getTierColor(tenant.subscriptionTier)}`}>
                        {tenant.subscriptionTier || 'Standard'}
                      </span>
                    </div>

                    <div className="mb-5">
                      <h3 className="text-xl font-semibold text-white transition group-hover:text-[#7DE8CA]">
                        {tenant.clinicName}
                      </h3>
                      <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-[#A8BEDD]">
                        {tenant.subdomain}.umoya.health
                      </p>
                    </div>

                    <div className="mt-auto border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#CBEBDD]">
                          <div className="h-2.5 w-2.5 rounded-full bg-[#0AA98A] shadow-[0_0_14px_rgba(0,200,150,0.7)]" />
                          <span className="font-medium">System operational</span>
                        </div>
                        <span className="font-medium text-[#7DE8CA]">Access portal</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-white/10 bg-white/5 p-3 text-[#A8BEDD] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`h-10 w-10 rounded-full text-sm font-medium transition ${
                          currentPage === page
                            ? 'bg-[#0AA98A] text-[#051119] shadow-[0_12px_40px_rgba(0,200,150,0.28)]'
                            : 'border border-white/10 bg-white/5 text-[#B2C6E3] hover:bg-white/10'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-white/10 bg-white/5 p-3 text-[#A8BEDD] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <footer className="border-t border-white/10 bg-[#080E1A]/70 py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-[#7F96BA] sm:px-6 md:flex-row lg:px-8">
            <p>© {new Date().getFullYear()} Umoya Health Systems. Intelligent workflows for modern clinics.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate('/')} className="transition hover:text-white">Overview</button>
              <button onClick={() => navigate('/#request-access')} className="transition hover:text-white">Request Access</button>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="transition hover:text-white">Back to Top</button>
            </div>
          </div>
        </footer>
      </div>

      {qrTenant && (
        <TenantQRModal tenant={qrTenant} onClose={() => setQrTenant(null)} />
      )}
    </div>
  );
};

export default TenantDirectory;
