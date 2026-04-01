import React from 'react';
import { BookOpen, ExternalLink, Sparkles } from 'lucide-react';

export interface GuidelineCitation {
  source?: string;
  text?: string;
  recommendation?: string;
  confidence?: number;
  url?: string;
}

interface GuidelineCitationCardProps {
  result: GuidelineCitation;
  index?: number;
  dark?: boolean;
  className?: string;
}

const GuidelineCitationCard: React.FC<GuidelineCitationCardProps> = ({
  result,
  index,
  dark = false,
  className = '',
}) => {
  const confidenceBadge = () => {
    if (!result.confidence) return null;
    const pct = Math.round(result.confidence * 100);
    const style = dark
      ? result.confidence > 0.8
        ? 'bg-emerald-800 text-emerald-200 border-emerald-600'
        : result.confidence > 0.5
        ? 'bg-yellow-800 text-yellow-200 border-yellow-600'
        : 'bg-red-800 text-red-200 border-red-600'
      : result.confidence > 0.8
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : result.confidence > 0.5
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
      : 'bg-red-50 text-red-700 border-red-200';
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${style}`}>
        {pct}% Match
      </span>
    );
  };

  if (dark) {
    return (
      <div className={`bg-slate-800 border border-slate-600 rounded-xl p-4 hover:bg-slate-750 transition-colors ${className}`}>
        <div className="flex items-start gap-3">
          {index !== undefined && (
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {index + 1}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-1.5 leading-tight">
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                {result.source || 'Clinical Guideline'}
              </h4>
              {confidenceBadge()}
            </div>
            {result.text && (
              <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap mb-3">{result.text}</p>
            )}
            {result.recommendation && (
              <div className="mb-3 p-3 bg-blue-900 border border-blue-700 rounded-lg">
                <strong className="flex items-center gap-1.5 text-blue-300 text-xs uppercase tracking-wide mb-1">
                  <Sparkles className="w-3 h-3" />
                  Recommendation
                </strong>
                <p className="text-sm text-blue-100">{result.recommendation}</p>
              </div>
            )}
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline"
              >
                View Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 leading-tight text-sm">
          <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
          {result.source || 'Clinical Guideline'}
        </h4>
        {confidenceBadge()}
      </div>
      {result.text && (
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-3">{result.text}</p>
      )}
      {result.recommendation && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <strong className="flex items-center gap-1.5 text-blue-800 text-xs uppercase tracking-wide mb-1">
            <Sparkles className="w-3 h-3 text-blue-600" />
            Recommendation
          </strong>
          <p className="text-sm text-blue-900">{result.recommendation}</p>
        </div>
      )}
      {result.url && (
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          View Source <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
};

export default GuidelineCitationCard;
