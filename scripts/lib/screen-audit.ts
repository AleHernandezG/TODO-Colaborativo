export type Bounds = { left: number; top: number; right: number; bottom: number }

export type UiNode = {
  text: string
  contentDesc: string
  className: string
  packageName: string
  clickable: boolean
  longClickable: boolean
  scrollable: boolean
  enabled: boolean
  bounds: Bounds
  children: UiNode[]
  parent: UiNode | null
}

export type HiddenText = { text: string; bounds: Bounds }

export type ScreenSettings = {
  density: number
  fontScale: number
  screenWidth: number
  screenHeight: number
  appPackage: string
  minTouchDp?: number
  legacyTouchDp?: number
  minGapDp?: number
}

export type TargetSummary = { name: string; bounds: Bounds; widthDp: number; heightDp: number }

export type Finding =
  | ({ kind: 'small-target'; belowLegacy: boolean } & TargetSummary)
  | {
      kind: 'tight-gap'
      first: string
      second: string
      gapDp: number
      axis: 'horizontal' | 'vertical'
    }
  | { kind: 'overlap'; first: string; second: string }
  | { kind: 'unnamed-target'; bounds: Bounds; widthDp: number; heightDp: number }
  | { kind: 'duplicate-label'; name: string; count: number }
  | { kind: 'off-screen'; name: string; bounds: Bounds }
  | {
      kind: 'squashed-text'
      text: string
      bounds: Bounds
      widthPx: number
      minWidthPx: number
      hiddenByDumper: boolean
    }

export type Warning = { kind: 'clipped-target'; name: string; bounds: Bounds }

export type ScreenAudit = {
  settings: Required<ScreenSettings>
  foregroundPackages: string[]
  footerVersion: string | null
  counts: {
    targets: number
    belowMinTouch: number
    belowLegacyTouch: number
    tightGaps: number
    overlaps: number
    unnamedTargets: number
    duplicateLabels: number
    offScreen: number
    squashedTexts: number
  }
  findings: Finding[]
  warnings: Warning[]
}

const TEXT_SCALE_SP = [12, 14, 16, 18, 20, 24, 30, 36]
const SMALLEST_TEXT_SP = TEXT_SCALE_SP[0]
const AVERAGE_CHAR_EM = 0.5
const SQUASHED_CHARS = 2
const FOOTER_VERSION = /^v\d+\.\d+\.\d+ · \S+$/

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10))
    return ENTITIES[entity]
  })
}

function parseBounds(raw: string): Bounds {
  const match = raw.match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/)
  if (!match) throw new Error(`bounds con un formato que no se reconoce: "${raw}"`)
  const [left, top, right, bottom] = match.slice(1).map(Number)
  return { left, top, right, bottom }
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeEntities(match[2])
  }
  return attributes
}

export function parseUiDump(xml: string): UiNode {
  if (!xml.includes('<hierarchy')) {
    throw new Error('El dump no trae <hierarchy>: uiautomator no devolvió ningún árbol')
  }
  const root: UiNode = {
    text: '',
    contentDesc: '',
    className: 'hierarchy',
    packageName: '',
    clickable: false,
    longClickable: false,
    scrollable: false,
    enabled: true,
    bounds: { left: 0, top: 0, right: 0, bottom: 0 },
    children: [],
    parent: null,
  }
  const stack: UiNode[] = [root]
  for (const match of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if (match[0] === '</node>') {
      if (stack.length === 1) throw new Error('El dump cierra un <node> que no se abrió')
      stack.pop()
      continue
    }
    const attributes = readAttributes(match[1])
    const parent = stack[stack.length - 1]
    const node: UiNode = {
      text: attributes.text ?? '',
      contentDesc: attributes['content-desc'] ?? '',
      className: attributes.class ?? '',
      packageName: attributes.package ?? '',
      clickable: attributes.clickable === 'true',
      longClickable: attributes['long-clickable'] === 'true',
      scrollable: attributes.scrollable === 'true',
      enabled: attributes.enabled !== 'false',
      bounds: parseBounds(attributes.bounds ?? '[0,0][0,0]'),
      children: [],
      parent,
    }
    parent.children.push(node)
    if (match[2] !== '/') stack.push(node)
  }
  if (root.children.length === 0) throw new Error('El dump no trae ningún <node>')
  return root
}

export function parseHiddenTexts(log: string): HiddenText[] {
  const hidden: HiddenText[] = []
  for (const line of log.split(/\r?\n/)) {
    if (!line.includes('Skipping invisible child')) continue
    const rect = line.match(/boundsInScreen: Rect\((-?\d+), (-?\d+) - (-?\d+), (-?\d+)\)/)
    const text = line.match(/; text: (.*?); error:/)?.[1]
    const description = line.match(/; contentDescription: (.*?); tooltipText:/)?.[1]
    const label = [text, description].find((value) => value && value !== 'null')
    if (!rect || !label) continue
    const [left, top, right, bottom] = rect.slice(1).map(Number)
    hidden.push({ text: label, bounds: { left, top, right, bottom } })
  }
  return hidden
}

function walk(node: UiNode, visit: (node: UiNode) => void): void {
  visit(node)
  for (const child of node.children) walk(child, visit)
}

function width(bounds: Bounds): number {
  return bounds.right - bounds.left
}

function height(bounds: Bounds): number {
  return bounds.bottom - bounds.top
}

function graphemeCount(text: string): number {
  return [...text.replace(/[️‍]/g, '')].length
}

function isTarget(node: UiNode): boolean {
  return node.clickable || node.longClickable
}

function ownLabel(node: UiNode): string {
  return (node.contentDesc || node.text).trim()
}

function accessibleName(node: UiNode): string {
  const own = ownLabel(node)
  if (own) return own
  const parts: string[] = []
  for (const child of node.children) {
    walk(child, (descendant) => {
      const label = ownLabel(descendant)
      if (label) parts.push(label)
    })
  }
  return parts.join(' ').trim()
}

function isAncestor(candidate: UiNode, node: UiNode): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (current === candidate) return true
  }
  return false
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  )
}

function viewportEdges(node: UiNode, settings: Required<ScreenSettings>): Bounds[] {
  const edges: Bounds[] = [
    { left: 0, top: 0, right: settings.screenWidth, bottom: settings.screenHeight },
  ]
  for (let current = node.parent; current; current = current.parent) {
    if (current.scrollable) edges.push(current.bounds)
  }
  return edges
}

function touchesViewport(
  node: UiNode,
  settings: Required<ScreenSettings>,
  axis: 'horizontal' | 'vertical',
): boolean {
  return viewportEdges(node, settings).some((edge) =>
    axis === 'horizontal'
      ? node.bounds.left <= edge.left || node.bounds.right >= edge.right
      : node.bounds.top <= edge.top || node.bounds.bottom >= edge.bottom,
  )
}

function gapBetween(
  first: Bounds,
  second: Bounds,
): { axis: 'horizontal' | 'vertical'; gap: number } | null {
  const shareRows = first.top < second.bottom && second.top < first.bottom
  const shareColumns = first.left < second.right && second.left < first.right
  if (shareRows && shareColumns) return null
  if (shareRows) {
    return {
      axis: 'horizontal',
      gap: Math.max(second.left - first.right, first.left - second.right),
    }
  }
  if (shareColumns) {
    return { axis: 'vertical', gap: Math.max(second.top - first.bottom, first.top - second.bottom) }
  }
  return null
}

function overlaps(first: Bounds, second: Bounds): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  )
}

function withDefaults(settings: ScreenSettings): Required<ScreenSettings> {
  if (!(settings.density > 0)) throw new Error(`densidad no válida: ${settings.density}`)
  if (!(settings.fontScale > 0)) throw new Error(`font_scale no válido: ${settings.fontScale}`)
  return { minTouchDp: 48, legacyTouchDp: 44, minGapDp: 8, ...settings }
}

export function auditScreen(
  root: UiNode,
  screenSettings: ScreenSettings,
  hiddenTexts: HiddenText[] = [],
): ScreenAudit {
  const settings = withDefaults(screenSettings)
  const pxPerDp = settings.density / 160
  const toDp = (px: number) => Math.round((px / pxPerDp) * 10) / 10
  const smallestTextPx = SMALLEST_TEXT_SP * pxPerDp * settings.fontScale
  const squashedBelowPx = Math.round(SQUASHED_CHARS * AVERAGE_CHAR_EM * smallestTextPx)

  const foregroundPackages = new Set<string>()
  const appNodes: UiNode[] = []
  walk(root, (node) => {
    if (node === root) return
    if (node.packageName) foregroundPackages.add(node.packageName)
    if (node.packageName === settings.appPackage) appNodes.push(node)
  })

  const findings: Finding[] = []
  const warnings: Warning[] = []
  const targets = appNodes.filter(isTarget)
  let belowMinTouch = 0
  let belowLegacyTouch = 0

  for (const target of targets) {
    const name = accessibleName(target)
    const widthDp = toDp(width(target.bounds))
    const heightDp = toDp(height(target.bounds))
    if (!name) {
      findings.push({ kind: 'unnamed-target', bounds: target.bounds, widthDp, heightDp })
    }
    if (target.bounds.left < 0 || target.bounds.right > settings.screenWidth) {
      findings.push({ kind: 'off-screen', name, bounds: target.bounds })
    }
    const tooSmall = Math.min(widthDp, heightDp) < settings.minTouchDp
    if (!tooSmall) continue
    const clipped =
      (widthDp < settings.minTouchDp && touchesViewport(target, settings, 'horizontal')) ||
      (heightDp < settings.minTouchDp && touchesViewport(target, settings, 'vertical'))
    if (clipped) {
      warnings.push({ kind: 'clipped-target', name, bounds: target.bounds })
      continue
    }
    const belowLegacy = Math.min(widthDp, heightDp) < settings.legacyTouchDp
    belowMinTouch += 1
    if (belowLegacy) belowLegacyTouch += 1
    findings.push({
      kind: 'small-target',
      name,
      bounds: target.bounds,
      widthDp,
      heightDp,
      belowLegacy,
    })
  }

  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const first = targets[i]
      const second = targets[j]
      if (isAncestor(first, second) || isAncestor(second, first)) continue
      if (contains(first.bounds, second.bounds) || contains(second.bounds, first.bounds)) continue
      if (overlaps(first.bounds, second.bounds)) {
        findings.push({
          kind: 'overlap',
          first: accessibleName(first),
          second: accessibleName(second),
        })
        continue
      }
      const gap = gapBetween(first.bounds, second.bounds)
      if (!gap) continue
      const gapDp = toDp(gap.gap)
      if (gapDp < settings.minGapDp) {
        findings.push({
          kind: 'tight-gap',
          first: accessibleName(first),
          second: accessibleName(second),
          gapDp,
          axis: gap.axis,
        })
      }
    }
  }

  const namesSeen = new Map<string, number>()
  for (const target of targets) {
    const name = accessibleName(target)
    if (name) namesSeen.set(name, (namesSeen.get(name) ?? 0) + 1)
  }
  for (const [name, count] of namesSeen) {
    if (count > 1) findings.push({ kind: 'duplicate-label', name, count })
  }

  for (const node of appNodes) {
    const label = ownLabel(node)
    if (graphemeCount(label) < SQUASHED_CHARS) continue
    const nodeWidth = width(node.bounds)
    if (height(node.bounds) <= 0 || nodeWidth >= squashedBelowPx) continue
    if (touchesViewport(node, settings, 'horizontal')) continue
    findings.push({
      kind: 'squashed-text',
      text: label,
      bounds: node.bounds,
      widthPx: nodeWidth,
      minWidthPx: squashedBelowPx,
      hiddenByDumper: false,
    })
  }

  for (const hidden of hiddenTexts) {
    if (width(hidden.bounds) > 0 || height(hidden.bounds) <= 0) continue
    if (graphemeCount(hidden.text) < SQUASHED_CHARS) continue
    findings.push({
      kind: 'squashed-text',
      text: hidden.text,
      bounds: hidden.bounds,
      widthPx: 0,
      minWidthPx: squashedBelowPx,
      hiddenByDumper: true,
    })
  }

  const footer = appNodes.map(ownLabel).find((label) => FOOTER_VERSION.test(label)) ?? null

  const count = (kind: Finding['kind']) =>
    findings.filter((finding) => finding.kind === kind).length
  return {
    settings,
    foregroundPackages: [...foregroundPackages],
    footerVersion: footer,
    counts: {
      targets: targets.length,
      belowMinTouch,
      belowLegacyTouch,
      tightGaps: count('tight-gap'),
      overlaps: count('overlap'),
      unnamedTargets: count('unnamed-target'),
      duplicateLabels: count('duplicate-label'),
      offScreen: count('off-screen'),
      squashedTexts: count('squashed-text'),
    },
    findings,
    warnings,
  }
}

function formatBounds(bounds: Bounds): string {
  return `[${bounds.left},${bounds.top}][${bounds.right},${bounds.bottom}]`
}

function describeFinding(finding: Finding, settings: Required<ScreenSettings>): string {
  switch (finding.kind) {
    case 'small-target':
      return `pulsable pequeño: «${finding.name || 'sin nombre'}» ${finding.widthDp} × ${finding.heightDp} dp${finding.belowLegacy ? `, también por debajo de ${settings.legacyTouchDp}` : ''} ${formatBounds(finding.bounds)}`
    case 'tight-gap':
      return `separación de ${finding.gapDp} dp (${finding.axis === 'horizontal' ? 'en horizontal' : 'en vertical'}) entre «${finding.first}» y «${finding.second}»`
    case 'overlap':
      return `se pisan «${finding.first}» y «${finding.second}»`
    case 'unnamed-target':
      return `pulsable sin nombre para TalkBack, ${finding.widthDp} × ${finding.heightDp} dp ${formatBounds(finding.bounds)}`
    case 'duplicate-label':
      return `${finding.count} pulsables con la misma etiqueta: «${finding.name}»`
    case 'off-screen':
      return `se sale de la pantalla: «${finding.name}» ${formatBounds(finding.bounds)}`
    case 'squashed-text':
      return `texto aplastado: «${finding.text}» con ${finding.widthPx} px de ancho (mínimo ${finding.minWidthPx})${finding.hiddenByDumper ? ', uiautomator lo deja fuera del XML' : ''} ${formatBounds(finding.bounds)}`
  }
}

function describeWarning(warning: Warning): string {
  return `pulsable recortado por el borde o el scroll, sin medir: «${warning.name}» ${formatBounds(warning.bounds)}`
}

export function formatAudit(audit: ScreenAudit): string {
  const { settings, counts } = audit
  const lines = [
    `${settings.density} dpi, letra ${settings.fontScale}, ${settings.screenWidth}×${settings.screenHeight}${audit.footerVersion ? `, pie ${audit.footerVersion}` : ''}`,
    `pulsables: ${counts.targets}; < ${settings.minTouchDp} dp: ${counts.belowMinTouch}; < ${settings.legacyTouchDp} dp: ${counts.belowLegacyTouch}; separación < ${settings.minGapDp} dp: ${counts.tightGaps}; se pisan: ${counts.overlaps}`,
    `sin nombre: ${counts.unnamedTargets}; etiquetas repetidas: ${counts.duplicateLabels}; fuera de pantalla: ${counts.offScreen}; textos aplastados: ${counts.squashedTexts}`,
  ]
  if (audit.findings.length > 0) {
    lines.push('', 'Marcas:')
    for (const finding of audit.findings) lines.push(`  - ${describeFinding(finding, settings)}`)
  }
  if (audit.warnings.length > 0) {
    lines.push('', 'Avisos (mirar en la captura):')
    for (const warning of audit.warnings) lines.push(`  - ${describeWarning(warning)}`)
  }
  if (audit.findings.length === 0) lines.push('', 'Sin marcas.')
  return lines.join('\n')
}
