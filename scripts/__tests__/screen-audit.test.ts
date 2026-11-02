import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  auditScreen,
  type Finding,
  formatAudit,
  parseHiddenTexts,
  parseUiDump,
  type ScreenSettings,
} from '../lib/screen-audit'

const fixturesDir = join(__dirname, '..', '__fixtures__')
const poco: ScreenSettings = {
  density: 440,
  fontScale: 1.15,
  screenWidth: 1080,
  screenHeight: 2400,
  appPackage: 'com.alejandrohernandez.listacompra',
}

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8')
}

function node(attributes: Record<string, string>, children = ''): string {
  const merged = {
    text: '',
    'content-desc': '',
    class: 'android.view.ViewGroup',
    package: poco.appPackage,
    clickable: 'false',
    'long-clickable': 'false',
    scrollable: 'false',
    enabled: 'true',
    ...attributes,
  }
  const serialized = Object.entries(merged)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
  return children ? `<node ${serialized}>${children}</node>` : `<node ${serialized} />`
}

function screen(children: string): string {
  return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${node(
    { bounds: '[0,0][1080,2400]' },
    children,
  )}</hierarchy>`
}

function findingsOf<K extends Finding['kind']>(findings: Finding[], kind: K) {
  return findings.filter(
    (finding): finding is Extract<Finding, { kind: K }> => finding.kind === kind,
  )
}

describe('auditScreen con la cabecera de la lista del POCO, letra al 115 %', () => {
  const audit = auditScreen(
    parseUiDump(fixture('list-header-font-115.xml')),
    poco,
    parseHiddenTexts(fixture('list-header-font-115.log')),
  )

  it('marks the list title button as squashed at 19 px', () => {
    const squashed = findingsOf(audit.findings, 'squashed-text')
    expect(squashed).toContainEqual(
      expect.objectContaining({ text: 'Lista E2E PIN', widthPx: 19, hiddenByDumper: false }),
    )
  })

  it('reports the texts that uiautomator leaves out of the XML for having no width', () => {
    const hidden = findingsOf(audit.findings, 'squashed-text').filter(
      (finding) => finding.hiddenByDumper,
    )
    expect(hidden.map((finding) => finding.text).sort()).toEqual([
      'E2E PIN',
      'Estás dentro como Ana',
    ])
  })

  it('counts the five header buttons at 44 dp as below 48 and not below 44', () => {
    const small = findingsOf(audit.findings, 'small-target')
    const header = small.filter((finding) => finding.name !== 'Lista E2E PIN')
    expect(header.map((finding) => finding.name)).toEqual([
      '🛒 Modo Compra',
      'Menú',
      'Recetas',
      'PDF',
      'Gastos',
    ])
    expect(header.every((finding) => finding.heightDp === 44 && !finding.belowLegacy)).toBe(true)
    expect(audit.counts.belowMinTouch).toBe(6)
    expect(audit.counts.belowLegacyTouch).toBe(1)
  })

  it('flags the 19 px between header buttons as less than 8 dp apart', () => {
    const gaps = findingsOf(audit.findings, 'tight-gap')
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps.every((gap) => gap.gapDp === 6.9)).toBe(true)
  })

  it('does not measure a button cut by the bottom of the scroll', () => {
    expect(audit.warnings).toContainEqual(
      expect.objectContaining({ kind: 'clipped-target', name: 'Añadir a la lista' }),
    )
    const names = findingsOf(audit.findings, 'small-target').map((finding) => finding.name)
    expect(names).not.toContain('Añadir a la lista')
  })

  it('decodes entities so the emoji reaches the report', () => {
    expect(formatAudit(audit)).toContain('«🛒 Modo Compra»')
  })
})

describe('auditScreen con árboles hechos a mano', () => {
  it('flags repeated labels like the three «Hacer admin» in Miembros', () => {
    const xml = screen(
      [0, 1, 2]
        .map((row) =>
          node({
            clickable: 'true',
            'content-desc': 'Hacer admin',
            bounds: `[600,${400 + row * 200}][900,${532 + row * 200}]`,
          }),
        )
        .join(''),
    )
    const audit = auditScreen(parseUiDump(xml), poco)
    expect(findingsOf(audit.findings, 'duplicate-label')).toEqual([
      { kind: 'duplicate-label', name: 'Hacer admin', count: 3 },
    ])
  })

  it('flags 9 px between «Hacer admin» and «Eliminar», about 3 dp on the POCO', () => {
    const xml = screen(
      node({ clickable: 'true', 'content-desc': 'Hacer admin Bea', bounds: '[400,400][700,532]' }) +
        node({ clickable: 'true', 'content-desc': 'Eliminar Bea', bounds: '[709,400][1000,532]' }),
    )
    const gaps = findingsOf(auditScreen(parseUiDump(xml), poco).findings, 'tight-gap')
    expect(gaps).toEqual([
      expect.objectContaining({ first: 'Hacer admin Bea', second: 'Eliminar Bea', gapDp: 3.3 }),
    ])
  })

  it('names a target by its descendants, as TalkBack does', () => {
    const xml = screen(
      node(
        { clickable: 'true', bounds: '[66,400][1014,560]' },
        node({ class: 'android.widget.TextView', text: 'Leche', bounds: '[100,440][300,500]' }),
      ) + node({ clickable: 'true', bounds: '[66,700][200,834]' }),
    )
    const audit = auditScreen(parseUiDump(xml), poco)
    expect(findingsOf(audit.findings, 'unnamed-target')).toEqual([
      expect.objectContaining({ bounds: { left: 66, top: 700, right: 200, bottom: 834 } }),
    ])
  })

  it('flags targets that overlap and ignores one nested inside another', () => {
    const xml = screen(
      node(
        { clickable: 'true', 'content-desc': 'Fila', bounds: '[0,400][1080,600]' },
        node({ clickable: 'true', 'content-desc': 'Marcar', bounds: '[40,420][200,580]' }),
      ) +
        node({ clickable: 'true', 'content-desc': 'Uno', bounds: '[100,800][400,1000]' }) +
        node({ clickable: 'true', 'content-desc': 'Dos', bounds: '[300,900][600,1100]' }),
    )
    const overlaps = findingsOf(auditScreen(parseUiDump(xml), poco).findings, 'overlap')
    expect(overlaps).toEqual([{ kind: 'overlap', first: 'Uno', second: 'Dos' }])
  })

  it('flags a target that leaves the screen sideways', () => {
    const xml = screen(
      node({ clickable: 'true', 'content-desc': 'Borrar', bounds: '[900,400][1200,560]' }),
    )
    const offScreen = findingsOf(auditScreen(parseUiDump(xml), poco).findings, 'off-screen')
    expect(offScreen).toEqual([expect.objectContaining({ name: 'Borrar' })])
  })

  it('reads the version in the footer', () => {
    const xml = screen(
      node({
        class: 'android.widget.TextView',
        text: 'v1.3.1 · 01a19e5d',
        bounds: '[400,2300][680,2340]',
      }),
    )
    expect(auditScreen(parseUiDump(xml), poco).footerVersion).toBe('v1.3.1 · 01a19e5d')
  })

  it('reports the packages in the tree so a system dialog in front can be told apart', () => {
    const xml = `<?xml version='1.0' ?><hierarchy rotation="0">${node({
      package: 'com.android.permissioncontroller',
      bounds: '[0,0][1080,2400]',
    })}</hierarchy>`
    const audit = auditScreen(parseUiDump(xml), poco)
    expect(audit.foregroundPackages).toEqual(['com.android.permissioncontroller'])
    expect(audit.counts.targets).toBe(0)
  })
})

describe('parseUiDump', () => {
  it('rejects an empty dump instead of measuring nothing', () => {
    expect(() => parseUiDump('')).toThrow('uiautomator no devolvió ningún árbol')
    expect(() => parseUiDump('<hierarchy rotation="0"></hierarchy>')).toThrow(
      'no trae ningún <node>',
    )
  })

  it('rejects bounds it cannot read', () => {
    expect(() => parseUiDump(screen(node({ bounds: '[0,0]' })))).toThrow('bounds con un formato')
  })
})

describe('auditScreen settings', () => {
  it('rejects a density of zero', () => {
    const root = parseUiDump(screen(''))
    expect(() => auditScreen(root, { ...poco, density: 0 })).toThrow('densidad no válida')
  })
})
