import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props {
  aiSource: string;
  compact?: boolean;
}

function parseSource(aiSource: string): { label: string; color: string } {
  if (!aiSource || aiSource === 'rule') {
    return { label: '◇ Rule-based', color: C.textSecondary };
  }
  if (aiSource.startsWith('llm:ollama')) {
    return { label: '✦ On-prem AI', color: C.teal };
  }
  if (aiSource.startsWith('llm:azure_openai')) {
    return { label: '✦ Azure AI', color: C.blue };
  }
  if (aiSource.startsWith('llm:aws_bedrock')) {
    return { label: '✦ AWS AI', color: C.blue };
  }
  if (aiSource.startsWith('llm:anthropic')) {
    return { label: '✦ Anthropic AI', color: C.amber };
  }
  if (aiSource.startsWith('llm:')) {
    return { label: '✦ AI-generated', color: C.green };
  }
  return { label: aiSource, color: C.textSecondary };
}

export const AiSourcePill: React.FC<Props> = ({ aiSource, compact = false }) => {
  const { label, color } = parseSource(aiSource);
  return (
    <View style={[styles.pill, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={[compact ? styles.textCompact : styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontFamily: FONT.ui,
    fontSize: 11,
    fontWeight: '500',
  },
  textCompact: {
    fontFamily: FONT.ui,
    fontSize: 10,
    fontWeight: '500',
  },
});
