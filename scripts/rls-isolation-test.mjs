const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !anonKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.')
  console.error('Ejecuta:  node --env-file=.env scripts/rls-isolation-test.mjs')
  process.exit(1)
}

const results = []

function check(name, passed, detail = '') {
  results.push({ name, passed, detail })
  const mark = passed ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFALLA\x1b[0m'
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function signInAnonymously() {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) {
    throw new Error(
      `No se pudo crear la sesión anónima (${res.status}): ${JSON.stringify(body)}\n` +
        'Comprueba que "Allow anonymous sign-ins" está activado en Authentication > Sign In / Providers.',
    )
  }
  return body.access_token
}

function authHeaders(token, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rpc(token, name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(args),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function select(token, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: authHeaders(token) })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function insertItem(token, item) {
  const res = await fetch(`${url}/rest/v1/items`, {
    method: 'POST',
    headers: authHeaders(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(item),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function patchItem(token, itemId, patch) {
  const res = await fetch(`${url}/rest/v1/items?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

const imagesBucket = 'item-images'
const fakeJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0xff, 0xd9])

async function uploadImage(token, path) {
  const res = await fetch(`${url}/storage/v1/object/${imagesBucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: fakeJpeg,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function listImages(token, prefix) {
  const res = await fetch(`${url}/storage/v1/object/list/${imagesBucket}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function signImage(token, path) {
  const res = await fetch(`${url}/storage/v1/object/sign/${imagesBucket}/${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ expiresIn: 60 }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function fetchPublicImage(path) {
  const res = await fetch(`${url}/storage/v1/object/public/${imagesBucket}/${path}`)
  return { status: res.status }
}

async function selectWithoutSession(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function insertCatalogProduct(token, product) {
  const res = await fetch(`${url}/rest/v1/catalog_products`, {
    method: 'POST',
    headers: authHeaders(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(product),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function expireJoinCode(communityId) {
  const res = await fetch(`${url}/rest/v1/communities?id=eq.${communityId}`, {
    method: 'PATCH',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ join_code_expires_at: '2020-01-01T00:00:00Z' }),
  })
  return res.status
}

async function cleanup(communityIds, imagePaths) {
  if (!secretKey) {
    console.log('\nSin SUPABASE_SECRET_KEY: las comunidades de prueba se quedan en la base.')
    console.log(`Bórralas desde el panel: ${communityIds.join(', ')}`)
    return
  }
  for (const path of imagePaths) {
    await fetch(`${url}/storage/v1/object/${imagesBucket}/${path}`, {
      method: 'DELETE',
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    })
  }
  for (const id of communityIds) {
    await fetch(`${url}/rest/v1/communities?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    })
  }
  console.log('\nComunidades y fotos de prueba borradas.')
}

async function main() {
  const stamp = Date.now()
  const tokenA = await signInAnonymously()
  const tokenB = await signInAnonymously()

  const createdA = await rpc(tokenA, 'create_community', {
    p_name: `rls-test-A-${stamp}`,
    p_username: 'ana',
  })
  const createdB = await rpc(tokenB, 'create_community', {
    p_name: `rls-test-B-${stamp}`,
    p_username: 'bruno',
  })

  if (createdA.status !== 200 || createdB.status !== 200) {
    throw new Error(
      `create_community falló: A=${createdA.status} ${JSON.stringify(createdA.body)} ` +
        `B=${createdB.status} ${JSON.stringify(createdB.body)}`,
    )
  }

  const communityA = createdA.body[0].community_id
  const communityB = createdB.body[0].community_id
  const joinCodeB = createdB.body[0].join_code

  check('El join_code no lleva caracteres ambiguos', !/[O0I1]/.test(joinCodeB), joinCodeB)

  await insertItem(tokenA, { community_id: communityA, name: 'leche', quantity: 2 })
  const itemB = await insertItem(tokenB, { community_id: communityB, name: 'pan', quantity: 1 })
  const itemBId = itemB.body?.[0]?.id

  check(
    'Un miembro puede escribir en su propia comunidad',
    itemB.status === 201,
    `HTTP ${itemB.status}`,
  )

  const crossRead = await select(tokenA, `items?select=id&community_id=eq.${communityB}`)
  check(
    'A no lee los artículos de B',
    Array.isArray(crossRead.body) && crossRead.body.length === 0,
    `${crossRead.body?.length ?? '?'} filas`,
  )

  const allItems = await select(tokenA, 'items?select=id,community_id')
  const leaked = Array.isArray(allItems.body)
    ? allItems.body.filter((i) => i.community_id !== communityA)
    : ['respuesta inesperada']
  check('Sin filtro, A solo ve lo suyo', leaked.length === 0, `${leaked.length} filas ajenas`)

  const crossCommunity = await select(tokenA, `communities?select=id&id=eq.${communityB}`)
  check(
    'A no lee la comunidad de B',
    Array.isArray(crossCommunity.body) && crossCommunity.body.length === 0,
    `${crossCommunity.body?.length ?? '?'} filas`,
  )

  const crossMembers = await select(tokenA, `members?select=id&community_id=eq.${communityB}`)
  check(
    'A no lee los miembros de B',
    Array.isArray(crossMembers.body) && crossMembers.body.length === 0,
    `${crossMembers.body?.length ?? '?'} filas`,
  )

  const crossInsert = await insertItem(tokenA, { community_id: communityB, name: 'intruso' })
  check(
    'A no puede insertar en la comunidad de B',
    crossInsert.status >= 400,
    `HTTP ${crossInsert.status}`,
  )

  const crossUpdate = await patchItem(tokenA, itemBId, { is_purchased: true })
  check(
    'A no puede modificar un artículo de B',
    Array.isArray(crossUpdate.body) && crossUpdate.body.length === 0,
    `${crossUpdate.body?.length ?? '?'} filas afectadas`,
  )

  const escape = await patchItem(tokenA, itemBId, { community_id: communityA })
  check(
    'A no puede robar un artículo moviéndolo a su comunidad',
    Array.isArray(escape.body) && escape.body.length === 0,
    `${escape.body?.length ?? '?'} filas afectadas`,
  )

  const imagePathB = `${communityB}/${itemBId}.jpg`
  const imagePathIntruso = `${communityB}/intruso.jpg`

  const ownUpload = await uploadImage(tokenB, imagePathB)
  check(
    'B puede subir una foto a la carpeta de su comunidad',
    ownUpload.status === 200,
    `HTTP ${ownUpload.status}`,
  )

  const crossUpload = await uploadImage(tokenA, imagePathIntruso)
  check(
    'A no puede subir una foto a la carpeta de B',
    crossUpload.status >= 400,
    `HTTP ${crossUpload.status}`,
  )

  const crossList = await listImages(tokenA, `${communityB}/`)
  check(
    'A no lista las fotos de B',
    Array.isArray(crossList.body) && crossList.body.length === 0,
    `${crossList.body?.length ?? '?'} objetos`,
  )

  const crossSign = await signImage(tokenA, imagePathB)
  check('A no puede firmar una foto de B', crossSign.status >= 400, `HTTP ${crossSign.status}`)

  const ownSign = await signImage(tokenB, imagePathB)
  check('B sí puede firmar su propia foto', ownSign.status === 200, `HTTP ${ownSign.status}`)

  const publicRead = await fetchPublicImage(imagePathB)
  check(
    'El bucket no sirve la foto por URL pública',
    publicRead.status >= 400,
    `HTTP ${publicRead.status}`,
  )

  const supermarketsRead = await select(tokenA, 'supermarkets?select=id')
  const catalogRead = await select(tokenA, 'catalog_products?select=id&limit=1')
  check(
    'Un miembro lee el catálogo, que no pertenece a ninguna comunidad',
    Array.isArray(supermarketsRead.body) &&
      supermarketsRead.body.some((s) => s.id === 'mercadona') &&
      catalogRead.status === 200,
    `supermarkets ${supermarketsRead.body?.length ?? '?'} filas, ` +
      `catalog_products HTTP ${catalogRead.status}`,
  )

  const catalogWithoutSession = await selectWithoutSession('supermarkets?select=id')
  check(
    'Sin sesión no se lee el catálogo',
    catalogWithoutSession.status >= 400 ||
      (Array.isArray(catalogWithoutSession.body) && catalogWithoutSession.body.length === 0),
    `HTTP ${catalogWithoutSession.status}, ${catalogWithoutSession.body?.length ?? '?'} filas`,
  )

  const catalogWrite = await insertCatalogProduct(tokenA, {
    supermarket_id: 'mercadona',
    external_id: `rls-test-${stamp}`,
    name: 'producto intruso',
    normalized_name: 'producto intruso',
  })
  check(
    'Nadie con sesión de usuario escribe en el catálogo',
    catalogWrite.status >= 400,
    `HTTP ${catalogWrite.status}`,
  )

  const badCode = await rpc(tokenA, 'join_community', {
    p_join_code: 'ZZZ-9999',
    p_username: 'ana',
  })
  check(
    'Un join_code inexistente da invalid_join_code',
    badCode.body?.[0]?.status === 'invalid_join_code',
    badCode.body?.[0]?.status ?? `HTTP ${badCode.status}`,
  )

  const takenName = await rpc(tokenA, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'bruno',
  })
  check(
    'Un username ya usado da username_taken',
    takenName.body?.[0]?.status === 'username_taken',
    takenName.body?.[0]?.status ?? `HTTP ${takenName.status}`,
  )

  let rateLimited = null
  for (let i = 0; i < 12; i += 1) {
    const attempt = await rpc(tokenA, 'join_community', {
      p_join_code: 'ZZZ-9999',
      p_username: 'ana',
    })
    if (attempt.body?.[0]?.status === 'too_many_attempts') {
      rateLimited = i + 1
      break
    }
  }
  check(
    'El rate limit corta los intentos a fuerza bruta',
    rateLimited !== null,
    rateLimited ? `cortado en el intento ${rateLimited + 1}` : 'nunca cortó',
  )

  const stillWorks = await rpc(tokenB, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'bruno',
  })
  check(
    'El rate limit es por usuario, no global',
    stillWorks.body?.[0]?.status === 'ok',
    stillWorks.body?.[0]?.status ?? `HTTP ${stillWorks.status}`,
  )

  const intruderRotate = await rpc(tokenA, 'rotate_join_code', { p_community_id: communityB })
  check(
    'A no puede rotar el código de B',
    intruderRotate.status >= 400,
    `HTTP ${intruderRotate.status}`,
  )

  const tokenC = await signInAnonymously()
  const codeSurvives = await rpc(tokenC, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'carla',
  })
  check(
    'El código de B sigue valiendo tras el intento de A',
    codeSurvives.body?.[0]?.status === 'ok',
    codeSurvives.body?.[0]?.status ?? `HTTP ${codeSurvives.status}`,
  )

  const rotated = await rpc(tokenC, 'rotate_join_code', { p_community_id: communityB })
  const newCodeB = rotated.body?.[0]?.join_code
  check(
    'Cualquier miembro puede rotar el código de su lista',
    rotated.status === 200 && typeof newCodeB === 'string' && newCodeB !== joinCodeB,
    newCodeB ?? `HTTP ${rotated.status}`,
  )

  const tokenD = await signInAnonymously()
  const oldCode = await rpc(tokenD, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'daniel',
  })
  check(
    'El código anterior deja de valer al instante',
    oldCode.body?.[0]?.status === 'invalid_join_code',
    oldCode.body?.[0]?.status ?? `HTTP ${oldCode.status}`,
  )

  if (secretKey) {
    await expireJoinCode(communityB)
    const expiredCode = await rpc(tokenD, 'join_community', {
      p_join_code: newCodeB,
      p_username: 'daniel',
    })
    check(
      'Un código caducado da expired_join_code',
      expiredCode.body?.[0]?.status === 'expired_join_code',
      expiredCode.body?.[0]?.status ?? `HTTP ${expiredCode.status}`,
    )
  } else {
    console.log('Sin SUPABASE_SECRET_KEY: no se comprueba la caducidad del código.')
  }

  await cleanup([communityA, communityB], [imagePathB, imagePathIntruso])

  const failed = results.filter((r) => !r.passed)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)

  if (failed.length > 0) {
    console.log('\nHay un fallo de aislamiento entre comunidades. No cierres la fase.')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
