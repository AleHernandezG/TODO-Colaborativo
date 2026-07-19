const { colors, radius } = require('./src/theme/tokens')

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        background: { DEFAULT: colors.light.background, dark: colors.dark.background },
        surface: { DEFAULT: colors.light.surface, dark: colors.dark.surface },
        content: { DEFAULT: colors.light.text, dark: colors.dark.text },
        muted: { DEFAULT: colors.light.textMuted, dark: colors.dark.textMuted },
        line: { DEFAULT: colors.light.border, dark: colors.dark.border },
        primary: { DEFAULT: colors.light.primary, dark: colors.dark.primary },
        'on-primary': { DEFAULT: colors.light.onPrimary, dark: colors.dark.onPrimary },
        danger: { DEFAULT: colors.light.danger, dark: colors.dark.danger },
        success: { DEFAULT: colors.light.success, dark: colors.dark.success },
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
      },
    },
  },
  plugins: [],
}
