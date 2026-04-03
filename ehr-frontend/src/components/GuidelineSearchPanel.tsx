/**
 * GuidelineSearchPanel — shared AI guideline search with background-task support.
 *
 * When the user hits Search, the task is registered in BackgroundTaskContext so it
 * survives modal close, and the panel collapses to a slim "running" banner.
 * On completion a non-intrusive toast fires and results are accessible via the
 * BackgroundTaskDock in the bottom-right corner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { useNotification } from './GlobalNotification';

interface GuidelineSearchPanelProps {
  /** Async function that executes the actual search — caller curries token/tenant/context */
  searchFn: (query: string) => Promise<{ data?: { citations?: any[] }; citations?: any[] }>;
  /** Short label prefix shown in the dock, e.g. "Cardiac notes" */
  contextLabel?: string;
  className?: string;
}

interface Citation {
  source?: string;
  title?: string;
  content?: string;
  text?: string;
  recommendation?: string;
  confidence?: number;
}

export function GuidelineSearchPanel({ searchFn, contextLabel, className = '' }: GuidelineSearchPanelProps) {
  const { registerTask, completeTask, failTask } = useBackgroundTasks();
  const { showInfo, showError } = useNotification();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Citation[]>([]);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRunning = runningTaskId !== null;

  // focus input when panel mounts / becomes uncollapsed
  useEffect(() => {
    if (!collapsed) inputRef.current?.focus();
  }, [collapsed]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || isRunning) return;

    const label = contextLabel ? `Guidelines: ${contextLabel} — ${q}` : `Guidelines: ${q}`;
    const taskId = registerTask(label, 'guidelines');
    setRunningTaskId(taskId);
    setResults([]);
    setCollapsed(true); // auto-minimize — user can continue working

    try {
      const response = await searchFn(q);
      const citations: Citation[] = response?.data?.citations ?? response?.citations ?? [];
      completeTask(taskId, { data: { citations } });
      setResults(citations);
      setCollapsed(false); // re-expand to show results

      showInfo(
        'Guidelines Ready',
        citations.length > 0
          ? `${citations.length} guideline${citations.length !== 1 ? 's' : ''} found for "${q.length > 40 ? q.slice(0, 40) + '…' : q}" — see dock or scroll down`
          : `Search complete — no guidelines matched "${q.length > 30 ? q.slice(0, 30) + '…' : q}"`,
      );
    } catch (err: any) {
      failTask(taskId, err?.message || 'Search failed');
      showError('Guideline Search Failed', err?.message || 'An error occurred while searching guidelines.');
    } finally {
      setRunningTaskId(null);
    }
  }, [query, isRunning, contextLabel, registerTask, completeTask, failTask, searchFn, showInfo, showError]);

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 ${className}`}>
      {/* Running banner (collapsed state) */}
      {isRunning && collapsed && (
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-sm text-indigo-700">
            <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="font-medium">AI searching guidelines…</span>
            <span className="text-xs text-indigo-500">You can continue working — results appear below when ready</span>
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            show
          </button>
        </div>
      )}

      {/* Full panel */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Query row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Sepsis protocol, ART regimen for children…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                disabled={isRunning}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isRunning || !query.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition shrink-0"
            >
              {isRunning ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Searching…
                </>
              ) : 'Search'}
            </button>
          </div>

          {/* Running inline hint */}
          {isRunning && (
            <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
              <p className="text-xs text-indigo-700 font-medium">
                AI is searching — this can take 1–2 minutes. You can close this modal and keep working.
              </p>
              <button
                onClick={() => setCollapsed(true)}
                className="ml-3 shrink-0 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 bg-white rounded border border-indigo-200 hover:border-indigo-400 transition"
              >
                Minimize
              </button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {results.map((c, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm text-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="font-semibold text-slate-700 text-xs truncate">{c.source || c.title || 'Clinical Guideline'}</span>
                        {c.confidence != null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
                            c.confidence > 0.8 ? 'bg-green-50 text-green-700 border-green-100' :
                            c.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                            'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {Math.round(c.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{c.content || c.text || ''}</p>
                      {c.recommendation && (
                        <p className="mt-1 text-xs font-medium text-indigo-700">→ {c.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !isRunning && query && (
            <p className="text-xs text-slate-400 text-center py-2">No results yet — press Search to begin.</p>
          )}
        </div>
      )}
    </div>
  );
}
