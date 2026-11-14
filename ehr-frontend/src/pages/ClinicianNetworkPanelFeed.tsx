import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader, MessageSquare, Plus } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CnTopic, cnErrorMessage } from '../utils/clinicianNetwork';

type SortKey = 'recent' | 'discussed' | 'unresolved';

// S287 — Panel feed: topic list with sort control + create-topic entry point.
const ClinicianNetworkPanelFeed: React.FC = () => {
  const { tenantSlug, panelId } = useParams<{ tenantSlug: string; panelId: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [topics, setTopics] = useState<CnTopic[]>([]);
  const [sort, setSort] = useState<SortKey>('recent');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    load(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const load = async (sortKey: SortKey) => {
    if (!tenantSlug || !token || !panelId) return;
    setLoading(true);
    try {
      const res = await clinicianNetworkApi.listTopics(panelId, sortKey, token, tenantSlug);
      setTopics(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      showError('Could not load topics', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to={`/ehr/${tenantSlug}/clinician-network`}
          className="text-sm text-teal-700 hover:text-teal-800"
        >
          ← All panels
        </Link>
        <div className="flex items-center justify-between mt-2 gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Panel topics</h1>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/clinician-network/panels/${panelId}/new`)}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-3 py-2"
          >
            <Plus className="h-4 w-4" /> Create Topic
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          {(
            [
              { key: 'recent', label: 'Recent' },
              { key: 'discussed', label: 'Most Discussed' },
              { key: 'unresolved', label: 'Unresolved' },
            ] as Array<{ key: SortKey; label: string }>
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`text-sm rounded-full px-3 py-1.5 border ${
                sort === opt.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-slate-500 mt-8">
            No topics here yet. Start the first discussion.
          </p>
        ) : (
          <div className="space-y-3 mt-4">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={`/ehr/${tenantSlug}/clinician-network/topics/${topic.id}`}
                className="block border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{topic.title}</h2>
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
                <p className="text-sm text-slate-500 mt-1">
                  {topic.authorHandle} · {topic.replyCount}{' '}
                  {topic.replyCount === 1 ? 'reply' : 'replies'} ·{' '}
                  <MessageSquare className="inline h-3 w-3" />{' '}
                  {new Date(topic.created_at).toLocaleString()}
                </p>
                {topic.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {topic.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicianNetworkPanelFeed;
