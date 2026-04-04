import React, { useState } from 'react';
import { BackgroundTask, useBackgroundTasks } from '../contexts/BackgroundTaskContext';

function elapsed(task: BackgroundTask): string {
  const ms = (task.finishedAt ?? Date.now()) - task.startedAt;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function TaskIcon({ icon }: { icon: BackgroundTask['icon'] }) {
  if (icon === 'guidelines') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

interface ResultViewerProps {
  task: BackgroundTask;
  onClose: () => void;
}

function GuidelineResultViewer({ task, onClose }: ResultViewerProps) {
  const citations: any[] = task.result?.data?.citations ?? task.result?.citations ?? [];

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-end pointer-events-none">
      <div
        className="pointer-events-auto mb-20 mr-4 w-[420px] max-h-[70vh] flex flex-col rounded-2xl border border-indigo-200 bg-white shadow-2xl animate-in slide-in-from-bottom-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-indigo-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <TaskIcon icon={task.icon} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">{task.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Completed in {elapsed(task)} · {citations.length} guideline{citations.length !== 1 ? 's' : ''} found</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {citations.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No guidelines found for this query.</div>
          ) : (
            citations.map((c: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate">{c.source || c.title || 'Clinical Guideline'}</span>
                      {c.confidence != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          c.confidence > 0.8 ? 'bg-green-50 text-green-700' :
                          c.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {Math.round(c.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{c.content || c.text || c.recommendation || ''}</p>
                    {c.recommendation && c.content && (
                      <p className="mt-1.5 text-[11px] font-medium text-indigo-700">→ {c.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function BackgroundTaskDock() {
  const { tasks, dismissTask } = useBackgroundTasks();
  const [expanded, setExpanded] = useState(false);
  const [viewingTask, setViewingTask] = useState<BackgroundTask | null>(null);

  const running = tasks.filter(t => t.status === 'running');
  const done = tasks.filter(t => t.status === 'done');
  const errored = tasks.filter(t => t.status === 'error');
  const hasAny = tasks.length > 0;

  if (!hasAny) return null;

  return (
    <>
      {/* Result viewer overlay */}
      {viewingTask && (
        <GuidelineResultViewer
          task={viewingTask}
          onClose={() => setViewingTask(null)}
        />
      )}

      {/* Dock */}
      <div className="fixed bottom-4 right-4 z-[9997] flex flex-col items-end gap-2">

        {/* Expanded task list */}
        {expanded && (
          <div className="w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 bg-slate-50">
              <span className="text-xs font-bold text-slate-700">Background Tasks</span>
              <button onClick={() => setExpanded(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {tasks.map(task => (
                <div key={task.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition">
                  {/* Status icon */}
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    task.status === 'running' ? 'bg-indigo-100 text-indigo-600' :
                    task.status === 'done'    ? 'bg-emerald-100 text-emerald-600' :
                                               'bg-red-100 text-red-600'
                  }`}>
                    {task.status === 'running' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : task.status === 'done' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{task.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {task.status === 'running' ? `Running · ${elapsed(task)} elapsed` :
                       task.status === 'done'    ? `Done in ${elapsed(task)}` :
                       `Failed · ${task.error?.slice(0, 40)}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 ml-1">
                    {task.status === 'done' && (
                      <button
                        onClick={() => { setViewingTask(task); setExpanded(false); }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => dismissTask(task.id)}
                      className="p-1 text-slate-300 hover:text-slate-500 rounded"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact pill trigger */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 shadow-lg transition hover:shadow-xl active:scale-95"
          style={{
            borderColor: running.length > 0 ? '#6366f1' : done.length > 0 ? '#10b981' : '#ef4444',
          }}
        >
          {running.length > 0 && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
              </span>
              <span className="text-xs font-bold text-indigo-700">
                {running.length} AI task{running.length !== 1 ? 's' : ''} running
              </span>
            </>
          )}
          {running.length === 0 && done.length > 0 && (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-bold text-emerald-700">
                {done.length} result{done.length !== 1 ? 's' : ''} ready
              </span>
            </>
          )}
          {running.length === 0 && done.length === 0 && errored.length > 0 && (
            <>
              <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold text-red-600">{errored.length} failed</span>
            </>
          )}
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}
