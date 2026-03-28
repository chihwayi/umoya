import { useState, useCallback } from 'react';
import { CdssBaseResponse } from '../types/cdss';

export interface CdssResult<T> extends CdssBaseResponse {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Wraps any CDSS API call with safe defaults.
 *
 * - Extracts confidence, abstained, citations, model_id from response
 * - If abstained === true, data is null; component must show AbstentionBanner
 * - Handles loading and error states
 *
 * Usage:
 *   const { call, result } = useCdssResponse<LabAnalysis>();
 *   await call(() => cdssApi.interpretLabResults(labs));
 *   if (result.abstained) return <AbstentionBanner surface="Lab Interpretation" />;
 */
export function useCdssResponse<T>() {
  const [result, setResult] = useState<CdssResult<T>>({
    data: null,
    loading: false,
    error: null,
    confidence: undefined,
    abstained: false,
    citations: [],
  });

  const call = useCallback(async (fn: () => Promise<{ data: any }>) => {
    setResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fn();
      const raw = response.data as any;

      // CDSS may return governance fields at top level or nested under .result
      const confidence     = raw?.confidence     ?? raw?.result?.confidence;
      const abstained      = raw?.abstained      ?? raw?.result?.abstained      ?? false;
      const citations      = raw?.citations      ?? raw?.result?.citations      ?? [];
      const model_id       = raw?.model_id       ?? raw?.result?.model_id;
      const latency_ms     = raw?.latency_ms     ?? raw?.result?.latency_ms;
      const abstain_reason = raw?.abstain_reason ?? raw?.result?.abstain_reason;
      const certainty_level = raw?.certainty_level ?? raw?.result?.certainty_level;

      // When abstained, data is null — component must not render AI content
      const data: T | null = abstained ? null : (raw as T);

      setResult({
        data,
        loading: false,
        error: null,
        confidence,
        abstained,
        abstain_reason,
        certainty_level,
        citations,
        model_id,
        latency_ms,
      });
    } catch (err: any) {
      setResult(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message ?? err?.message ?? 'AI service unavailable',
      }));
    }
  }, []);

  return { call, result };
}
