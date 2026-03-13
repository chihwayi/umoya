import { colors, radius, spacing } from './tokens';

export const theme = {
  colors,
  spacing,
  radius,
  layout: {
    screenPadding: spacing.lg,
    cardGap: spacing.md
  }
} as const;

export type MediCoreTheme = typeof theme;
