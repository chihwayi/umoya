/**
 * MediCore Mobile App Design System
 * Light Eye-Friendly Theme - Optimized for Long-Term Use
 * Modern healthcare app design with soft, calming colors
 */

export const colors = {
  // Background colors - Greyish theme
  background: '#e5e7eb', // Light greyish background
  backgroundSecondary: '#f3f4f6', // Slightly lighter grey for cards
  backgroundTertiary: '#d1d5db', // Medium grey for subtle sections
  backgroundGradient: ['#e5e7eb', '#f3f4f6', '#d1d5db'], // Greyish gradient array

  // Glassmorphism - Greyish theme with subtle purple tint
  glassCard: 'rgba(243, 244, 246, 0.95)', // Light grey glass with slight transparency
  glassBorder: 'rgba(139, 92, 246, 0.15)', // Subtle purple border
  glassHover: 'rgba(139, 92, 246, 0.05)', // Light purple hover
  glassGlow: 'rgba(139, 92, 246, 0.1)', // Subtle purple glow

  // Primary colors - Vibrant purple/indigo gradient (kept for brand consistency)
  primary: '#8b5cf6', // Vibrant purple
  primaryDark: '#7c3aed', // Deep purple
  primaryLight: '#a78bfa', // Light purple
  primaryGlow: 'rgba(139, 92, 246, 0.2)', // Purple glow
  primaryGradient: ['#8b5cf6', '#6366f1'], // Purple to indigo (kept for dropdowns/notifications)

  // Accent colors - Modern blue
  accent: '#3b82f6', // Bright blue
  accentDark: '#2563eb', // Deep blue
  accentLight: '#60a5fa', // Light blue

  // Text colors - Very dark/black for high contrast on grey backgrounds
  textPrimary: '#000000', // Pure black for primary text - maximum readability
  textSecondary: '#1f2937', // Very dark grey for secondary text
  textTertiary: '#374151', // Dark grey for tertiary text
  textMuted: '#6b7280', // Medium grey for less important text
  textOnPrimary: '#ffffff', // White text on primary colored backgrounds

  // Status colors - Vibrant and clear
  success: '#10b981', // Emerald-500
  successLight: '#34d399', // Emerald-400
  successDark: '#059669', // Emerald-600
  error: '#ef4444', // Red-500
  errorLight: '#f87171', // Red-400
  errorDark: '#dc2626', // Red-600
  warning: '#f59e0b', // Amber-500
  warningLight: '#fbbf24', // Amber-400
  warningDark: '#d97706', // Amber-600
  info: '#3b82f6', // Blue-500
  infoLight: '#60a5fa', // Blue-400
  infoDark: '#2563eb', // Blue-600

  // Border colors - Greyish with purple accents
  border: 'rgba(209, 213, 219, 0.8)', // Medium grey border
  borderLight: 'rgba(229, 231, 235, 0.6)', // Light grey border
  borderActive: 'rgba(139, 92, 246, 0.3)', // Purple active border

  // Special colors
  appointmentScheduled: '#6366f1', // Indigo
  appointmentCheckedIn: '#3b82f6', // Blue
  appointmentInProgress: '#8b5cf6', // Purple
  appointmentCompleted: '#10b981', // Green
  appointmentCancelled: '#ef4444', // Red
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const typography = {
  // Headings
  h1: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  h4: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  h5: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },

  // Body
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    lineHeight: 24,
  },

  // Labels
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textMuted,
    lineHeight: 18,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  purpleGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const animations = {
  duration: {
    fast: 200,
    normal: 400,
    slow: 800,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

export const designSystem = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  animations,
};

export default designSystem;
