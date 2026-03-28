import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, BookOpen, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import { CdssBaseResponse, confidenceBand, CONFIDENCE_BAND_META } from '../types/cdss';
import { ehrAxios } from '../services/api';
import { AbstentionBanner } from './AbstentionBanner';

interface AiOutputWrapperProps extends CdssBaseResponse {
  /** Short label for this AI surface, e.g. "Lab Interpretation" */
  label: string;
  /** cdss_decision_log id — enables thumbs feedback recording */
  feedbackLogId?: string;
  /** Compact mode: inline badge instead of full bordered panel */
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Universal wrapper for every AI/CDSS output surface.
 *
 * Compliance:
 *  - FDA SaMD: "AI · [surface]" header + "AI-generated · clinician review required" footer always visible
 *  - ONC HTI-1: confidence band + citations drawer for basis-of-recommendation transparency
 *  - HIPAA §164.312(b): feedback thumbs feed the self-learning audit trail
 *
 * Safety:
 *  - If abstained===true: renders AbstentionBanner ONLY — children are suppressed
 *  - A blank panel and an abstention panel look different — clinician cannot miss it
 */
export const AiOutputWrapper: React.FC<AiOutputWrapperProps> = ({
  label,
  feedbackLogId,
  confidence,
  abstained = false,
  abstain_reason,
  certainty_level,
  citations = [],
  model_id,
  latency_ms,
  compact = false,
  children,
  className = '',
}) => {
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<'helpful' | 'not_helpful' | null>(null);

  const band = certainty_level ?? confidenceBand(confidence);
  const bandMeta = CONFIDENCE_BAND_META[band];
  const confidencePct = confidence !== undefined ? `${Math.round(confidence * 100)}%` : null;

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    setFeedbackSent(type);
    if (feedbackLogId) {
      try {
        await ehrAxios.patch(`/cdss-log/${feedbackLogId}/action`, {
          action: type === 'helpful' ? 'accepted' : 'ignored',
          reason: type === 'not_helpful' ? 'Clinician marked as not helpful' : undefined,
        });
      } catch {
        // non-blocking — feedback is best-effort
      }
    }
  };

  // Abstention: show banner, suppress children entirely
  if (abstained) {
    return (
      <AbstentionBanner
        surface={label}
        reason={abstain_reason as string | undefined}
        compact={compact}
      />
    );
  }

  // Compact mode: inline badge without full border panel
  if (compact) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 mb-1">
          <Brain className="h-3 w-3 text-purple-400" />
          <span className="text-xs text-purple-400 font-medium">AI · {label}</span>
          {confidencePct && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${bandMeta.bg} ${bandMeta.color}`}>
              {confidencePct}
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-600">AI-generated</span>
        </div>
        {children}
      </div>
    );
  }

  // Full panel mode
  return (
    <div className={`rounded-lg border border-purple-800/50 bg-purple-950/20 ${className}`}>
      {/* Header — always visible per FDA SaMD */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-800/30">
        <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0" />
        <span className="text-xs font-semibold text-purple-300">AI · {label}</span>

        {confidencePct && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bandMeta.bg} ${bandMeta.color}`}>
            {bandMeta.label} · {confidencePct}
          </span>
        )}

        {citations.length > 0 && (
          <button
            onClick={() => setCitationsOpen(!citationsOpen)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            {citations.length} source{citations.length !== 1 ? 's' : ''}
            {citationsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {model_id && (
          <span
            className="text-[10px] text-gray-600 ml-1 cursor-default"
            title={`Model: ${model_id}${latency_ms ? ` · ${latency_ms}ms` : ''}`}
          >
            ·
          </span>
        )}
      </div>

      {/* Citations drawer */}
      {citationsOpen && citations.length > 0 && (
        <div className="border-b border-purple-800/30 px-3 py-2 space-y-2 bg-purple-950/30">
          {[...citations]
            .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
            .map((c, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(c.isPrimary || i === 0) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800/60 text-purple-200 font-medium shrink-0">
                      Primary
                    </span>
                  )}
                  <span className="font-medium text-gray-200">{c.title}</span>
                  <span className="text-gray-500">· {c.source}</span>
                  {c.relevanceScore !== undefined && (
                    <span className="text-gray-500 ml-auto">{Math.round(c.relevanceScore * 100)}% relevant</span>
                  )}
                </div>
                {c.excerpt && (
                  <p className="text-gray-400 mt-0.5 line-clamp-2">{c.excerpt}</p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Content */}
      <div className="px-3 py-2">
        {children}
      </div>

      {/* Footer — disclosure label ALWAYS rendered (FDA SaMD requirement).
          Feedback thumbs only shown when feedbackLogId is available. */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-purple-800/20">
        {feedbackLogId && (
          <>
            <span className="text-xs text-gray-500">Helpful?</span>
            {feedbackSent ? (
              <span className="text-xs text-gray-500">
                {feedbackSent === 'helpful' ? '✓ Marked helpful' : '✓ Feedback recorded'}
              </span>
            ) : (
              <>
                <button
                  onClick={() => handleFeedback('helpful')}
                  className="p-1 text-gray-500 hover:text-green-400 rounded transition-colors"
                  title="Mark as helpful"
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleFeedback('not_helpful')}
                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                  title="Mark as not helpful"
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </>
            )}
          </>
        )}
        {/* Always visible — regulatory disclosure */}
        <span
          className="ml-auto text-[10px] text-gray-600"
          title="AI-generated output. Clinician judgment required."
        >
          AI-generated · clinician review required
        </span>
      </div>
    </div>
  );
};
