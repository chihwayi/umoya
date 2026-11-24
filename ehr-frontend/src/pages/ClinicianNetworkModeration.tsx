import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader, ShieldAlert } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CnReport, cnErrorMessage } from '../utils/clinicianNetwork';

// S288 — Moderator-only report queue. Visibility here is convenience only: every
// action is re-checked server-side against clinicians.is_moderator, so a
// non-moderator hitting these endpoints directly gets a 403.
const ClinicianNetworkModeration: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const [reports, setReports] = useState<CnReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [resolvedAuthors, setResolvedAuthors] = useState<
    Record<string, { name: string; email: string | null } | { unresolvable: true }>
  >({});

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    setForbidden(false);
    try {
      const res = await clinicianNetworkApi.listReports(token, tenantSlug);
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setForbidden(true);
      } else {
        showError('Could not load reports', cnErrorMessage(error, 'Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const actOnReport = async (reportId: string, action: 'dismissed' | 'actioned') => {
    if (!tenantSlug || !token) return;
    setActingId(reportId);
    try {
      await clinicianNetworkApi.resolveReport(reportId, { action }, token, tenantSlug);
      showSuccess(
        action === 'dismissed' ? 'Report dismissed' : 'Report actioned',
        'The report has been removed from the open queue.',
      );
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error: any) {
      showError('Could not update report', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setActingId(null);
    }
  };

  const revealAuthor = async (report: CnReport) => {
    if (!tenantSlug || !token || !report.topicId) return;
    try {
      const res = await clinicianNetworkApi.resolveAuthor(report.topicId, token, tenantSlug);
      setResolvedAuthors((prev) => ({
        ...prev,
        [report.id]: { name: res.data.name, email: res.data.email ?? null },
      }));
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setResolvedAuthors((prev) => ({ ...prev, [report.id]: { unresolvable: true } }));
      } else {
        showError('Could not resolve author', cnErrorMessage(error, 'Please try again.'));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to={`/ehr/${tenantSlug}/clinician-network`}
          className="text-sm text-teal-700 hover:text-teal-800"
        >
          ← Back to Clinician Network
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-slate-600" /> Moderation queue
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Open reports filed by network members. Dismiss noise, action genuine violations.
          Author identity is only revealed per-topic, and only when the author's clinic
          link lives in this tenant.
        </p>

        {forbidden ? (
          <div className="mt-6 border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Moderator access required. This page is visible, but the server refused the
              request because your network identity is not flagged as a moderator.
            </p>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-500 mt-6 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-700" /> No open reports. The queue is clear.
          </p>
        ) : (
          <div className="space-y-3 mt-6">
            {reports.map((report) => (
              <div key={report.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {report.topicTitle ?? 'Reported reply'}
                    </p>
                    {report.replyExcerpt && (
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                        “{report.replyExcerpt}”
                      </p>
                    )}
                    <p className="text-sm text-slate-700 mt-2">
                      <span className="font-medium">Reason:</span> {report.reason}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Reported by {report.reporterHandle} ·{' '}
                      {new Date(report.createdAt).toLocaleString()} ·{' '}
                      {report.replyId ? `Reply ${report.replyId.slice(0, 8)}` : 'Topic-level report'}
                    </p>
                    {resolvedAuthors[report.id] && (
                      <p className="text-xs mt-2 font-medium text-slate-700">
                        {'unresolvable' in resolvedAuthors[report.id] ? (
                          <span className="text-amber-700">
                            Author is not resolvable from this tenant — the originating
                            clinic must be identified separately.
                          </span>
                        ) : (
                          <span>
                            Author: {(resolvedAuthors[report.id] as { name: string }).name}
                            {(resolvedAuthors[report.id] as { email: string | null }).email &&
                              ` · ${(resolvedAuthors[report.id] as { email: string | null }).email}`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => actOnReport(report.id, 'dismissed')}
                    disabled={actingId === report.id}
                    className="text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded px-3 py-1.5 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => actOnReport(report.id, 'actioned')}
                    disabled={actingId === report.id}
                    className="text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-3 py-1.5 disabled:opacity-50"
                  >
                    Mark actioned
                  </button>
                  {report.topicId && !resolvedAuthors[report.id] && (
                    <button
                      onClick={() => revealAuthor(report)}
                      className="text-sm font-medium text-amber-800 border border-amber-300 hover:bg-amber-50 rounded px-3 py-1.5"
                    >
                      Resolve author
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicianNetworkModeration;
