import React, { useState } from 'react';

export interface AnnotatedSpan {
  text: string;
  isEntity: boolean;
  entityId?: string;
  entityType?: string;
  entityValue?: string;
  normalizedValue?: Record<string, unknown>;
  confidence?: number;
  startIndex: number;
  endIndex: number;
}

interface Props {
  spans: AnnotatedSpan[];
  onEntityClick?: (entity: AnnotatedSpan) => void;
}

const TYPE_COLORS: Record<string, string> = {
  symptom: 'bg-red-100 text-red-800 border-red-300',
  medication: 'bg-blue-100 text-blue-800 border-blue-300',
  condition: 'bg-amber-100 text-amber-800 border-amber-300',
  procedure: 'bg-purple-100 text-purple-800 border-purple-300',
  anatomy: 'bg-teal-100 text-teal-800 border-teal-300',
  lab_test: 'bg-green-100 text-green-800 border-green-300',
  default: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const AnnotatedText: React.FC<Props> = ({ spans, onEntityClick }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <span>
      {spans.map((span, i) => {
        if (!span.isEntity) {
          return <span key={i}>{span.text}</span>;
        }
        const colorClass = TYPE_COLORS[span.entityType || ''] || TYPE_COLORS.default;
        const isHovered = hoveredId === span.entityId;
        return (
          <span
            key={i}
            className={`relative inline cursor-pointer rounded px-0.5 border-b-2 ${colorClass} ${isHovered ? 'ring-2 ring-offset-1' : ''}`}
            onMouseEnter={() => setHoveredId(span.entityId ?? null)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onEntityClick?.(span)}
            title={`${span.entityType ?? ''}: ${span.entityValue ?? ''}${span.confidence ? ` (${Math.round(span.confidence * 100)}%)` : ''}`}
          >
            {span.text}
            {isHovered && (
              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap shadow-lg">
                {span.entityType} {span.confidence ? `· ${Math.round(span.confidence * 100)}%` : ''}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};
