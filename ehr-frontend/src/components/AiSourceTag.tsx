import React from 'react';

interface Props {
  aiSource: string;
  compact?: boolean;
}

function parseSource(aiSource: string): { label: string; color: string; bg: string } {
  if (!aiSource || aiSource === 'rule') {
    return { label: 'Rule-based', color: '#64748b', bg: '#f1f5f9' };
  }
  if (aiSource.startsWith('llm:ollama')) {
    return { label: 'On-prem AI', color: '#0f766e', bg: '#ccfbf1' };
  }
  if (aiSource.startsWith('llm:azure_openai')) {
    return { label: 'Azure AI', color: '#1d4ed8', bg: '#dbeafe' };
  }
  if (aiSource.startsWith('llm:aws_bedrock')) {
    return { label: 'AWS AI', color: '#7c3aed', bg: '#ede9fe' };
  }
  if (aiSource.startsWith('llm:anthropic')) {
    return { label: 'Anthropic AI', color: '#b45309', bg: '#fef3c7' };
  }
  if (aiSource.startsWith('llm:')) {
    return { label: 'AI-generated', color: '#15803d', bg: '#dcfce7' };
  }
  return { label: aiSource, color: '#64748b', bg: '#f1f5f9' };
}

export const AiSourceTag: React.FC<Props> = ({ aiSource, compact = false }) => {
  const { label, color, bg } = parseSource(aiSource);

  return (
    <span
      title={`Source: ${aiSource}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: 12,
        fontSize: compact ? 10 : 11,
        fontWeight: 500,
        color,
        backgroundColor: bg,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {aiSource.startsWith('llm:') ? '✦' : '◇'} {label}
    </span>
  );
};
