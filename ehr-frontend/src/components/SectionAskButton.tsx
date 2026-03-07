import React, { useState } from 'react';
import { ehrApi } from '../services/api';

interface Props {
  sessionId: string;
  sectionType: string;
  sectionLabel: string;
  token: string;
  tenantSlug: string;
  onAnswer?: (answer: string) => void;
}

export const SectionAskButton: React.FC<Props> = ({
  sessionId,
  sectionType,
  sectionLabel,
  token,
  tenantSlug,
  onAnswer,
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const data = await ehrApi.askPostVisitSection(sessionId, { question: question.trim(), sectionType }, token, tenantSlug);
      const ans = data?.answer ?? 'No answer available.';
      setAnswer(ans);
      onAnswer?.(ans);
    } catch {
      setAnswer('Failed to get answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition hover:text-emerald-800"
        title={`Ask AI about ${sectionLabel}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Ask
      </button>

      {open && (
        <div className="mt-2 max-w-md rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs text-gray-500">
            Ask about: <strong>{sectionLabel}</strong>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder='e.g. "What does this mean?"'
              className="flex-1 rounded border px-2 py-1 text-sm"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
          {answer && (
            <div className="mt-2 rounded border bg-white p-2 text-sm text-gray-700">{answer}</div>
          )}
        </div>
      )}
    </div>
  );
};
