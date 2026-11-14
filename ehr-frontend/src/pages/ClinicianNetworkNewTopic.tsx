import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CN_AGE_BANDS, PhiFieldError, cnErrorMessage, extractPhiError } from '../utils/clinicianNetwork';

interface SimilarTopic {
  id: string;
  title: string;
  similarity: number;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  presentingComplaint: 'Presenting complaint',
  relevantHistory: 'Relevant history',
  question: 'Question',
};

// S287 — structured case composer. Free-text fields are PHI-checked
// server-side; field-level rejections highlight the exact field + span.
const ClinicianNetworkNewTopic: React.FC = () => {
  const { tenantSlug, panelId } = useParams<{ tenantSlug: string; panelId: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [title, setTitle] = useState('');
  const [ageBand, setAgeBand] = useState<string>(CN_AGE_BANDS[2]);
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('female');
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [relevantHistory, setRelevantHistory] = useState('');
  const [question, setQuestion] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phiError, setPhiError] = useState<PhiFieldError | null>(null);
  const [similar, setSimilar] = useState<SimilarTopic[] | null>(null);

  const token = localStorage.getItem('ehr_token') || '';

  const payload = (forcePost: boolean) => ({
    panelId,
    title: title.trim(),
    ageBand,
    sex,
    presentingComplaint: presentingComplaint.trim(),
    relevantHistory: relevantHistory.trim(),
    question: question.trim(),
    tags: tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    forcePost,
  });

  const submit = async (forcePost: boolean) => {
    if (!tenantSlug || !token || !panelId) return;
    setSubmitting(true);
    setPhiError(null);
    try {
      const res = await clinicianNetworkApi.createTopic(payload(forcePost), token, tenantSlug);
      if (res.data && res.data.created === false) {
        setSimilar(res.data.similarTopics ?? []);
        return;
      }
      const topicId = res.data?.topic?.id ?? res.data?.id;
      showSuccess('Topic posted', 'Your case is now visible to the panel.');
      if (topicId) {
        navigate(`/ehr/${tenantSlug}/clinician-network/topics/${topicId}`);
      } else {
        navigate(`/ehr/${tenantSlug}/clinician-network/panels/${panelId}`);
      }
    } catch (error: any) {
      const phi = extractPhiError(error);
      if (phi.field) {
        setPhiError(phi);
      } else {
        showError('Could not post topic', cnErrorMessage(error, 'Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (name: string) =>
    `w-full text-sm border rounded px-3 py-2 ${
      phiError?.field === name ? 'border-red-500 bg-red-50' : 'border-slate-300'
    }`;

  const phiHint = (name: string) =>
    phiError?.field === name ? (
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
    ) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          to={`/ehr/${tenantSlug}/clinician-network/panels/${panelId}`}
          className="text-sm text-teal-700 hover:text-teal-800"
        >
          ← Back to topics
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">New case discussion</h1>
        <p className="text-sm text-slate-600 mt-1">
          Do not include names, dates of birth, phone numbers, or any patient identifiers.
          Every field is checked before posting.
        </p>

        {similar && similar.length > 0 && (
          <div className="mt-6 border border-amber-300 bg-amber-50 rounded-lg p-4">
            <h2 className="font-semibold text-amber-900">Similar discussions already exist</h2>
            <p className="text-sm text-amber-800 mt-1">
              These look close to what you wrote. Open one instead, or post anyway if yours is
              genuinely different.
            </p>
            <ul className="mt-3 space-y-2">
              {similar.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/ehr/${tenantSlug}/clinician-network/topics/${s.id}`}
                    className="text-sm font-medium text-teal-800 hover:underline"
                  >
                    {s.title}
                  </Link>
                  <span className="text-xs text-slate-500 ml-2">
                    {Math.round(s.similarity * 100)}% match
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => submit(true)}
              disabled={submitting}
              className="mt-3 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded px-3 py-2 disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'No — post anyway'}
            </button>
          </div>
        )}

        <div className="mt-6 space-y-4 bg-white border border-slate-200 rounded-lg p-5">
          <div>
            <label className="text-sm font-medium text-slate-800">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass('title')}
              placeholder="Short clinical question, no identifiers"
            />
            {phiHint('title')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-800">Age band</label>
              <select
                value={ageBand}
                onChange={(e) => setAgeBand(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-2"
              >
                {CN_AGE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'male' | 'female' | 'other')}
                className="w-full text-sm border border-slate-300 rounded px-3 py-2"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800">Presenting complaint</label>
            <textarea
              value={presentingComplaint}
              onChange={(e) => setPresentingComplaint(e.target.value)}
              rows={3}
              className={fieldClass('presentingComplaint')}
              placeholder={FIELD_LABELS.presentingComplaint}
            />
            {phiHint('presentingComplaint')}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800">Relevant history</label>
            <textarea
              value={relevantHistory}
              onChange={(e) => setRelevantHistory(e.target.value)}
              rows={3}
              className={fieldClass('relevantHistory')}
              placeholder={FIELD_LABELS.relevantHistory}
            />
            {phiHint('relevantHistory')}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800">Question for the panel</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className={fieldClass('question')}
              placeholder={FIELD_LABELS.question}
            />
            {phiHint('question')}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800">Tags (comma-separated)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-2"
              placeholder="e.g. fever, referral"
            />
          </div>

          <button
            onClick={() => submit(false)}
            disabled={submitting}
            className="flex items-center gap-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-4 py-2 disabled:opacity-50"
          >
            {submitting && <Loader className="h-4 w-4 animate-spin" />}
            {submitting ? 'Checking…' : 'Post topic'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicianNetworkNewTopic;
