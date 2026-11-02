import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { auditScreen, formatAudit, parseHiddenTexts, parseUiDump } from './lib/screen-audit.ts'

const APP_PACKAGE = 'com.alejandrohernandez.listacompra'

const usage = `Uso:
  npm run inspect:screen -- [--label <nombre>] [--out <carpeta>] [--json]
  npm run inspect:screen -- --xml <dump.xml> --density <dpi> --font-scale <n> [--log <logcat.txt>] [--size 1080x2400]

Con el móvil: mide la pantalla que esté delante. Con --xml: mide un dump guardado.
--out guarda <label>.xml, .log, .png, .json y .txt en esa carpeta.
Sale con 0 si no hay marcas, 2 si las hay y 1 si no se pudo medir.`

class MeasureError extends Error {}

function findAdb() {
  if (process.env.ADB) return process.env.ADB
  const local = join(
    homedir(),
    'tools',
    'platform-tools',
    process.platform === 'win32' ? 'adb.exe' : 'adb',
  )
  try {
    execFileSync('adb', ['version'], { stdio: 'ignore' })
    return 'adb'
  } catch {
    if (existsSync(local)) return local
  }
  throw new MeasureError(
    'No encuentro adb: ni en $ADB, ni en el PATH, ni en ~/tools/platform-tools. Instálalo con docs/guias/e2e-con-maestro.md',
  )
}

function runAdb(adb, args, options = {}) {
  try {
    return execFileSync(adb, args, {
      encoding: options.binary ? 'buffer' : 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = error.stderr?.toString().trim()
    throw new MeasureError(`adb ${args.join(' ')} falló: ${stderr || error.message}`)
  }
}

function readDeviceValue(output, label) {
  const override = output.match(new RegExp(`Override ${label}: (\\S+)`))
  const physical = output.match(new RegExp(`Physical ${label}: (\\S+)`))
  return (override ?? physical)?.[1]
}

function readDeviceSettings(adb) {
  const state = (() => {
    try {
      return runAdb(adb, ['get-state']).trim()
    } catch (error) {
      return error.message
    }
  })()
  if (state !== 'device') {
    throw new MeasureError(
      `No hay ningún móvil listo para adb (${state}). Conecta el POCO por USB, acepta la depuración y mira «adb devices»`,
    )
  }
  const density = Number(readDeviceValue(runAdb(adb, ['shell', 'wm', 'density']), 'density'))
  const size = readDeviceValue(runAdb(adb, ['shell', 'wm', 'size']), 'size')
  const fontScale = Number(runAdb(adb, ['shell', 'settings', 'get', 'system', 'font_scale']).trim())
  const night = /Night mode: yes/.test(runAdb(adb, ['shell', 'cmd', 'uimode', 'night']))
  const versionName =
    runAdb(adb, ['shell', 'dumpsys', 'package', APP_PACKAGE]).match(/versionName=(\S+)/)?.[1] ??
    null
  const [screenWidth, screenHeight] = (size ?? '').split('x').map(Number)
  if (!density || !screenWidth || !screenHeight) {
    throw new MeasureError(
      `adb no dio la densidad o el tamaño de pantalla (density=${density}, size=${size})`,
    )
  }
  return { density, fontScale: fontScale || 1, night, versionName, screenWidth, screenHeight }
}

function dumpWindow(adb) {
  const since = runAdb(adb, ['shell', 'date "+%m-%d %H:%M:%S.000"']).trim()
  let xml = runAdb(adb, ['exec-out', 'uiautomator', 'dump', '/dev/tty'])
  if (!xml.includes('<hierarchy')) {
    runAdb(adb, ['shell', 'uiautomator', 'dump', '/sdcard/window_dump.xml'])
    xml = runAdb(adb, ['exec-out', 'cat', '/sdcard/window_dump.xml'])
    runAdb(adb, ['shell', 'rm', '-f', '/sdcard/window_dump.xml'])
  }
  const start = xml.indexOf('<?xml')
  const end = xml.lastIndexOf('</hierarchy>')
  if (start === -1 || end === -1) {
    throw new MeasureError(
      'uiautomator no devolvió ningún árbol. Si hay una animación o un diálogo del sistema delante, espera o ciérralo y vuelve a medir',
    )
  }
  const log = runAdb(adb, [
    'logcat',
    '-d',
    '-v',
    'brief',
    '-T',
    since,
    '-s',
    'AccessibilityNodeInfoDumper:I',
  ])
  return { xml: xml.slice(start, end + '</hierarchy>'.length), log }
}

function measureFromDevice() {
  const adb = findAdb()
  const device = readDeviceSettings(adb)
  const { xml, log } = dumpWindow(adb)
  return { adb, device, xml, log }
}

function measureFromFile(values) {
  const xml = readFileSync(resolve(values.xml), 'utf8')
  const log = values.log ? readFileSync(resolve(values.log), 'utf8') : ''
  const [screenWidth, screenHeight] = (values.size ?? '1080x2400').split('x').map(Number)
  const density = Number(values.density)
  if (!density)
    throw new MeasureError('Con --xml hace falta --density (la de «adb shell wm density»)')
  const fontScale = Number(values['font-scale'] ?? 1)
  return {
    adb: null,
    device: { density, fontScale, night: null, versionName: null, screenWidth, screenHeight },
    xml,
    log,
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      label: { type: 'string' },
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
      xml: { type: 'string' },
      log: { type: 'string' },
      density: { type: 'string' },
      'font-scale': { type: 'string' },
      size: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log(usage)
    return 0
  }

  const { adb, device, xml, log } = values.xml ? measureFromFile(values) : measureFromDevice()
  const root = parseUiDump(xml)
  const audit = auditScreen(
    root,
    {
      density: device.density,
      fontScale: device.fontScale,
      screenWidth: device.screenWidth,
      screenHeight: device.screenHeight,
      appPackage: APP_PACKAGE,
    },
    parseHiddenTexts(log),
  )
  if (!audit.foregroundPackages.includes(APP_PACKAGE)) {
    throw new MeasureError(
      `La app no está delante: el árbol es de ${audit.foregroundPackages.join(', ') || 'nadie'}. Si es un diálogo del sistema, apúntalo, ciérralo y vuelve a medir`,
    )
  }
  const otherPackages = audit.foregroundPackages.filter((name) => name !== APP_PACKAGE)
  const report = {
    label: values.label ?? null,
    measuredAt: new Date().toISOString(),
    versionName: device.versionName,
    night: device.night,
    otherWindows: otherPackages,
    ...audit,
  }

  const text = [
    `${report.label ?? 'pantalla'} · ${report.versionName ? `app ${report.versionName}` : 'sin móvil'}${report.night === null ? '' : report.night ? ' · oscuro' : ' · claro'}`,
    otherPackages.length > 0 ? `otras ventanas en el árbol: ${otherPackages.join(', ')}` : null,
    formatAudit(audit),
  ]
    .filter(Boolean)
    .join('\n')

  if (values.out) {
    const label = values.label ?? 'pantalla'
    const outDir = resolve(values.out)
    mkdirSync(outDir, { recursive: true })
    const screenshot = adb ? runAdb(adb, ['exec-out', 'screencap', '-p'], { binary: true }) : null
    writeFileSync(join(outDir, `${label}.xml`), xml)
    if (log) writeFileSync(join(outDir, `${label}.log`), log)
    if (screenshot) writeFileSync(join(outDir, `${label}.png`), screenshot)
    writeFileSync(join(outDir, `${label}.txt`), `${text}\n`)
    writeFileSync(join(outDir, `${label}.json`), `${JSON.stringify(report, null, 2)}\n`)
  }

  console.log(values.json ? JSON.stringify(report, null, 2) : text)
  return audit.findings.length > 0 ? 2 : 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(
    error instanceof MeasureError ? error.message : `No se pudo medir: ${error.message}`,
  )
  process.exitCode = 1
}
