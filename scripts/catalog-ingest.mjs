import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { normalizeCatalogName } from '../src/features/catalog/domain/normalized-name.ts'

const supermarketId = 'mercadona'
const datasetRepo = 'https://huggingface.co/datasets/datania/mercadona-catalog'
const nameMaxLength = 200
const chunkSize = 500

const workDir = join(tmpdir(), 'catalog-ingest')
const clonePath = join(workDir, 'mercadona-catalog')

const green = (text) => `\x1b[32m${text}\x1b[0m`
const red = (text) => `\x1b[31m${text}\x1b[0m`
const dim = (text) => `\x1b[2m${text}\x1b[0m`

function parseArgs(argv) {
  const args = { dryRun: false, fresh: false, limit: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true
    else if (argv[i] === '--fresh') args.fresh = true
    else if (argv[i] === '--limit') {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit necesita un entero positivo, recibió "${argv[i + 1]}"`)
      }
      args.limit = value
      i += 1
    } else if (argv[i].startsWith('--')) {
      throw new Error(`Opción desconocida: ${argv[i]}`)
    }
  }
  return args
}

function requireEnv(dryRun) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (dryRun) return { url, secretKey }

  if (!url || !secretKey) {
    console.error(red('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.'))
    console.error('Ejecuta:  npm run catalog:ingest')
    console.error('catalog_products no tiene política de escritura: solo entra con la secret key.')
    console.error('Para ver qué haría sin escribir nada:  npm run catalog:ingest -- --dry-run')
    process.exit(1)
  }
  return { url, secretKey }
}

function cloneDataset(fresh) {
  mkdirSync(workDir, { recursive: true })
  if (fresh && existsSync(clonePath)) {
    console.log(dim('Borrando el clon anterior por --fresh'))
    rmSync(clonePath, { recursive: true, force: true })
  }
  if (existsSync(clonePath)) {
    console.log(dim(`Reutilizando el clon de ${clonePath}. Con --fresh se vuelve a bajar.`))
  } else {
    console.log(`Clonando ${datasetRepo} …`)
    execFileSync('git', ['clone', '--depth', '1', datasetRepo, clonePath], { stdio: 'inherit' })
  }
  return execFileSync('git', ['-C', clonePath, 'log', '-1', '--format=%cI'], {
    encoding: 'utf8',
  }).trim()
}

function toCents(raw) {
  if (raw === null || raw === undefined) return null
  const value = Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

function text(value) {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function packageSize(price) {
  const rawFormat = text(price?.reference_format) ?? text(price?.size_format)
  if (!rawFormat) return null
  const format = rawFormat === 'l' ? 'L' : rawFormat

  if (
    price.is_pack &&
    typeof price.total_units === 'number' &&
    typeof price.pack_size === 'number'
  ) {
    return `${price.total_units} x ${price.pack_size} ${format}`
  }

  return typeof price.unit_size === 'number' ? `${price.unit_size} ${format}` : null
}

function imageUrl(raw) {
  const thumbnail = text(raw?.thumbnail)
  if (thumbnail) return thumbnail

  const photo = Array.isArray(raw?.photos) ? raw.photos[0] : null
  return text(photo?.regular) ?? text(photo?.thumbnail)
}

function toRow(raw, checkedAt) {
  const externalId = text(raw?.id)
  const name = text(raw?.display_name)?.slice(0, nameMaxLength).trim()
  if (!externalId || !name) return null

  const normalizedName = normalizeCatalogName(name)
  if (!normalizedName) return null

  const price = raw?.price_instructions
  const priceCents = toCents(price?.unit_price)

  return {
    supermarket_id: supermarketId,
    external_id: externalId,
    name,
    normalized_name: normalizedName,
    brand: text(raw?.brand) ?? text(raw?.details?.brand),
    package_size: packageSize(price),
    barcode: text(raw?.ean),
    image_url: imageUrl(raw),
    price_cents: priceCents,
    currency: 'EUR',
    price_checked_at: priceCents === null ? null : checkedAt,
  }
}

function readProducts(checkedAt, limit) {
  const productsDir = join(clonePath, 'products')
  if (!existsSync(productsDir)) {
    throw new Error(`El clon no tiene carpeta products/. Mira qué hay en ${clonePath}`)
  }

  const files = readdirSync(productsDir).filter((file) => file.endsWith('.json'))
  if (files.length === 0) throw new Error(`No hay ficheros .json en ${productsDir}`)

  const rows = []
  const skipped = []
  for (const file of files) {
    if (limit !== null && rows.length >= limit) break

    let raw
    try {
      raw = JSON.parse(readFileSync(join(productsDir, file), 'utf8'))
    } catch {
      skipped.push(file)
      continue
    }

    const row = toRow(raw, checkedAt)
    if (row) rows.push(row)
    else skipped.push(file)
  }

  if (rows.length === 0) {
    throw new Error(
      `Se leyeron ${files.length} ficheros y ninguno dio una fila válida. ` +
        'El dataset ha cambiado de forma: revisa display_name, id y price_instructions.',
    )
  }
  return { rows, files, skipped }
}

async function upsert(url, secretKey, chunk) {
  const res = await fetch(
    `${url}/rest/v1/catalog_products?on_conflict=supermarket_id,external_id`,
    {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} al escribir un lote de ${chunk.length}: ${detail}`)
  }
}

function report(rows, files, skipped, checkedAt) {
  const withPrice = rows.filter((row) => row.price_cents !== null).length
  const withImage = rows.filter((row) => row.image_url).length
  const withBarcode = rows.filter((row) => row.barcode).length
  const withSize = rows.filter((row) => row.package_size).length

  console.log(`\nFicheros en el clon      ${String(files.length).padStart(5, ' ')}`)
  console.log(`Filas válidas            ${String(rows.length).padStart(5, ' ')}`)
  console.log(`Descartadas              ${String(skipped.length).padStart(5, ' ')}`)
  console.log(`  con precio             ${String(withPrice).padStart(5, ' ')}`)
  console.log(`  con imagen             ${String(withImage).padStart(5, ' ')}`)
  console.log(`  con código de barras   ${String(withBarcode).padStart(5, ' ')}`)
  console.log(`  con formato            ${String(withSize).padStart(5, ' ')}`)
  console.log(`price_checked_at         ${checkedAt}  ${dim('(último commit del dataset)')}`)

  if (skipped.length > 0) {
    console.log(dim(`\nDescartados: ${skipped.slice(0, 10).join(', ')}`))
    if (skipped.length > 10) console.log(dim(`  y ${skipped.length - 10} más`))
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { url, secretKey } = requireEnv(args.dryRun)

  const checkedAt = cloneDataset(args.fresh)
  const { rows, files, skipped } = readProducts(checkedAt, args.limit)
  report(rows, files, skipped, checkedAt)

  if (args.dryRun) {
    console.log(dim('\nMuestra de lo que se enviaría:'))
    console.log(JSON.stringify(rows.slice(0, 2), null, 2))
    console.log(green(`\n--dry-run: no se ha escrito nada. ${rows.length} filas listas.`))
    return
  }

  console.log(`\nEscribiendo ${rows.length} filas por lotes de ${chunkSize} …`)
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    await upsert(url, secretKey, chunk)
    console.log(dim(`  ${Math.min(start + chunk.length, rows.length)}/${rows.length}`))
  }

  console.log(green(`\n${rows.length} productos de ${supermarketId} en el catálogo.`))
}

main().catch((error) => {
  console.error(red(error.message))
  process.exit(1)
})
