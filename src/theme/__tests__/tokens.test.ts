import { colors, minTouchTarget } from '..'

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (light + 0.05) / (dark + 0.05)
}

describe('tokens de color', () => {
  const pairs = [
    ['text', 'background'],
    ['textMuted', 'background'],
    ['text', 'surface'],
    ['onPrimary', 'primary'],
  ] as const

  for (const scheme of ['light', 'dark'] as const) {
    for (const [foreground, background] of pairs) {
      it(`${scheme}: ${foreground} sobre ${background} cumple AA`, () => {
        const ratio = contrastRatio(colors[scheme][foreground], colors[scheme][background])
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('área táctil', () => {
  it('respeta el mínimo de 44 pt', () => {
    expect(minTouchTarget).toBeGreaterThanOrEqual(44)
  })
})
