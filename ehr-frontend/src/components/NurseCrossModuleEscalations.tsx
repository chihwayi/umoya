import React from 'react';
import {
  AlertTriangle,
  Baby,
  HeartPulse,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export interface NurseCrossModuleFeedItem {
  id: string;
  module: 'maternity' | 'hiv' | 'nursing';
  item_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  workflow_status: string;
  module_status?: string | null;
  doctor_sync_status?: string | null;
  title: string;
  summary: string;
  recommended_action?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_number?: string | null;
  enrollment_id?: string | null;
  enrollment_number?: string | null;
  source_record_id?: string | null;
  source_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  age_hours?: number | null;
  sla_status?: string | null;
  destination_role?: string | null;
  destination_service?: string | null;
  destination_specialty?: string | null;
  destination_user_id?: string | null;
  destination_user_name?: string | null;
  destination_facility_id?: string | null;
  destination_facility_name?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by_name?: string | null;
  completed_at?: string | null;
  completed_by_name?: string | null;
  note?: string | null;
  metadata?: Record<string, any> | null;
  next_route?: {
    section?: 'main' | 'hiv' | 'maternity';
    tab?: string;
    taskId?: string;
    enrollmentId?: string;
    patientId?: string;
  } | null;
}

interface NurseCrossModuleEscalationsProps {
  items: NurseCrossModuleFeedItem[];
  summary?: {
    total?: number;
    critical?: number;
    high?: number;
    maternity?: number;
    hiv?: number;
    nursing?: number;
    handoff?: number;
    medication?: number;
  } | null;
  loading?: boolean;
  compact?: boolean;
  acknowledgingTaskId?: string | null;
  workflowActionItemId?: string | null;
  onRefresh?: () => void;
  onOpenWorkflow?: (item: NurseCrossModuleFeedItem) => void;
  onAcknowledgeMaternityTask?: (item: NurseCrossModuleFeedItem) => void;
  onUpdateWorkflowStatus?: (
    item: NurseCrossModuleFeedItem,
    status: 'acknowledged' | 'completed',
  ) => void;
  onExecuteHivRecommendationAction?: (
    item: NurseCrossModuleFeedItem,
    recommendationItem: Record<string, any>,
  ) => void;
  recommendationActionKey?: string | null;
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

const moduleStyles: Record<string, string> = {
  maternity: 'bg-pink-100 text-pink-700',
  hiv: 'bg-emerald-100 text-emerald-700',
  nursing: 'bg-sky-100 text-sky-700',
};

const slaStyles: Record<string, string> = {
  breached: 'text-red-700 bg-red-50 border-red-200',
  due_soon: 'text-orange-700 bg-orange-50 border-orange-200',
  within_sla: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

function formatAgeHours(ageHours?: number | null) {
  if (ageHours == null || Number.isNaN(ageHours)) return null;
  if (ageHours >= 24) {
    return `${Math.round((ageHours / 24) * 10) / 10}d`;
  }
  return `${ageHours}h`;
}

function getRecommendationBundle(item: NurseCrossModuleFeedItem) {
  const bundle = item.metadata?.recommendation_bundle;
  if (!bundle || typeof bundle !== 'object') {
    return null;
  }
  return bundle;
}

function isExecutableHivRecommendationAction(item: Record<string, any>) {
  const actionId = String(item?.id || '');
  const actionType = String(item?.type || '');
  return actionId === 'eac-followup' || actionId === 'repeat-vl-plan' || actionType === 'pmtct_followup';
}

export default function NurseCrossModuleEscalations({
  items,
  summary,
  loading = false,
  compact = false,
  acknowledgingTaskId,
  workflowActionItemId,
  onRefresh,
  onOpenWorkflow,
  onAcknowledgeMaternityTask,
  onUpdateWorkflowStatus,
  onExecuteHivRecommendationAction,
  recommendationActionKey,
}: NurseCrossModuleEscalationsProps) {
  const visibleItems = compact ? items.slice(0, 3) : items;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">Cross-Module Escalations</h3>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Shared nurse visibility into maternity escalation tasks, HIV specialist follow-up, handoff risk, and medication exceptions.
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-white">
            {summary?.total ?? items.length} total
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            {summary?.critical ?? items.filter((item) => item.severity === 'critical').length} critical
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
            {summary?.high ?? items.filter((item) => item.severity === 'high').length} high
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">
            {summary?.maternity ?? items.filter((item) => item.module === 'maternity').length} maternity
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            {summary?.hiv ?? items.filter((item) => item.module === 'hiv').length} HIV
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
            {summary?.nursing ?? items.filter((item) => item.module === 'nursing').length} nursing
          </span>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            <p className="text-sm">Loading cross-module escalation feed…</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">No active cross-module escalations</p>
            <p className="text-sm mt-1">Maternity, HIV, handoff, and medication follow-up items will appear here when action is needed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => {
              const isMaternity = item.module === 'maternity';
              const recommendationBundle = getRecommendationBundle(item);
              const bundleItems = Array.isArray(recommendationBundle?.items)
                ? recommendationBundle.items.slice(0, compact ? 2 : 3)
                : [];
              const bundleCitations = Array.isArray(recommendationBundle?.citations)
                ? recommendationBundle.citations.slice(0, compact ? 2 : 3)
                : [];
              const canAcknowledgeMaternity =
                isMaternity &&
                item.workflow_status === 'open' &&
                typeof onAcknowledgeMaternityTask === 'function';
              const canUpdateWorkflow =
                !isMaternity &&
                typeof onUpdateWorkflowStatus === 'function' &&
                item.workflow_status !== 'completed';
              const isWorkflowBusy = workflowActionItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${moduleStyles[item.module] || moduleStyles.hiv}`}>
                          {isMaternity ? <Baby className="w-3.5 h-3.5" /> : <HeartPulse className="w-3.5 h-3.5" />}
                          {item.module.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${severityStyles[item.severity] || severityStyles.low}`}>
                          {item.severity.toUpperCase()}
                        </span>
                        {item.sla_status && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${slaStyles[item.sla_status] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                            SLA {String(item.sla_status).replace(/_/g, ' ')}
                          </span>
                        )}
                        {item.doctor_sync_status && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {String(item.doctor_sync_status).replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{item.summary}</p>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                        {item.patient_name && <span>Patient: {item.patient_name}</span>}
                        {item.patient_number && <span>File: {item.patient_number}</span>}
                        {item.enrollment_number && <span>Enrollment: {item.enrollment_number}</span>}
                        {formatAgeHours(item.age_hours) && <span>Age: {formatAgeHours(item.age_hours)}</span>}
                        <span>Workflow: {String(item.workflow_status || 'open').replace(/_/g, ' ')}</span>
                        {item.module_status && (
                          <span>Signal: {String(item.module_status).replace(/_/g, ' ')}</span>
                        )}
                        {item.destination_user_name && <span>Clinician: {item.destination_user_name}</span>}
                        {item.destination_role && <span>Role: {String(item.destination_role).replace(/_/g, ' ')}</span>}
                        {item.destination_facility_name && <span>Facility: {item.destination_facility_name}</span>}
                      </div>

                      {item.recommended_action && (
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Recommended Next Step</p>
                          <p className="text-sm text-indigo-900 mt-1">{item.recommended_action}</p>
                        </div>
                      )}

                      {recommendationBundle && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              HIV CDSS Bundle
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              {recommendationBundle.actionable_count ?? bundleItems.length} actions
                            </span>
                          </div>
                          {recommendationBundle.summary && (
                            <p className="text-sm text-emerald-900 mt-1">{recommendationBundle.summary}</p>
                          )}
                          {bundleItems.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {bundleItems.map((bundleItem: any) => {
                                  const executionStatus = String(bundleItem?.execution_status || '');
                                  const canExecute =
                                    item.module === 'hiv' &&
                                    isExecutableHivRecommendationAction(bundleItem) &&
                                    executionStatus !== 'completed' &&
                                    typeof onExecuteHivRecommendationAction === 'function';
                                  const actionKey = `${item.id}:${String(bundleItem?.id || bundleItem?.title || 'action')}`;
                                  const isExecuting = recommendationActionKey === actionKey;

                                  return (
                                <div
                                  key={String(bundleItem.id || bundleItem.title)}
                                  className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-slate-900">
                                        {bundleItem.title || 'Recommended nurse action'}
                                      </span>
                                      {bundleItem.urgency && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                                          {String(bundleItem.urgency).replace(/_/g, ' ')}
                                        </span>
                                      )}
                                      {executionStatus === 'completed' && (
                                        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[11px] font-semibold text-sky-700">
                                          Applied
                                        </span>
                                      )}
                                    </div>
                                    {canExecute && (
                                      <button
                                        type="button"
                                        onClick={() => onExecuteHivRecommendationAction?.(item, bundleItem)}
                                        disabled={isExecuting}
                                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                      >
                                        {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                                        Apply
                                      </button>
                                    )}
                                  </div>
                                  {bundleItem.rationale && (
                                    <p className="text-xs text-slate-600 mt-1">{bundleItem.rationale}</p>
                                  )}
                                  {bundleItem.execution_result?.operation && (
                                    <p className="mt-1 text-[11px] text-sky-700">
                                      Applied via {String(bundleItem.execution_result.operation).replace(/_/g, ' ')}.
                                    </p>
                                  )}
                                </div>
                                  );
                                })}
                            </div>
                          )}
                          {bundleCitations.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Guideline Support
                              </p>
                              <div className="mt-2 flex flex-col gap-2">
                                {bundleCitations.map((citation: any, index: number) => (
                                  <div
                                    key={String(citation.rule_id || index)}
                                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2"
                                  >
                                    <p className="text-[11px] font-semibold text-slate-500">
                                      {citation.source || 'Guideline'}
                                    </p>
                                    <p className="text-xs text-slate-700 mt-0.5">{citation.citation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(item.note || item.acknowledged_by_name || item.completed_by_name) && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                          {item.acknowledged_by_name && (
                            <p>Acknowledged by {item.acknowledged_by_name}</p>
                          )}
                          {item.completed_by_name && (
                            <p>Completed by {item.completed_by_name}</p>
                          )}
                          {item.note && <p>Note: {item.note}</p>}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[190px]">
                      {canAcknowledgeMaternity && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeMaternityTask?.(item)}
                          disabled={acknowledgingTaskId === item.id}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {acknowledgingTaskId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          Acknowledge
                        </button>
                      )}
                      {canUpdateWorkflow && item.workflow_status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => onUpdateWorkflowStatus?.(item, 'acknowledged')}
                          disabled={isWorkflowBusy}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
                        >
                          {isWorkflowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                          Acknowledge
                        </button>
                      )}
                      {canUpdateWorkflow && (
                        <button
                          type="button"
                          onClick={() => onUpdateWorkflowStatus?.(item, 'completed')}
                          disabled={isWorkflowBusy}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {isWorkflowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenWorkflow?.(item)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                      >
                        <Link2 className="w-4 h-4" />
                        Open Workflow
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
