import React from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

export interface ClinicalRecommendation {
  recommendation: string;
  evidence_level: 'High' | 'Medium' | 'Low';
  reasoning?: string;
  red_flags?: string[];
  action_items?: string[];
  references?: string[];
}

interface GuidelineRecommendationCardProps {
  data: ClinicalRecommendation;
  className?: string;
}

export const GuidelineRecommendationCard: React.FC<GuidelineRecommendationCardProps> = ({ 
  data, 
  className = '' 
}) => {
  // Determine severity/color based on evidence level and red flags
  const getSeverityConfig = () => {
    if (data.red_flags && data.red_flags.length > 0) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
        titleColor: 'text-red-900',
        accentColor: 'bg-red-100 text-red-700'
      };
    }
    
    switch (data.evidence_level?.toLowerCase()) {
      case 'high':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          titleColor: 'text-green-900',
          accentColor: 'bg-green-100 text-green-700'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
          titleColor: 'text-yellow-900',
          accentColor: 'bg-yellow-100 text-yellow-800'
        };
      default: // Low or unknown
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: <Info className="w-5 h-5 text-blue-600" />,
          titleColor: 'text-blue-900',
          accentColor: 'bg-blue-100 text-blue-700'
        };
    }
  };

  const config = getSeverityConfig();

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 flex-shrink-0">
          {config.icon}
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${config.titleColor} leading-tight mb-1`}>
            Clinical Recommendation
          </h4>
          <p className="text-sm text-slate-700">
            {data.recommendation}
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${config.accentColor} capitalize`}>
          {data.evidence_level} Evidence
        </div>
      </div>

      {/* Red Flags Section */}
      {data.red_flags && data.red_flags.length > 0 && (
        <div className="mb-3 ml-8 bg-white/60 rounded-lg p-3 border border-red-100">
          <p className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Red Flags Detected
          </p>
          <ul className="space-y-1">
            {data.red_flags.map((flag, idx) => (
              <li key={idx} className="text-xs text-red-700 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning Section */}
      {data.reasoning && (
        <div className="mb-3 ml-8">
           <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Clinical Reasoning
          </p>
          <p className="text-sm text-slate-600 italic bg-white/50 p-2 rounded border border-slate-100">
            {data.reasoning}
          </p>
        </div>
      )}

      {/* Action Items Section */}
      {data.action_items && data.action_items.length > 0 && (
        <div className="ml-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Suggested Actions
          </p>
          <ul className="space-y-2">
            {data.action_items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-white rounded-md p-2 border border-slate-100 shadow-sm">
                <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-slate-500">{idx + 1}</span>
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* References / Citations (Sprint 113) */}
      {data.references && data.references.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 ml-8">
          <p className="text-xs font-semibold text-slate-500 mb-1">Sources</p>
          <ul className="space-y-0.5">
            {data.references.map((ref: any, i: number) => (
              <li key={i} className="text-xs text-slate-500 flex items-start gap-1">
                <span className="mt-0.5">📖</span>
                <span>{typeof ref === 'string' ? ref : (ref.text || ref.title || ref.source)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
