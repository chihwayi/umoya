import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader, Reply } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CnReply, CnTopic, PhiFieldError, cnErrorMessage, extractPhiError } from '../utils/clinicianNetwork';

// S287 — Topic thread: body, recursively nested replies, reply composer with
// the same PHI flow as topic creation, author-only Mark Resolved.
const ClinicianNetworkTopicThread: React.FC = () => {
  const { tenantSlug, topicId } = useParams<{ tenantSlug: string; topicId: string }>();
  const { showError, showSuccess } = useNotification();
  const [topic, setTopic] = useState<CnTopic | null>(null);
  const [replies, setReplies] = useState<CnReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [phiError, setPhiError] = useState<PhiFieldError | null>(null);

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    if (!tenantSlug || !token || !topicId) return;
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        clinicianNetworkApi.getTopic(topicId, token, tenantSlug),
        clinicianNetworkApi.listReplies(topicId, token, tenantSlug),
      ]);
      setTopic(t.data);
      setReplies(Array.isArray(r.data) ? r.data : []);
    } catch (error: any) {
      showError('Could not load discussion', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitReply = async () => {
    if (!tenantSlug || !token || !topicId || !replyBody.trim()) return;
    setSending(true);
    setPhiError(null);
    try {
      await clinicianNetworkApi.createReply(
        topicId,
        { body: replyBody.trim(), parentReplyId: replyingTo },
        token,
        tenantSlug,
      );
      setReplyBody('');
      setReplyingTo(null);
      showSuccess('Reply posted', 'Your reply is now visible in this thread.');
      await load();
    } catch (error: any) {
      const phi = extractPhiError(error);
      if (phi.field) {
        setPhiError(phi);
      } else {
        showError('Could not post reply', cnErrorMessage(error, 'Please try again.'));
      }
    } finally {
      setSending(false);
    }
  };

  const markResolved = async (resolvedReplyId: string | null) => {
    if (!tenantSlug || !token || !topicId) return;
    setResolving(true);
    try {
      const res = await clinicianNetworkApi.resolveTopic(topicId, { resolvedReplyId }, token, tenantSlug);
      setTopic(res.data);
      showSuccess('Marked resolved', 'This discussion is now closed.');
    } catch (error: any) {
      showError('Could not mark resolved', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setResolving(false);
    }
  };

  const childrenOf = (parentId: string | null) =>
    replies.filter((r) => r.parent_reply_id === parentId);

  const renderReply = (reply: CnReply, depth: number): React.ReactNode => (
    <div
      key={reply.id}
      className={depth > 0 ? 'ml-6 mt-3 border-l-2 border-slate-200 pl-4' : 'mt-3'}
    >
      <div className="border border-slate-200 rounded-lg p-3 bg-white">
        <p className="text-xs text-slate-500">
          {reply.authorHandle}
          {reply.isOwnPost && <span className="ml-1 font-medium">· Your reply</span>} ·{' '}
          {new Date(reply.created_at).toLocaleString()}
          {topic?.resolved_reply_id === reply.id && (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Answer
            </span>
          )}
        </p>
        <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{reply.body_redacted}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setReplyingTo(reply.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>
          {topic?.isOwnPost && topic.status === 'open' && (
            <button
              onClick={() => markResolved(reply.id)}
              disabled={resolving}
              className="text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
            >
              Mark as answer
            </button>
          )}
        </div>
      </div>
      {childrenOf(reply.id).map((child) => renderReply(child, depth + 1))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-sm text-slate-500">Discussion not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to={`/ehr/${tenantSlug}/clinician-network/panels/${topic.panel_id}`}
          className="text-sm text-teal-700 hover:text-teal-800"
        >
          ← Back to topics
        </Link>

        <div className="mt-2 border border-slate-200 rounded-lg p-5 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
            {topic.status === 'resolved' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" /> Resolved
              </span>
            )}
            {topic.isOwnPost && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                Your post
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {topic.authorHandle} · {new Date(topic.created_at).toLocaleString()}
          </p>
          <p className="text-sm text-slate-800 mt-3 whitespace-pre-wrap">{topic.body_redacted}</p>
          {topic.isOwnPost && topic.status === 'open' && (
            <button
              onClick={() => markResolved(null)}
              disabled={resolving}
              className="mt-4 text-sm font-medium text-white bg-green-700 hover:bg-green-800 rounded px-3 py-2 disabled:opacity-50"
            >
              {resolving ? 'Saving…' : 'Mark Resolved'}
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold text-slate-900 mt-6">
          Replies ({replies.length})
        </h2>
        {replies.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No replies yet. Start the discussion.</p>
        ) : (
          <div>{childrenOf(null).map((reply) => renderReply(reply, 0))}</div>
        )}

        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-slate-900">
            {replyingTo ? 'Reply to a reply' : 'Add a reply'}
            {replyingTo && (
              <button
                onClick={() => setReplyingTo(null)}
                className="ml-2 text-xs font-normal text-slate-500 hover:text-slate-700"
              >
                (cancel nested reply)
              </button>
            )}
          </h3>
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={3}
            placeholder="Share your thinking — no patient identifiers."
            className={`w-full text-sm border rounded px-3 py-2 mt-2 ${
              phiError ? 'border-red-500 bg-red-50' : 'border-slate-300'
            }`}
          />
          {phiError && (
            <p className="text-xs text-red-700 mt-1 flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {phiError.message}
                {phiError.matchedSpan && (
                  <>
                    {' '}Matched: <code className="font-semibold">“{phiError.matchedSpan}”</code>
                  </>
                )}
              </span>
            </p>
          )}
          <button
            onClick={submitReply}
            disabled={sending || !replyBody.trim()}
            className="mt-2 flex items-center gap-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-4 py-2 disabled:opacity-50"
          >
            {sending && <Loader className="h-4 w-4 animate-spin" />}
            {sending ? 'Checking…' : 'Post reply'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicianNetworkTopicThread;
