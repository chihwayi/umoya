export const colors = {
  background: '#080E1A',
  surface: '#0E1829',
  card: '#121F33',
  border: '#1E3050',
  accentTeal: '#00C896',
  accentBlue: '#2B7FFF',
  accentAmber: '#FFB020',
  accentRed: '#FF4D6A',
  accentPurple: '#A66CFF',
  accentOrange: '#FF7A40',
  textPrimary: '#E8F0FF',
  textSecondary: '#7A92B8',
  textMuted: '#4A6080'
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999
} as const;

export const urgency = {
  critical: colors.accentRed,
  warning: colors.accentAmber,
  routine: colors.accentTeal
} as const;
