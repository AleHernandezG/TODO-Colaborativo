// scripts/seed-200-items.mjs
// Inserta o limpia 200 artículos de prueba en una comunidad para verificar
// el rendimiento de la SectionList virtualizada en un dispositivo real.
//
// Uso:
//   node --env-file=.env scripts/seed-200-items.mjs --dry-run
//   node --env-file=.env scripts/seed-200-items.mjs [--community <id>]
//   node --env-file=.env scripts/seed-200-items.mjs [--community <id>] --clean

import { randomUUID } from 'node:crypto'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno.')
  console.error('Ejecuta:  node --env-file=.env scripts/seed-200-items.mjs')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const isClean = process.argv.includes('--clean')

const communityIndex = process.argv.indexOf('--community')
let targetCommunityId = communityIndex !== -1 ? process.argv[communityIndex + 1] : null

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

async function main() {
  if (!targetCommunityId) {
    // Tomar la primera comunidad disponible
    const res = await fetch(`${url}/rest/v1/communities?select=id,name&limit=1`, {
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    })
    const communities = await res.json()
    if (!communities || communities.length === 0) {
      console.error('No se encontraron comunidades en la base de datos.')
      process.exit(1)
    }
    targetCommunityId = communities[0].id
    console.log(`Usando comunidad por defecto: ${communities[0].name} (${targetCommunityId})`)
  }

  const tag = '[BENCHMARK-200]'

  if (isClean) {
    console.log(`\nLimpiando artículos de benchmark con prefijo "${tag}"...`)
    if (isDryRun) {
      console.log(`[DRY-RUN] Se borrarían los artículos con name=ilike.*${encodeURIComponent(tag)}*`)
      return
    }
    const deleteRes = await fetch(
      `${url}/rest/v1/items?community_id=eq.${targetCommunityId}&name=like.${encodeURIComponent(`${tag}%`)}`,
      {
        method: 'DELETE',
        headers,
      },
    )
    if (!deleteRes.ok) {
      const err = await deleteRes.text()
      throw new Error(`Error al limpiar: HTTP ${deleteRes.status} - ${err}`)
    }
    console.log('✅ Artículos de benchmark eliminados correctamente.')
    return
  }

  console.log(`\nGenerando 200 artículos de prueba para la comunidad ${targetCommunityId}...`)

  const itemsToInsert = Array.from({ length: 200 }, (_, index) => {
    const isPurchased = index >= 150
    return {
      id: randomUUID(),
      community_id: targetCommunityId,
      name: `${tag} Ítem ${index + 1}${index % 10 === 0 ? ' (formato largo con descripción detallada)' : ''}`,
      quantity: (index % 5) + 1,
      is_purchased: isPurchased,
      image_path: null,
      catalog_product_id: null,
      created_at: new Date(Date.now() - index * 60000).toISOString(),
    }
  })

  if (isDryRun) {
    console.log(`[DRY-RUN] Se insertarían 200 artículos (150 pendientes, 50 comprados).`)
    console.log(`Ejemplo de primer ítem:`, itemsToInsert[0])
    console.log(`Ejemplo de ítem comprado:`, itemsToInsert[150])
    return
  }

  // Insertar en lotes de 50
  for (let i = 0; i < itemsToInsert.length; i += 50) {
    const batch = itemsToInsert.slice(i, i + 50)
    const res = await fetch(`${url}/rest/v1/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Fallo al insertar lote ${i}-${i + 50}: HTTP ${res.status} - ${err}`)
    }
    console.log(`  Insertados ítems ${i + 1} a ${i + batch.length}...`)
  }

  console.log(`\n✅ 200 artículos insertados correctamente en la comunidad ${targetCommunityId}.`)
  console.log(`Para eliminarlos cuando termines la prueba:`)
  console.log(`  node --env-file=.env scripts/seed-200-items.mjs --community ${targetCommunityId} --clean`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
