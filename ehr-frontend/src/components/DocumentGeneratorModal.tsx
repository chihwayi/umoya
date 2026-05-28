import React, { useState } from 'react';
import { api } from '../services/api';

type DocType = 'referral_letter' | 'discharge_summary' | 'pre_auth' | 'sick_note' | 'other';

interface Props {
  patientId: string;
  onClose: () => void;
  onGenerated?: (doc: any) => void;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  referral_letter: 'Referral Letter',
  discharge_summary: 'Discharge Summary',
  pre_auth: 'Pre-Authorisation Request',
  sick_note: 'Medical Certificate',
  other: 'Clinical Document',
};

export const DocumentGeneratorModal: React.FC<Props> = ({ patientId, onClose, onGenerated }) => {
  const [documentType, setDocumentType] = useState<DocType>('referral_letter');
  const [recipient, setRecipient] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<any>(null);
  const [signing, setSigning] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const doc = await api.post('/documents/generate', {
        patientId,
        documentType,
        recipient: recipient || undefined,
        additionalContext: additionalContext || undefined,
      });
      setGenerated(doc);
      onGenerated?.(doc);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const handleSign = async () => {
    if (!generated) return;
    setSigning(true);
    setError(null);
    try {
      const signed = await api.post(`/documents/${generated.id}/sign`, {});
      setGenerated(signed);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Generate Clinical Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {!generated ? (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value as DocType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(t => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {documentType === 'referral_letter' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient (optional)</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="e.g. Dr. Smith, Cardiologist"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {documentType === 'discharge_summary' ? 'Reason for Admission' : 'Additional Context (optional)'}
              </label>
              <textarea
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="self-end px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{generated.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{generated.status}</p>
              </div>
              {generated.status === 'draft' && (
                <button
                  onClick={handleSign}
                  disabled={signing}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {signing ? 'Signing…' : 'Sign Document'}
                </button>
              )}
              {generated.status === 'signed' && (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">Signed</span>
              )}
            </div>

            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap text-gray-800 max-h-80 overflow-y-auto">
              {generated.content}
            </pre>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setGenerated(null)}
                className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Generate Another
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
