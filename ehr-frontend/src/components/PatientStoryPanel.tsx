import React, { useCallback, useEffect, useState } from 'react';
import { ehrApi } from '../services/api';

export interface PatientStoryPanelProps {
  patientId: string | null;
  token: string | null;
  tenantSlug: string | null;
  /** Optional: show version selector and diff (version-to-version) */
  showVersionDiff?: boolean;
}

interface TimelineEntry {
  sessionId: string;
  publishedAt: string;
  summaryExcerpt: string;
  keyPoints: string[];
}

interface StoryContent {
  timeline?: TimelineEntry[];
  generatedAt?: string;
  triggerSessionId?: string | null;
}

export function PatientStoryPanel({
  patientId,
  token,
  tenantSlug,
  showVersionDiff = false,
}: PatientStoryPanelProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<{
    id: string;
    version: number;
    content: StoryContent;
    createdAt: string;
  } | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; createdAt: string }>>([]);

  const loadLatest = useCallback(async () => {
    if (!patientId || !token || !tenantSlug) {
      setStory(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await ehrApi.getPatientStoryLatest(patientId, token, tenantSlug);
      if (data?.featureEnabled && data?.story) {
        setStory(data.story);
      } else {
        setStory(null);
      }
    } catch {
      setStory(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, token, tenantSlug]);

  const loadVersions = useCallback(async () => {
    if (!patientId || !token || !tenantSlug || !showVersionDiff) return;
    try {
      const { data } = await ehrApi.getPatientStoryVersions(patientId, token, tenantSlug, { limit: 20 });
      if (data?.featureEnabled && Array.isArray(data.versions)) {
        setVersions(data.versions.map((v: any) => ({ version: v.version, createdAt: v.createdAt })));
      }
    } catch {
      setVersions([]);
    }
  }, [patientId, token, tenantSlug, showVersionDiff]);

  useEffect(() => {
    loadLatest();
    loadVersions();
  }, [loadLatest, loadVersions]);

  if (!patientId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Patient Story</h3>
        <p className="mt-2 text-xs text-slate-500">Select a session to load the patient’s longitudinal story.</p>
      </div>
    );
  }

  if (loading && !story) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Patient Story</h3>
        <p className="mt-2 text-xs text-slate-500">Loading latest snapshot…</p>
      </div>
    );
  }

  const timeline = story?.content?.timeline ?? [];
  const generatedAt = story?.content?.generatedAt;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" role="region" aria-label="Patient story panel">
      <h3 className="text-sm font-bold text-slate-900">Patient Story</h3>
      {story ? (
        <>
          <p className="mt-1 text-[11px] text-slate-600">
            Version {story.version} • generated {generatedAt ? new Date(generatedAt).toLocaleString() : ''}
          </p>
          <div className="mt-3 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Timeline</h4>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500">No published encounters in this story yet.</p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((entry) => (
                  <li
                    key={entry.sessionId}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs"
                  >
                    <p className="font-semibold text-slate-700">
                      {entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : '—'}
                    </p>
                    {entry.summaryExcerpt && (
                      <p className="mt-1 text-slate-600 line-clamp-2">{entry.summaryExcerpt}</p>
                    )}
                    {Array.isArray(entry.keyPoints) && entry.keyPoints.length > 0 && (
                      <p className="mt-1 text-slate-500">Key points: {entry.keyPoints.slice(0, 2).join('; ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {showVersionDiff && versions.length > 1 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <h4 className="text-xs font-semibold text-slate-700">Version diff</h4>
              <p className="mt-1 text-[11px] text-slate-500">
                Use API <code className="rounded bg-slate-100 px-1">GET .../story/diff?from=&amp;to=</code> for
                version-to-version diff.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          No patient story snapshot yet. Enable <code>FEATURE_POSTVISIT_PATIENT_STORY</code> and publish a session to
          generate.
        </p>
      )}
    </div>
  );
}
