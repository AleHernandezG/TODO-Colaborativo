import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const userAgent =
  'ListaCompraColaborativa/1.2.0 (+https://github.com/AleHernandezG/TODO-Colaborativo; aletrabajosspam@gmail.com)'

const datasetRepo = 'https://huggingface.co/datasets/datania/mercadona-catalog'
const offSearch = 'https://search.openfoodfacts.org/search'
const openPrices = 'https://prices.openfoodfacts.org/api/v1/prices'

const offDelayMs = 2000
const pricesDelayMs = 1000
const maxRetries = 3

const workDir = join(tmpdir(), 'catalog-source-benchmark')
const clonePath = join(workDir, 'mercadona-catalog')
const resultsPath = join(workDir, 'results.json')

const sampleNames = [
  'leche',
  'pan',
  'huevos',
  'aceite de oliva',
  'arroz',
  'pasta',
  'tomate frito',
  'atun',
  'yogur',
  'queso',
  'jamon serrano',
  'pollo',
  'platanos',
  'manzanas',
  'patatas',
  'cebolla',
  'zanahorias',
  'lechuga',
  'cerveza',
  'agua',
  'zumo de naranja',
  'cafe',
  'azucar',
  'sal',
  'harina',
  'mantequilla',
  'galletas',
  'cereales',
  'papel higienico',
  'detergente',
]

const nameKeys = ['display_name', 'name', 'product_name', 'title']
const brandKeys = ['brand', 'brand_name', 'marca']
const barcodeKeys = ['ean', 'barcode', 'code', 'gtin']
const packageKeys = ['packaging', 'package_size', 'format', 'unit_name']

const green = (text) => `\x1b[32m${text}\x1b[0m`
const red = (text) => `\x1b[31m${text}\x1b[0m`
const dim = (text) => `\x1b[2m${text}\x1b[0m`

function parseArgs(argv) {
  const args = { sample: false, limit: 40, source: 'both' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sample') args.sample = true
    else if (argv[i] === '--limit') {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit necesita un entero positivo, recibió "${argv[i + 1]}"`)
      }
      args.limit = value
      i += 1
    } else if (argv[i] === '--source') {
      const value = argv[i + 1]
      if (!['hf', 'off', 'both'].includes(value)) {
        throw new Error(`--source solo acepta hf, off o both. Recibió "${value}"`)
      }
      args.source = value
      i += 1
    } else if (argv[i].startsWith('--')) {
      throw new Error(`Opción desconocida: ${argv[i]}`)
    }
  }
  return args
}

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pick(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return null
}

function toCents(raw) {
  if (raw === null || raw === undefined) return null
  const value = Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

async function readItemNames(limit) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    console.log(dim('Sin EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY. Se usa --sample.'))
    return { names: sampleNames.slice(0, limit), origin: 'sample' }
  }

  const res = await fetch(`${url}/rest/v1/items?select=name`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`No se pudieron leer los artículos (${res.status}): ${detail}`)
  }

  const counts = new Map()
  for (const row of await res.json()) {
    const name = normalize(row.name)
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  if (counts.size === 0) {
    console.log(dim('La tabla items está vacía. Se usa --sample.'))
    return { names: sampleNames.slice(0, limit), origin: 'sample' }
  }

  const names = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)

  return { names, origin: `supabase (${counts.size} nombres distintos)` }
}

function cloneDataset() {
  mkdirSync(workDir, { recursive: true })
  if (existsSync(clonePath)) {
    console.log(dim(`Reutilizando el clon de ${clonePath}`))
  } else {
    console.log(`Clonando ${datasetRepo} …`)
    execFileSync('git', ['clone', '--depth', '1', datasetRepo, clonePath], { stdio: 'inherit' })
  }
  const clonedAt = execFileSync('git', ['-C', clonePath, 'log', '-1', '--format=%cI'], {
    encoding: 'utf8',
  }).trim()
  return clonedAt
}

function loadDatasetProducts() {
  const productsDir = join(clonePath, 'products')
  if (!existsSync(productsDir)) {
    throw new Error(`El clon no tiene carpeta products/. Mira qué hay en ${clonePath}`)
  }

  const files = readdirSync(productsDir, { recursive: true }).filter((file) =>
    String(file).endsWith('.json'),
  )
  if (files.length === 0) throw new Error(`No hay ficheros .json en ${productsDir}`)

  const first = JSON.parse(readFileSync(join(productsDir, String(files[0])), 'utf8'))
  console.log(dim(`Claves del primer producto: ${Object.keys(first).join(', ')}`))

  const products = []
  for (const file of files) {
    let raw
    try {
      raw = JSON.parse(readFileSync(join(productsDir, String(file)), 'utf8'))
    } catch {
      continue
    }
    const name = pick(raw, nameKeys)
    if (!name) continue
    const priceCents = datasetPrice(raw)
    products.push({
      name,
      normalizedName: normalize(name),
      brand: pick(raw, brandKeys),
      packageSize: pick(raw, packageKeys),
      barcode: pick(raw, barcodeKeys),
      imageUrl: datasetImage(raw),
      priceCents,
      hasPrice: priceCents !== null,
    })
  }

  if (products.length === 0) {
    throw new Error(
      `Se leyeron ${files.length} ficheros pero ninguno tenía nombre en ${nameKeys.join('/')}. ` +
        'Revisa las claves que se han impreso arriba y ajusta nameKeys.',
    )
  }
  return products
}

function datasetImage(raw) {
  const direct = pick(raw, ['thumbnail', 'image_url', 'image'])
  if (direct) return direct
  const photo = Array.isArray(raw?.photos) ? raw.photos[0] : null
  return pick(photo, ['regular', 'zoom', 'thumbnail', 'perspective'])
}

function datasetPrice(raw) {
  const nested = raw?.price_instructions
  const value =
    pick(nested, ['unit_price', 'bulk_price', 'reference_price']) ??
    pick(raw, ['unit_price', 'price'])
  return toCents(value)
}

function classify(query, candidates) {
  const strict = candidates.find((product) => product.normalizedName.startsWith(query)) ?? null
  const loose = candidates.find((product) => product.normalizedName.includes(query)) ?? null
  return { strict, loose, best: strict ?? loose }
}

function emptyTally(label) {
  return {
    label,
    measured: 0,
    strict: 0,
    loose: 0,
    withImage: 0,
    withPrice: 0,
    missing: [],
    failed: [],
  }
}

function record(tally, query, match) {
  tally.measured += 1
  if (match.strict) tally.strict += 1
  if (match.loose) tally.loose += 1
  if (!match.best) {
    tally.missing.push(query)
    return
  }
  if (match.best.imageUrl) tally.withImage += 1
  if (match.best.hasPrice) tally.withPrice += 1
}

async function benchmarkDataset(names) {
  const clonedAt = cloneDataset()
  const products = loadDatasetProducts()
  console.log(dim(`${products.length} productos indexados en memoria`))

  const tally = emptyTally(`Mercadona (Hugging Face, último commit del clon ${clonedAt})`)
  for (const query of names) {
    const candidates = products.filter((product) => product.normalizedName.includes(query))
    record(tally, query, classify(query, candidates))
  }
  return tally
}

async function fetchWithRetry(url, label) {
  let lastStatus = 0
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } })
    if (res.ok) return res
    lastStatus = res.status
    if (res.status < 500) break
    await sleep(offDelayMs * attempt)
  }
  throw new Error(`${label} contestó ${lastStatus} tras ${maxRetries} intentos`)
}

async function searchOpenFoodFacts(query) {
  const params = new URLSearchParams({
    q: `${query} AND countries_tags:"en:spain"`,
    page_size: '20',
    fields: 'code,product_name,brands,quantity,image_url',
  })
  const res = await fetchWithRetry(`${offSearch}?${params}`, `Open Food Facts para "${query}"`)
  const body = await res.json()
  return (body.hits ?? [])
    .filter((product) => product.product_name)
    .map((product) => ({
      name: product.product_name,
      normalizedName: normalize(product.product_name),
      brand: Array.isArray(product.brands) ? product.brands.join(', ') : (product.brands ?? null),
      packageSize: product.quantity ?? null,
      barcode: product.code ?? null,
      imageUrl: product.image_url ?? null,
      priceCents: null,
      hasPrice: false,
    }))
}

async function hasKnownPrice(barcode) {
  if (!barcode) return false
  const res = await fetch(`${openPrices}?product_code=${encodeURIComponent(barcode)}&size=1`, {
    headers: { 'User-Agent': userAgent },
  })
  if (!res.ok) return false
  const body = await res.json()
  return (body.total ?? 0) > 0
}

async function benchmarkOpenFoodFacts(names) {
  const tally = emptyTally('Open Food Facts + Open Prices')
  for (const [index, query] of names.entries()) {
    process.stdout.write(dim(`  [${index + 1}/${names.length}] ${query} … `))
    let candidates = []
    try {
      candidates = await searchOpenFoodFacts(query)
    } catch (error) {
      console.log(red(error.message))
      tally.failed.push(query)
      await sleep(offDelayMs)
      continue
    }

    const match = classify(query, candidates)
    if (match.best) {
      await sleep(pricesDelayMs)
      match.best.hasPrice = await hasKnownPrice(match.best.barcode)
      console.log(green(match.best.name))
    } else {
      console.log(red('sin coincidencia'))
    }
    record(tally, query, match)

    if (index < names.length - 1) await sleep(offDelayMs)
  }
  return tally
}

function percent(part, total) {
  if (total === 0) return '  0%'
  return `${String(Math.round((part / total) * 100)).padStart(3, ' ')}%`
}

function printTally(tally) {
  const found = tally.measured - tally.missing.length
  console.log(`\nFuente: ${tally.label}`)
  console.log(`  Artículos medidos          ${String(tally.measured).padStart(3, ' ')}`)
  console.log(
    `  Encontrados (estricto)     ${String(tally.strict).padStart(3, ' ')}   ${percent(tally.strict, tally.measured)}`,
  )
  console.log(
    `  Encontrados (flexible)     ${String(tally.loose).padStart(3, ' ')}   ${percent(tally.loose, tally.measured)}`,
  )
  console.log('  De los encontrados:')
  console.log(
    `    con imagen               ${String(tally.withImage).padStart(3, ' ')}   ${percent(tally.withImage, found)}`,
  )
  console.log(
    `    con precio               ${String(tally.withPrice).padStart(3, ' ')}   ${percent(tally.withPrice, found)}`,
  )
  if (tally.missing.length > 0) {
    console.log(`\n  Sin coincidencia: ${tally.missing.join(', ')}`)
  }
  if (tally.failed.length > 0) {
    console.log(
      red(
        `\n  ${tally.failed.length} consultas fallaron y quedan fuera del recuento: ${tally.failed.join(', ')}`,
      ),
    )
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const { names, origin } = args.sample
    ? { names: sampleNames.slice(0, args.limit), origin: 'sample (forzado con --sample)' }
    : await readItemNames(args.limit)

  console.log(`Muestra: ${names.length} artículos, de ${origin}`)
  console.log(dim(`User-Agent: ${userAgent}\n`))

  const tallies = []
  if (args.source !== 'off') tallies.push(await benchmarkDataset(names))
  if (args.source !== 'hf') {
    const seconds = Math.ceil((names.length * (offDelayMs + pricesDelayMs)) / 1000)
    console.log(`\nConsultando Open Food Facts, con ${offDelayMs / 1000} s entre consultas.`)
    console.log(`Unos ${seconds} segundos. Con --limit lo acortas.\n`)
    tallies.push(await benchmarkOpenFoodFacts(names))
  }

  for (const tally of tallies) printTally(tally)

  mkdirSync(workDir, { recursive: true })
  writeFileSync(resultsPath, JSON.stringify({ names, tallies }, null, 2))
  console.log(dim(`\nNúmeros crudos en ${resultsPath}`))
  console.log(dim('Ese fichero y el clon se quedan fuera del repo a propósito.'))
}

main().catch((error) => {
  console.error(red(error.message))
  process.exit(1)
})
