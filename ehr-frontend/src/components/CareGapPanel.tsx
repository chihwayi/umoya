import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp,
  Brain, CalendarDays, ArrowRight, Plus,
} from 'lucide-react';
import { cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface CareGap {
  id: string;
  gapType: string;
  gapDescription: string;
  recommendedAction?: string;
  priority: string;
  icdCode?: string;
  dueDate?: string;
  status: string;
  detectedAt: string;
  detectedBy: string;
  linkedTask?: { id: string; title: string; status: string } | null;
}

interface NurseTask {
  id: string;
  title: string;
  description?: string;
  taskType: string;
  priority: string;
  status: string;
  dueDate?: string;
  assignedBySystem: boolean;
}

interface CareGapPanelProps {
  patientId: string;
  tenantSlug: string;
  token: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high:   'text-orange-700 bg-orange-50 border-orange-200',
  medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  low:    'text-slate-600 bg-slate-50 border-slate-200',
};

const STATUS_STYLES: Record<string, string> = {
  open:             'text-blue-700 bg-blue-50',
  resolved:         'text-green-700 bg-green-50',
  deferred:         'text-slate-500 bg-slate-50',
  patient_declined: 'text-red-600 bg-red-50',
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low}`}>
    {priority}
  </span>
);

const CareGapPanel: React.FC<CareGapPanelProps> = ({ patientId, tenantSlug, token }) => {
  const [gaps, setGaps] = useState<CareGap[]>([]);
  const [tasks, setTasks] = useState<NurseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    load();
  }, [patientId]);

  const load = async () => {
    setLoading(true);
    try {
      const [gapsRes, tasksRes] = await Promise.all([
        cdssApi.getPatientCareGaps(patientId, token, tenantSlug),
        cdssApi.getNurseTasksForPatient(patientId, token, tenantSlug),
      ]);
      setGaps(gapsRes.data || []);
      setTasks((tasksRes.data || []).filter((t: NurseTask) => t.taskType === 'care_gap'));
    } catch {
      // silently keep empty
    } finally {
      setLoading(false);
    }
  };

  const handleGapStatus = async (gapId: string, status: string) => {
    setUpdatingId(gapId);
    try {
      await cdssApi.updateCareGapStatus(gapId, status, token, tenantSlug);
      showSuccess('Updated', `Care gap marked as ${status.replace('_', ' ')}`);
      await load();
    } catch {
      showError('Error', 'Failed to update care gap status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setUpdatingId(taskId);
    try {
      await cdssApi.updateNurseTask(taskId, { status: 'completed' }, token, tenantSlug);
      showSuccess('Task completed', 'Nurse task marked as complete');
      await load();
    } catch {
      showError('Error', 'Failed to update task');
    } finally {
      setUpdatingId(null);
    }
  };

  const openGaps = gaps.filter((g) => g.status === 'open');
  const closedGaps = gaps.filter((g) => g.status !== 'open');
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            AI Care Gaps
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically detected by CDSS nightly engine · {openGaps.length} open
          </p>
        </div>
        {openGaps.length > 0 && (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            {openGaps.length} gap{openGaps.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading care gaps...</div>
      ) : (
        <>
          {/* Active nurse tasks from care gaps */}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Active Nurse Tasks
              </p>
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <PriorityBadge priority={task.priority} />
                        {task.dueDate && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString('en-GB')}
                          </span>
                        )}
                        {task.assignedBySystem && (
                          <span className="text-xs text-indigo-500">AI-generated</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={updatingId === task.id}
                    onClick={() => handleCompleteTask(task.id)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Done
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Open care gaps */}
          {openGaps.length === 0 && activeTasks.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No open care gaps</p>
              <p className="text-xs text-slate-400 mt-1">AI nightly scan found no outstanding gaps</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Open Care Gaps
              </p>
              {openGaps.map((gap) => (
                <div
                  key={gap.id}
                  className={`border rounded-xl overflow-hidden ${PRIORITY_STYLES[gap.priority] ?? PRIORITY_STYLES.low}`}
                >
                  <button
                    onClick={() => setExpandedGap(expandedGap === gap.id ? null : gap.id)}
                    className="w-full flex items-start justify-between gap-3 p-3 text-left hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize">
                          {gap.gapType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{gap.gapDescription}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <PriorityBadge priority={gap.priority} />
                          {gap.icdCode && (
                            <span className="text-xs font-mono opacity-70">{gap.icdCode}</span>
                          )}
                          {gap.dueDate && (
                            <span className="text-xs opacity-70 flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Due {new Date(gap.dueDate).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedGap === gap.id
                      ? <ChevronUp className="w-4 h-4 shrink-0 mt-1 opacity-60" />
                      : <ChevronDown className="w-4 h-4 shrink-0 mt-1 opacity-60" />}
                  </button>

                  {expandedGap === gap.id && (
                    <div className="px-3 pb-3 pt-1 bg-white/60 border-t border-current/10 space-y-3">
                      {gap.recommendedAction && (
                        <div className="flex items-start gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 opacity-60 shrink-0" />
                          <p className="text-xs">{gap.recommendedAction}</p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          disabled={updatingId === gap.id}
                          onClick={() => handleGapStatus(gap.id, 'resolved')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark Resolved
                        </button>
                        <button
                          disabled={updatingId === gap.id}
                          onClick={() => handleGapStatus(gap.id, 'deferred')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300 disabled:opacity-50 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Defer
                        </button>
                        <button
                          disabled={updatingId === gap.id}
                          onClick={() => handleGapStatus(gap.id, 'patient_declined')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Patient Declined
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Closed gaps (collapsed) */}
          {closedGaps.length > 0 && (
            <details className="group">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                {closedGaps.length} closed gap{closedGaps.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-1">
                {closedGaps.map((gap) => (
                  <div key={gap.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-500 capitalize">{gap.gapType.replace(/_/g, ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[gap.status] ?? 'text-slate-500 bg-slate-100'}`}>
                      {gap.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
};

export default CareGapPanel;
