// UMOYA Design System — Mobile Tokens
// Brand: Breath · Intelligence · Continuity of Care
// Primary: Breath Teal (#0AA98A) | Forest Green (#1B6B3A) | Deep Night (#080E1A)

export const C = {
  // ── Backgrounds (deep night palette) ──────────────────────────────────
  bg:       '#070C17',   // deepest — page background
  surface:  '#0C1524',   // cards, panels
  surface2: '#101D2E',   // elevated insets, secondary panels
  card:     '#0F1B2B',   // card background
  // ── Borders ────────────────────────────────────────────────────────────
  border:      '#152236',
  borderLight: '#1E3450',
  // ── UMOYA Brand Colors ──────────────────────────────────────────────────
  teal:   '#0AA98A',   // Breath Teal — primary brand, AI, active states
  green:  '#1B9E5A',   // Forest Green — success, stable, growth
  blue:   '#3B9EFF',   // Sky Blue — info, links, secondary actions
  violet: '#9B6BFF',   // Nurse Violet — nursing workflows accent
  coral:  '#E8614D',   // Warm Coral — critical alerts, urgent CTAs
  amber:  '#F0954A',   // Alert Amber — warnings, high severity
  orange: '#D95F1A',   // Deep Orange — escalation
  red:    '#C93B3B',   // Clinical Red — danger, blood bank, critical
  // ── Semantic aliases (keep for backward compat) ────────────────────────
  purple: '#9B6BFF',
  // ── Text ────────────────────────────────────────────────────────────────
  text:          '#E2EDF8',   // primary body text
  textPrimary:   '#E2EDF8',
  textSecondary: '#7A9CBC',
  textMuted:     '#3D607F',
} as const;

export const FONT = {
  ui:   'Sora_400Regular',
  uiMd: 'Sora_500Medium',
  uiSb: 'Sora_600SemiBold',
  uiBd: 'Sora_700Bold',
  uiXb: 'Sora_800ExtraBold',
  uiBk: 'Sora_800ExtraBold',
  mono:   'JetBrainsMono_400Regular',
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
  sm: {
    shadowColor: '#0AA98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 22,
    elevation: 14,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.50,
    shadowRadius: 30,
    elevation: 20,
  },
  teal: {
    shadowColor: '#0AA98A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Semantic severity — unchanged names, updated to UMOYA palette
export const SEVERITY = {
  critical: '#C93B3B',
  high:     '#E8614D',
  warning:  '#F0954A',
  medium:   '#3B9EFF',
  stable:   '#1B9E5A',
  info:     '#3B9EFF',
  normal:   '#1B9E5A',
  low:      '#F0954A',
  elevated: '#F0954A',
} as const;

// UMOYA gradient pairs (for LinearGradient usage)
export const GRADIENTS = {
  brand:    ['#0AA98A', '#1B6B3A'],   // teal → forest
  night:    ['#070C17', '#0C1524'],   // page bg
  coral:    ['#E8614D', '#C93B3B'],   // alert
  info:     ['#3B9EFF', '#1B6B8A'],
  surface:  ['#0C1524', '#101D2E'],
} as const;
