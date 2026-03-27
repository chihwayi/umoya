import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';

const DOCUMENT_TYPES = ['guideline', 'protocol', 'formulary', 'policy', 'research'];
const SPECIALTIES = ['general', 'cardiology', 'pharmacy', 'radiology', 'paediatrics', 'oncology', 'hiv', 'tb', 'mental_health'];

const EHR_API_URL = (window as any).__RUNTIME_CONFIG__?.ehrApi || process.env.REACT_APP_EHR_API_URL || '';

function getToken(): string {
  return localStorage.getItem('token') || '';
}

function getTenantId(): string {
  return localStorage.getItem('tenantId') || '';
}

async function uploadKnowledgeDocument(formData: FormData): Promise<any> {
  const res = await fetch(`${EHR_API_URL}/knowledge/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'X-Tenant-ID': getTenantId(),
    },
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function listKnowledgeDocuments(): Promise<any[]> {
  const res = await fetch(`${EHR_API_URL}/knowledge/documents`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'X-Tenant-ID': getTenantId(),
    },
  });
  if (!res.ok) return [];
  return res.json();
}

async function deleteKnowledgeDocument(id: string): Promise<void> {
  await fetch(`${EHR_API_URL}/knowledge/documents/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'X-Tenant-ID': getTenantId(),
    },
  });
}

export const KnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    listKnowledgeDocuments().then(setDocuments).catch(console.error);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !form.title) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    Object.entries(form).forEach(([k, v]) => v && formData.append(k, v));
    try {
      await uploadKnowledgeDocument(formData);
      setSelectedFile(null);
      setForm({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
      const updated = await listKnowledgeDocuments();
      setDocuments(updated);
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'processing') return <Clock size={14} className="text-amber-500 animate-spin" />;
    if (status === 'failed') return <AlertCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-slate-400" />;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Clinical Knowledge Base</h1>
      <p className="text-sm text-slate-500 mb-6">
        Documents uploaded here are used by the AI to ground all clinical guideline recommendations.
        PDF, DOCX, and TXT files supported.
      </p>

      <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Upload New Document</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-600">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. WHO Hypertension Guidelines 2023" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Type *</label>
            <select value={form.documentType} onChange={e => setForm(f => ({...f, documentType: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Specialty</label>
            <select value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
              <option value="">All specialties</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Source Organization</label>
            <input value={form.sourceOrganization} onChange={e => setForm(f => ({...f, sourceOrganization: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. WHO, MoHCC, NICE" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer hover:bg-white bg-white border-slate-300">
            <Upload size={14} />
            {selectedFile ? selectedFile.name : 'Choose file (PDF/DOCX/TXT)'}
            <input type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
          </label>
          <button onClick={handleUpload} disabled={!selectedFile || !form.title || uploading}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3 bg-white">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-400">
                  {doc.documentType} · {doc.specialty || 'all'} · {doc.sourceOrganization || 'unknown source'} · {doc.chunkCount} chunks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                {statusIcon(doc.ingestionStatus)}
                <span>{doc.ingestionStatus}</span>
              </div>
              <button onClick={() => {
                deleteKnowledgeDocument(doc.id).then(() =>
                  setDocuments(prev => prev.filter(d => d.id !== doc.id))
                );
              }} className="text-slate-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No documents yet. Upload your first clinical guideline.</p>
        )}
      </div>
    </div>
  );
};
