import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

/**
 * Icon Component - Uses emoji icons for now
 * Can be replaced with react-native-vector-icons when needed
 */
interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

const iconMap: { [key: string]: string } = {
  // Navigation
  home: '🏠',
  calendar: '📅',
  patients: '👥',
  messages: '💬',
  more: '⋯',
  
  // Clinical
  stethoscope: '🩺',
  notes: '📝',
  prescription: '💊',
  lab: '🧪',
  vitals: '📊',
  chart: '📋',
  problem: '⚠️',
  allergy: '🚨',
  record: '📄',
  
  // Actions
  add: '➕',
  edit: '✏️',
  delete: '🗑️',
  save: '💾',
  cancel: '❌',
  check: '✓',
  close: '✕',
  search: '🔍',
  filter: '🔽',
  refresh: '🔄',
  share: '📤',
  download: '⬇️',
  upload: '⬆️',
  logout: '🚪',
  
  // Status
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  alert: '🚨',
  
  // Medical
  heart: '❤️',
  'heart-pulse': '💓',
  'heart-beat': '💓',
  lungs: '🫁',
  pill: '💊',
  syringe: '💉',
  thermometer: '🌡️',
  bandage: '🩹',
  hospital: '🏥',
  'blood-pressure': '🩸',
  weight: '⚖️',
  
  // UI
  arrowRight: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  chevronRight: '›',
  chevronLeft: '‹',
  menu: '☰',
  settings: '⚙️',
  user: '👤',
  clock: '🕐',
  bell: '🔔',
};

const Icon: React.FC<IconProps> = ({ name, size = 20, color, style }) => {
  const icon = iconMap[name] || '?';
  
  return (
    <Text
      style={[
        styles.icon,
        { fontSize: size, color: color },
        style,
      ]}
    >
      {icon}
    </Text>
  );
};

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});

export default Icon;

