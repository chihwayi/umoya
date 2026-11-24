import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Loader } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CnParticipation, cnErrorMessage } from '../utils/clinicianNetwork';
import { exportParticipationToPDF } from '../utils/pdfExport';

// S288 — Participation record: the caller's own topics + replies only, with a
// PDF export carrying the exact non-accredited-activity disclaimer copy.
const ClinicianNetworkParticipation: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError } = useNotification();
  const [record, setRecord] = useState<CnParticipation | null>(null);
  const [handle, setHandle] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [me, participation] = await Promise.all([
        clinicianNetworkApi.getMe(token, tenantSlug).catch(() => ({ data: null })),
        clinicianNetworkApi.getParticipation(token, tenantSlug),
      ]);
      setRecord(participation.data);
      setHandle(me.data?.displayHandle ?? '');
    } catch (error: any) {
      showError('Could not load participation record', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!record) return;
    exportParticipationToPDF({
      displayHandle: handle || 'Clinician',
      topics: record.topics.map((t) => ({
        title: t.title,
        createdAt: t.created_at,
        status: t.status,
        replyCount: t.replyCount,
      })),
      replies: record.replies.map((r) => ({
        topicTitle: r.topicTitle,
        excerpt: r.body_redacted.slice(0, 160),
        createdAt: r.created_at,
      })),
    });
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
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My participation record</h1>
            <p className="text-sm text-slate-600 mt-1">
              Every discussion you started or replied to, under your handle
              {handle && (
                <>
                  {' '}<span className="font-semibold text-slate-800">{handle}</span>
                </>
              )}
              .
            </p>
          </div>
          <button
            onClick={exportPDF}
            disabled={!record || (record.topics.length === 0 && record.replies.length === 0)}
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-4 py-2 disabled:opacity-50 shrink-0"
          >
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>

        <p className="text-sm font-semibold text-slate-800 mt-4">
          Record of participation only — this is not an accredited CPD activity.
        </p>

        <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3">
          Topics started ({record?.topics.length ?? 0})
        </h2>
        {!record || record.topics.length === 0 ? (
          <p className="text-sm text-slate-500">You have not started any discussions yet.</p>
        ) : (
          <div className="space-y-3">
            {record.topics.map((topic) => (
              <div key={topic.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <Link
                  to={`/ehr/${tenantSlug}/clinician-network/topics/${topic.id}`}
                  className="font-semibold text-slate-900 hover:text-teal-800"
                >
                  {topic.title}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(topic.created_at).toLocaleString()} · {topic.status} ·{' '}
                  {topic.replyCount} {topic.replyCount === 1 ? 'reply' : 'replies'}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
          Replies posted ({record?.replies.length ?? 0})
        </h2>
        {!record || record.replies.length === 0 ? (
          <p className="text-sm text-slate-500">You have not posted any replies yet.</p>
        ) : (
          <div className="space-y-3">
            {record.replies.map((reply) => (
              <div key={reply.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <p className="text-xs text-slate-500">
                  In{' '}
                  <Link
                    to={`/ehr/${tenantSlug}/clinician-network/topics/${reply.topic_id}`}
                    className="font-medium text-teal-700 hover:text-teal-800"
                  >
                    {reply.topicTitle}
                  </Link>{' '}
                  · {new Date(reply.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{reply.body_redacted}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicianNetworkParticipation;
