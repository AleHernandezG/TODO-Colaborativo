import { useColorScheme } from 'react-native'
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper'

import tokens from './tokens'

export const { colors, radius, minTouchTarget } = tokens as {
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
  radius: Record<'sm' | 'md' | 'lg' | 'full', number>
  minTouchTarget: number
}

export type ThemeColors = {
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
  borderStrong: string
  primary: string
  onPrimary: string
  danger: string
  success: string
}

export function usePalette(): ThemeColors {
  return useColorScheme() === 'dark' ? colors.dark : colors.light
}

export const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.light.primary,
    onPrimary: colors.light.onPrimary,
    background: colors.light.background,
    surface: colors.light.surface,
    onSurface: colors.light.text,
    error: colors.light.danger,
    outline: colors.light.border,
  },
}

export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.dark.primary,
    onPrimary: colors.dark.onPrimary,
    background: colors.dark.background,
    surface: colors.dark.surface,
    onSurface: colors.dark.text,
    error: colors.dark.danger,
    outline: colors.dark.border,
  },
}
