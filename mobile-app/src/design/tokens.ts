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

/** Type scale: caption 11, body 13, bodyLarge 14, title 16, titleLarge 18, headline 20–22 */
export const fontSize = {
  caption: 11,
  body: 13,
  bodyLarge: 14,
  title: 16,
  titleLarge: 18,
  headline: 20,
  headlineLarge: 22
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const
};

export const lineHeight = {
  caption: 14,
  body: 18,
  bodyLarge: 20,
  title: 22,
  titleLarge: 24,
  headline: 26,
  headlineLarge: 28
} as const;

/** Precomputed text styles keyed by token (color not included; use theme.colors in component). */
export const textStyles = {
  caption: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, lineHeight: lineHeight.caption },
  body: { fontSize: fontSize.body, fontWeight: fontWeight.regular, lineHeight: lineHeight.body },
  bodyLarge: { fontSize: fontSize.bodyLarge, fontWeight: fontWeight.medium, lineHeight: lineHeight.bodyLarge },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.bold, lineHeight: lineHeight.title },
  titleLarge: { fontSize: fontSize.titleLarge, fontWeight: fontWeight.bold, lineHeight: lineHeight.titleLarge },
  headline: { fontSize: fontSize.headline, fontWeight: fontWeight.extraBold, lineHeight: lineHeight.headline },
  headlineLarge: { fontSize: fontSize.headlineLarge, fontWeight: fontWeight.extraBold, lineHeight: lineHeight.headlineLarge }
} as const;
