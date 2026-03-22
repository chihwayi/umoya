export const C = {
  // Backgrounds
  bg:          '#080E1A',
  surface:     '#0E1829',
  card:        '#121F33',
  // Borders
  border:      '#1A2B45',
  borderLight: '#243550',
  // Brand
  teal:   '#00C896',
  blue:   '#2B7FFF',
  purple: '#A66CFF',
  red:    '#FF4D6A',
  amber:  '#FF7A40',
  green:  '#00C896',
  orange: '#FF6B00',
  // Text
  textPrimary:   '#E8F0FA',
  textSecondary: '#8FA8CC',
  textMuted:     '#4A6A8A',
} as const;

export const FONT = {
  ui:   'Sora_400Regular',
  uiMd: 'Sora_500Medium',
  uiSb: 'Sora_600SemiBold',
  uiBd: 'Sora_700Bold',
  uiXb: 'Sora_800ExtraBold',
  uiBk: 'Sora_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoBd: 'JetBrainsMono_700Bold',
} as const;

export const RADIUS = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  card: 14,
  pill: 99,
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
  },
} as const;

// Severity colors
export const SEVERITY = {
  critical: C.red,
  high:     C.amber,
  warning:  C.amber,
  medium:   C.blue,
  stable:   C.green,
  info:     C.blue,
  normal:   C.green,
  low:      C.amber,
  elevated: C.amber,
} as const;
