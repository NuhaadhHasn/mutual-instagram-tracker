// Theme constants

export const LightColors = {
  primary: '#E1306C', // Instagram pink
  secondary: '#405DE6', // Instagram blue
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#FFFFFF',
  text: '#262626',
  textSecondary: '#8E8E8E',
  border: '#DBDBDB',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  tabBar: '#FFFFFF',
  tabBarInactive: '#C0C0C0',
  cardBackground: '#FFFFFF',
  inputBackground: '#FFFFFF',
  sortPillInactive: '#F2F2F2',
};

export const DarkColors: typeof LightColors = {
  primary: '#E1306C',
  secondary: '#5851DB',
  background: '#000000',
  surface: '#0A0A0B',
  surfaceElevated: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#8E8E8E',
  border: '#38383A',
  success: '#32D74B',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',
  tabBar: '#1C1C1E',
  tabBarInactive: '#48484A',
  cardBackground: '#1C1C1E',
  inputBackground: '#1C1C1E',
  sortPillInactive: '#2C2C2E',
};

export type ColorSet = typeof LightColors;

// Backward-compatible alias — any code still importing { Colors } resolves to light.
export const Colors = LightColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Gradients = {
  primary: ['#833AB4', '#E1306C', '#FCAF45'] as const,
  primaryShort: ['#E1306C', '#C13584'] as const,
  blue: ['#405DE6', '#5851DB'] as const,
  dark: ['#1C1C1E', '#2C2C2E'] as const,
};

export const DarkGradients = {
  primary: ['#4B0082', '#8B0038', '#1C1C1E'] as const,
  primaryShort: ['#8B0038', '#6B0030'] as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: 'normal' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: 'normal' as const,
  },
};
