import { colors, radius, spacing, fontSize, fontWeight, lineHeight, textStyles } from './tokens';

export const theme = {
  colors,
  spacing,
  radius,
  typography: {
    fontSize,
    fontWeight,
    lineHeight,
    textStyles
  },
  layout: {
    screenPadding: spacing.lg,
    cardGap: spacing.md
  }
} as const;

export type MediCoreTheme = typeof theme;
