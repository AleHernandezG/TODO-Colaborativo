const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F3F4F6',
    text: '#111827',
    textMuted: '#4B5563',
    border: '#D1D5DB',
    primary: '#1D4ED8',
    onPrimary: '#FFFFFF',
    danger: '#B91C1C',
    success: '#15803D',
  },
  dark: {
    background: '#0B0F19',
    surface: '#161B26',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    border: '#2A3140',
    primary: '#60A5FA',
    onPrimary: '#0B0F19',
    danger: '#F87171',
    success: '#4ADE80',
  },
}

const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
}

const minTouchTarget = 44

module.exports = { colors, radius, minTouchTarget }
