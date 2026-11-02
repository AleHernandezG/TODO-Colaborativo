import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import exceptions from './design-rules-exceptions.json'

type Rule =
  | 'numeric-style'
  | 'raw-color'
  | 'unknown-color-class'
  | 'missing-dark-variant'
  | 'off-token-radius'
  | 'arbitrary-value'
  | 'font-scaling-off'

interface Violation {
  file: string
  rule: Rule
  line: number
  match: string
}

interface DesignRuleException {
  file: string
  rule: Rule
  lines: number
  reason: string
}

const projectDir = join(__dirname, '..', '..', '..', '..')
const featuresDir = join(projectDir, 'src', 'features')

const NUMERIC_STYLE =
  /\b(fontSize|(?:row|column)?[gG]ap|border(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius|(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?)\s*:\s*(-?\d+(?:\.\d+)?)\b/g
const RAW_COLOR =
  /(['"`])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1|\b(?:rgba?|hsla?)\s*\(/g
const FONT_SCALING_OFF = /allowFontScaling\s*(?:=\s*\{\s*false\s*\}|:\s*false)/g
const RADIUS_UTILITY = /^rounded(?:-([trblse]{1,2}))?(?:-([a-z0-9]+))?$/
const ARBITRARY_UTILITY = /^[a-z][a-z0-9-]*-\[[^\]]+\]$/
const TOKEN_RADII = new Set(['none', 'sm', 'md', 'lg', 'full'])
const STRING_LITERAL = /'[^'\n]*'|"[^"\n]*"|`[^`]*`/g
const CLASS_TOKEN = /[^\s'"`{}()?,]+/g
const COLOR_UTILITY = /^(text|bg|border|divide|ring|placeholder)-(.+)$/
const NON_COLOR_SUFFIX: Record<string, RegExp> = {
  text: /^(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|ellipsis|clip)$/,
  bg: /^(none|opacity-\d+)$/,
  border: /^(\d+|[trblxyse](-\d+)?|solid|dashed|dotted|double|none|opacity-\d+)$/,
  divide: /^(\d+|[xy](-\d+)?|solid|dashed|dotted|double|none|opacity-\d+)$/,
  ring: /^(\d+|inset|offset-\d+|opacity-\d+)$/,
  placeholder: /^opacity-\d+$/,
}

function scannedRoots(): string[] {
  const presentations = readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(featuresDir, entry.name, 'presentation'))
    .filter((dir) => existsSync(dir))
  return [join(projectDir, 'src', 'app'), ...presentations]
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function tokenColors(): Set<string> {
  const config = jest.requireActual<{
    theme: { extend: { colors: Record<string, Record<string, string>> } }
  }>(join(projectDir, 'tailwind.config.js'))
  const names = Object.entries(config.theme.extend.colors).flatMap(([name, shades]) =>
    Object.keys(shades).map((shade) => (shade === 'DEFAULT' ? name : `${name}-${shade}`)),
  )
  return new Set([...names, 'transparent'])
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function findNumericStyles(file: string, source: string): Violation[] {
  return [...source.matchAll(NUMERIC_STYLE)]
    .filter((match) => Number(match[2]) !== 0)
    .map((match) => ({
      file,
      rule: 'numeric-style' as const,
      line: lineAt(source, match.index),
      match: match[0],
    }))
}

function findRawColors(file: string, source: string): Violation[] {
  return [...source.matchAll(RAW_COLOR)].map((match) => ({
    file,
    rule: 'raw-color' as const,
    line: lineAt(source, match.index),
    match: match[0],
  }))
}

function findFontScalingOff(file: string, source: string): Violation[] {
  return [...source.matchAll(FONT_SCALING_OFF)].map((match) => ({
    file,
    rule: 'font-scaling-off' as const,
    line: lineAt(source, match.index),
    match: match[0],
  }))
}

function splitVariants(token: string): { variants: string[]; utility: string } {
  const parts = token.replace(/^!/, '').split(':')
  return { variants: parts.slice(0, -1), utility: parts[parts.length - 1].replace(/^!/, '') }
}

function colorOf(utility: string): string | null {
  const match = COLOR_UTILITY.exec(utility)
  if (!match) return null
  const [, family, suffix] = match
  if (NON_COLOR_SUFFIX[family].test(suffix)) return null
  const withoutSide = family === 'border' ? suffix.replace(/^[trblxyse]-/, '') : suffix
  return withoutSide.replace(/\/\d+$/, '')
}

function findClassViolations(file: string, source: string, colors: Set<string>): Violation[] {
  return [...source.matchAll(STRING_LITERAL)].flatMap((literal) => {
    const tokens = [...literal[0].matchAll(CLASS_TOKEN)].map((token) => ({
      ...splitVariants(token[0]),
      raw: token[0],
      line: lineAt(source, literal.index + token.index),
    }))
    const darkUtilities = new Set(
      tokens
        .filter((token) => token.variants.includes('dark'))
        .map((token) => token.utility.replace(/\/\d+$/, '')),
    )

    return tokens.flatMap((token): Violation[] => {
      const found = (rule: Rule): Violation[] => [
        { file, rule, line: token.line, match: token.raw },
      ]
      if (ARBITRARY_UTILITY.test(token.utility)) return found('arbitrary-value')
      const radius = RADIUS_UTILITY.exec(token.utility)
      if (radius) return TOKEN_RADII.has(radius[2] ?? '') ? [] : found('off-token-radius')
      const color = colorOf(token.utility)
      if (color === null) return []
      if (!colors.has(color)) return found('unknown-color-class')
      const needsDarkPair =
        color !== 'transparent' && !color.endsWith('-dark') && !token.variants.includes('dark')
      const darkPair = `${token.utility.replace(/\/\d+$/, '')}-dark`
      if (needsDarkPair && !darkUtilities.has(darkPair)) return found('missing-dark-variant')
      return []
    })
  })
}

function findViolations(): Violation[] {
  const colors = tokenColors()
  return scannedRoots()
    .flatMap(sourceFiles)
    .flatMap((path) => {
      const file = relative(projectDir, path).split('\\').join('/')
      const source = readFileSync(path, 'utf8')
      return [
        ...findNumericStyles(file, source),
        ...findRawColors(file, source),
        ...findFontScalingOff(file, source),
        ...findClassViolations(file, source, colors),
      ]
    })
}

function countLines(violations: Violation[]): Map<string, number> {
  const lines = new Map<string, Set<number>>()
  for (const violation of violations) {
    const key = `${violation.file} · ${violation.rule}`
    lines.set(key, (lines.get(key) ?? new Set()).add(violation.line))
  }
  return new Map([...lines].map(([key, set]) => [key, set.size]))
}

function compareWithExceptions(
  found: Map<string, number>,
  allowed: DesignRuleException[],
  violations: Violation[],
): string[] {
  const allowedByKey = new Map(allowed.map((entry) => [`${entry.file} · ${entry.rule}`, entry]))
  const problems: string[] = []
  for (const [key, lines] of found) {
    const entry = allowedByKey.get(key)
    if (!entry) {
      const where = violations
        .filter((violation) => `${violation.file} · ${violation.rule}` === key)
        .map((violation) => `  línea ${violation.line}: ${violation.match}`)
      problems.push(`${key}: ${lines} línea(s) nueva(s)\n${where.join('\n')}`)
    } else if (lines > entry.lines) {
      problems.push(`${key}: ${lines} líneas y la lista admite ${entry.lines}. No se suben`)
    } else if (lines < entry.lines) {
      problems.push(`${key}: quedan ${lines} líneas. Baja la lista de ${entry.lines} a ${lines}`)
    }
  }
  for (const [key] of allowedByKey) {
    if (!found.has(key)) problems.push(`${key}: ya no queda ninguna. Quítala de la lista`)
  }
  return problems.sort()
}

describe('reglas de diseño', () => {
  const allowed = exceptions as DesignRuleException[]
  const violations = findViolations()

  it('keeps style values inside the tokens, or in the exception list going down', () => {
    expect(compareWithExceptions(countLines(violations), allowed, violations)).toEqual([])
  })

  it('keeps one exception per file and rule', () => {
    const keys = allowed.map((entry) => `${entry.file} · ${entry.rule}`)
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([])
  })

  it('gives every exception a reason', () => {
    const withoutReason = allowed.filter((entry) => entry.reason.trim().length < 10)
    expect(withoutReason).toEqual([])
  })

  it('scans every screen of the app', () => {
    expect(scannedRoots().flatMap(sourceFiles).length).toBeGreaterThan(30)
  })
})
