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

  if (body.access_token) {
    return body.access_token
  }

  // Fallback si la API anónima pública sufre rate limit (429) y disponemos de secretKey en testing
  if (res.status === 429 && secretKey) {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`
    const password = 'Test_Password_123!'
    await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const tokenBody = await tokenRes.json()
    if (tokenBody.access_token) {
      return tokenBody.access_token
    }
  }

  throw new Error(
    `No se pudo crear la sesión (${res.status}): ${JSON.stringify(body)}\n` +
      'Comprueba que "Allow anonymous sign-ins" está activado en Authentication > Sign In / Providers.',
  )
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

async function post(token, path, payload, prefer = 'return=representation') {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: authHeaders(token, prefer ? { Prefer: prefer } : {}),
    body: JSON.stringify(payload),
  })
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

async function rpcWithoutSession(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
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
    p_pin: '1234',
  })
  const createdB = await rpc(tokenB, 'create_community', {
    p_name: `rls-test-B-${stamp}`,
    p_username: 'bruno',
    p_pin: '1234',
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

  const search = await rpc(tokenA, 'search_catalog', {
    p_query: 'leche',
    p_supermarket_id: 'mercadona',
    p_limit: 10,
  })
  check(
    'Un miembro busca en el catálogo con search_catalog',
    search.status === 200 &&
      Array.isArray(search.body) &&
      search.body.length > 0 &&
      search.body.every((row) => row.supermarket_id === 'mercadona') &&
      search.body[0].normalized_name.startsWith('leche'),
    `HTTP ${search.status}, ${search.body?.length ?? '?'} resultados, 1º «${search.body?.[0]?.name ?? '?'}»`,
  )

  const searchWithoutSession = await rpcWithoutSession('search_catalog', { p_query: 'leche' })
  check(
    'Sin sesión no se puede ejecutar search_catalog',
    searchWithoutSession.status >= 400,
    `HTTP ${searchWithoutSession.status}`,
  )

  // RF-9: Reparto de gastos y liquidaciones
  const membersA = await select(tokenA, `members?select=id&community_id=eq.${communityA}`)
  const memberAId = membersA.body?.[0]?.id

  const expenseCreated = await rpc(tokenA, 'create_expense_with_shares', {
    p_community_id: communityA,
    p_item_id: null,
    p_paid_by_member_id: memberAId,
    p_amount_cents: 1500,
    p_description: 'Compra de prueba',
    p_shares: [{ member_id: memberAId, share_cents: 1500 }],
  })
  check(
    'Un miembro crea un gasto atómico sin mandar id, como el APK ya instalado',
    expenseCreated.status === 200 && typeof expenseCreated.body === 'string',
    `HTTP ${expenseCreated.status}`,
  )

  const clientExpenseId = crypto.randomUUID()
  const clientExpenseArgs = {
    p_expense_id: clientExpenseId,
    p_community_id: communityA,
    p_item_id: null,
    p_paid_by_member_id: memberAId,
    p_amount_cents: 900,
    p_description: 'Gasto con id del cliente',
    p_shares: [{ member_id: memberAId, share_cents: 900 }],
  }
  const firstSend = await rpc(tokenA, 'create_expense_with_shares', clientExpenseArgs)
  const resend = await rpc(tokenA, 'create_expense_with_shares', clientExpenseArgs)
  const storedExpense = await select(tokenA, `expenses?select=id&id=eq.${clientExpenseId}`)
  const storedShares = await select(
    tokenA,
    `expense_shares?select=id&expense_id=eq.${clientExpenseId}`,
  )

  check(
    'El gasto se guarda con el id que genera el cliente',
    firstSend.status === 200 && firstSend.body === clientExpenseId,
    `HTTP ${firstSend.status} · ${firstSend.body}`,
  )
  check(
    'Reenviar el mismo gasto no lo duplica ni duplica sus cuotas',
    resend.status === 200 &&
      resend.body === clientExpenseId &&
      storedExpense.body?.length === 1 &&
      storedShares.body?.length === 1,
    `${storedExpense.body?.length ?? '?'} gasto(s) · ${storedShares.body?.length ?? '?'} cuota(s)`,
  )

  const crossExpenses = await select(tokenB, `expenses?select=id&community_id=eq.${communityA}`)
  check(
    'B no lee los gastos de A',
    Array.isArray(crossExpenses.body) && crossExpenses.body.length === 0,
    `${crossExpenses.body?.length ?? '?'} filas`,
  )

  const crossExpenseShares = await select(tokenB, 'expense_shares?select=id')
  check(
    'B no lee las cuotas de gastos de A',
    Array.isArray(crossExpenseShares.body) && crossExpenseShares.body.length === 0,
    `${crossExpenseShares.body?.length ?? '?'} filas`,
  )

  const crossExpenseInsert = await post(
    tokenB,
    'expenses',
    {
      community_id: communityA,
      paid_by_member_id: memberAId,
      amount_cents: 1000,
      description: 'Intruso',
    },
    'return=representation',
  )
  check(
    'B no puede insertar gastos en la comunidad de A',
    crossExpenseInsert.status >= 400,
    `HTTP ${crossExpenseInsert.status}`,
  )

  const settlementA = await post(
    tokenA,
    'settlements',
    {
      community_id: communityA,
      from_member_id: memberAId,
      to_member_id: memberAId, // check constraint will reject self to self, so we test constraint
      amount_cents: 500,
    },
    'return=representation',
  )
  check(
    'La base de datos rechaza liquidaciones hacia uno mismo',
    settlementA.status >= 400,
    `HTTP ${settlementA.status}`,
  )

  const tokenLegacy = await signInAnonymously()
  const legacyCreate = await rpc(tokenLegacy, 'create_community', {
    p_name: `rls-test-legacy-${stamp}`,
    p_username: 'legacy',
  })
  const communityLegacy = legacyCreate.body?.[0]?.community_id ?? null
  check(
    'create_community responde a un cliente antiguo que no manda p_pin',
    legacyCreate.status === 200 && Boolean(communityLegacy),
    communityLegacy ?? `HTTP ${legacyCreate.status} ${JSON.stringify(legacyCreate.body)}`,
  )

  const legacyJoin = await rpc(tokenLegacy, 'join_community', {
    p_join_code: 'ZZZ-9999',
    p_username: 'legacy',
  })
  check(
    'join_community responde a un cliente antiguo que no manda p_pin',
    legacyJoin.status === 200 && legacyJoin.body?.[0]?.status === 'invalid_join_code',
    legacyJoin.body?.[0]?.status ?? `HTTP ${legacyJoin.status} ${JSON.stringify(legacyJoin.body)}`,
  )

  const badCode = await rpc(tokenA, 'join_community', {
    p_join_code: 'ZZZ-9999',
    p_username: 'ana',
    p_pin: '1234',
  })
  check(
    'Un join_code inexistente da invalid_join_code',
    badCode.body?.[0]?.status === 'invalid_join_code',
    badCode.body?.[0]?.status ?? `HTTP ${badCode.status}`,
  )

  const wrongPin = await rpc(tokenA, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'bruno',
    p_pin: '9999',
  })
  check(
    'Un PIN incorrecto sobre usuario existente da invalid_pin',
    wrongPin.body?.[0]?.status === 'invalid_pin',
    wrongPin.body?.[0]?.status ?? `HTTP ${wrongPin.status}`,
  )

  const tokenB2 = await signInAnonymously()
  const reclaimed = await rpc(tokenB2, 'join_community', {
    p_join_code: joinCodeB,
    p_username: 'bruno',
    p_pin: '1234',
  })
  check(
    'Un miembro se puede recuperar desde otro dispositivo con el PIN correcto',
    reclaimed.body?.[0]?.status === 'ok' && reclaimed.body?.[0]?.community_id === communityB,
    reclaimed.body?.[0]?.status ?? `HTTP ${reclaimed.status}`,
  )

  let rateLimited = null
  for (let i = 0; i < 12; i += 1) {
    const attempt = await rpc(tokenA, 'join_community', {
      p_join_code: 'ZZZ-9999',
      p_username: 'ana',
      p_pin: '1234',
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
    p_pin: '1234',
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
    p_pin: '1234',
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
    p_pin: '1234',
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
      p_pin: '1234',
    })
    check(
      'Un código caducado da expired_join_code',
      expiredCode.body?.[0]?.status === 'expired_join_code',
      expiredCode.body?.[0]?.status ?? `HTTP ${expiredCode.status}`,
    )
  } else {
    console.log('Sin SUPABASE_SECRET_KEY: no se comprueba la caducidad del código.')
  }

  // --- RF-11 y RF-12: Roles, baja de miembros e invitados ---
  const membersB = await select(tokenB, `members?select=id,username,is_admin,auth_user_id,removed_at&community_id=eq.${communityB}`)
  const memberBruno = membersB.body?.find((m) => m.username === 'bruno')
  const memberCarla = membersB.body?.find((m) => m.username === 'carla')

  check(
    'El creador de la comunidad nace como admin (is_admin = true)',
    memberBruno?.is_admin === true,
    memberBruno ? `is_admin=${memberBruno.is_admin}` : 'No encontrado',
  )
  check(
    'Un miembro que se une no es admin por defecto',
    memberCarla?.is_admin === false,
    memberCarla ? `is_admin=${memberCarla.is_admin}` : 'No encontrado',
  )

  const nonAdminRemove = await rpc(tokenC, 'remove_member', {
    p_community_id: communityB,
    p_member_id: memberBruno?.id,
  })
  check(
    'Un miembro no admin no puede expulsar a nadie',
    nonAdminRemove.status >= 400,
    `HTTP ${nonAdminRemove.status}`,
  )

  const nonAdminGuest = await rpc(tokenC, 'add_guest_member', {
    p_community_id: communityB,
    p_username: 'invitado-c',
  })
  check(
    'Un miembro no admin no puede añadir participantes invitados',
    nonAdminGuest.status >= 400,
    `HTTP ${nonAdminGuest.status}`,
  )

  const nonAdminSetRole = await rpc(tokenC, 'set_member_admin', {
    p_community_id: communityB,
    p_member_id: memberCarla?.id,
    p_is_admin: true,
  })
  check(
    'Un miembro no admin no puede asignarse rol de admin',
    nonAdminSetRole.status >= 400,
    `HTTP ${nonAdminSetRole.status}`,
  )

  const selfRemove = await rpc(tokenB, 'remove_member', {
    p_community_id: communityB,
    p_member_id: memberBruno?.id,
  })
  check(
    'Un admin no puede auto-expulsarse',
    selfRemove.status >= 400,
    `HTTP ${selfRemove.status}`,
  )

  const removeLastAdmin = await rpc(tokenB, 'set_member_admin', {
    p_community_id: communityB,
    p_member_id: memberBruno?.id,
    p_is_admin: false,
  })
  check(
    'No se puede dejar a la comunidad sin ningún administrador activo',
    removeLastAdmin.status >= 400,
    `HTTP ${removeLastAdmin.status}`,
  )

  // Rotar el código de communityB para reactivarlo tras expireJoinCode
  const refreshedCode = await rpc(tokenB, 'rotate_join_code', { p_community_id: communityB })
  const activeCodeB = refreshedCode.body?.[0]?.join_code

  // Crear duplicado sin historial y verificar borrado físico (deleted)
  const tokenDuplicado = tokenD
  const joinDup = await rpc(tokenDuplicado, 'join_community', {
    p_join_code: activeCodeB,
    p_username: 'bruno_error',
    p_pin: '1234',
  })
  const membersAfterDup = await select(tokenB, `members?select=id,username&community_id=eq.${communityB}&username=eq.bruno_error`)
  const dupMemberId = membersAfterDup.body?.[0]?.id

  const removeClean = await rpc(tokenB, 'remove_member', {
    p_community_id: communityB,
    p_member_id: dupMemberId,
  })
  const dupStillExists = await select(tokenB, `members?select=id&id=eq.${dupMemberId}`)
  check(
    'Un miembro sin historial se elimina con borrado físico (deleted)',
    removeClean.body?.[0]?.status === 'deleted' && Array.isArray(dupStillExists.body) && dupStillExists.body.length === 0,
    removeClean.body?.[0]?.status ?? `HTTP ${removeClean.status}`,
  )

  // Asignar gasto a Carla y verificar que al expulsarla se archiva (archived)
  await rpc(tokenB, 'create_expense_with_shares', {
    p_community_id: communityB,
    p_description: 'Cena de grupo',
    p_amount_cents: 2000,
    p_paid_by_member_id: memberBruno.id,
    p_item_id: null,
    p_shares: [
      { member_id: memberBruno.id, share_cents: 1000 },
      { member_id: memberCarla.id, share_cents: 1000 },
    ],
  })

  const removeWithHistory = await rpc(tokenB, 'remove_member', {
    p_community_id: communityB,
    p_member_id: memberCarla.id,
  })
  const carlaArchived = await select(tokenB, `members?select=id,removed_at&id=eq.${memberCarla.id}`)
  check(
    'Un miembro con historial de gastos se archiva con removed_at (archived)',
    removeWithHistory.body?.[0]?.status === 'archived' && Boolean(carlaArchived.body?.[0]?.removed_at),
    removeWithHistory.body?.[0]?.status ?? `HTTP ${removeWithHistory.status}`,
  )

  const carlaForbiddenRead = await select(tokenC, `items?community_id=eq.${communityB}`)
  check(
    'Un miembro archivado pierde de inmediato el acceso RLS a la comunidad',
    Array.isArray(carlaForbiddenRead.body) && carlaForbiddenRead.body.length === 0,
    `${carlaForbiddenRead.body?.length ?? '?'} filas devueltas`,
  )

  // RF-12: Creación de invitado y adopción posterior
  const guestCreated = await rpc(tokenB, 'add_guest_member', {
    p_community_id: communityB,
    p_username: 'marcos_invitado',
  })
  const guestId = guestCreated.body?.[0]?.id
  const guestRow = await select(tokenB, `members?select=id,auth_user_id,pin_hash&id=eq.${guestId}`)
  check(
    'Un admin puede añadir un participante invitado (auth_user_id = null)',
    guestCreated.status === 200 && Boolean(guestId) && guestRow.body?.[0]?.auth_user_id === null,
    guestCreated.body?.[0]?.username ?? `HTTP ${guestCreated.status}`,
  )

  const tokenMarcos = tokenLegacy
  const marcosAdopts = await rpc(tokenMarcos, 'join_community', {
    p_join_code: activeCodeB,
    p_username: 'marcos_invitado',
    p_pin: '9876',
  })
  const marcosRow = await select(tokenB, `members?select=id,auth_user_id,pin_hash&id=eq.${guestId}`)
  check(
    'Un invitado es adoptado al unirse con ese nombre y PIN (hereda la fila)',
    marcosAdopts.body?.[0]?.status === 'ok' && marcosRow.body?.[0]?.auth_user_id !== null && Boolean(marcosRow.body?.[0]?.pin_hash),
    marcosAdopts.body?.[0]?.status ?? `HTTP ${marcosAdopts.status}`,
  )

  // Fase 10: Notificaciones push y aislamiento de tokens
  const tokenPushC = await signInAnonymously()
  const joinCodeA = createdA.body[0].join_code
  await rpc(tokenPushC, 'join_community', {
    p_join_code: joinCodeA,
    p_username: 'clara_push',
    p_pin: '1234',
  })

  const regA = await rpc(tokenA, 'register_push_token', {
    p_community_id: communityA,
    p_expo_push_token: 'ExponentPushToken[userA-device1]',
    p_device_name: 'Pixel 8',
  })
  check(
    'Un miembro puede registrar su push token',
    regA.status === 200 || regA.status === 204,
    `HTTP ${regA.status}`,
  )

  const regBInA = await rpc(tokenB, 'register_push_token', {
    p_community_id: communityA,
    p_expo_push_token: 'ExponentPushToken[intruder]',
    p_device_name: 'Hacker Phone',
  })
  check(
    'Un usuario de otra comunidad no puede registrar token en comunidad ajena',
    regBInA.status !== 200,
    `HTTP ${regBInA.status}`,
  )

  const tokensForA = await rpc(tokenA, 'get_community_push_tokens', {
    p_community_id: communityA,
  })
  const hasSelfToken = tokensForA.body?.some((t) => t.expo_push_token === 'ExponentPushToken[userA-device1]')
  check(
    'get_community_push_tokens no incluye el propio token del emisor',
    tokensForA.status === 200 && !hasSelfToken,
    `${tokensForA.body?.length ?? 0} tokens ajenos`,
  )

  const tokensForClara = await rpc(tokenPushC, 'get_community_push_tokens', {
    p_community_id: communityA,
  })
  const claraSeesA = tokensForClara.body?.some((t) => t.expo_push_token === 'ExponentPushToken[userA-device1]')
  check(
    'Otro miembro de la misma lista sí recibe el push token para notificarle',
    tokensForClara.status === 200 && Boolean(claraSeesA),
    claraSeesA ? 'token recibido' : 'no encontrado',
  )

  await rpc(tokenA, 'unregister_push_token', {
    p_expo_push_token: 'ExponentPushToken[userA-device1]',
  })
  const tokensForClaraAfter = await rpc(tokenPushC, 'get_community_push_tokens', {
    p_community_id: communityA,
  })
  const claraSeesAAfter = tokensForClaraAfter.body?.some((t) => t.expo_push_token === 'ExponentPushToken[userA-device1]')
  check(
    'Al desregistrar el token desaparece de la lista de destinatarios',
    tokensForClaraAfter.status === 200 && !claraSeesAAfter,
    'desregistrado',
  )

  // --- Fase 11: Aislamiento de Recetas y sus ingredientes ---
  const recipeIdA = crypto.randomUUID()
  const saveRecipeA = await rpc(tokenA, 'save_recipe', {
    p_id: recipeIdA,
    p_community_id: communityA,
    p_title: 'Tortilla de patatas',
    p_servings: 4,
    p_instructions: 'Batir huevos y freír patatas',
    p_ingredients: [
      { name: 'Huevos', quantity: 6, unit: 'unidades' },
      { name: 'Patatas', quantity: 1, unit: 'kg' },
    ],
  })
  check(
    'A puede crear una receta con ingredientes en su comunidad con save_recipe',
    saveRecipeA.status === 200 && saveRecipeA.body === recipeIdA,
    saveRecipeA.body ?? `HTTP ${saveRecipeA.status}`,
  )

  const readRecipesB = await select(tokenB, `recipes?community_id=eq.${communityA}`)
  check(
    'B no lee las recetas de A',
    readRecipesB.status === 200 && readRecipesB.body.length === 0,
    `${readRecipesB.body?.length ?? 0} recetas ajenas`,
  )

  const intruderRecipe = await rpc(tokenB, 'save_recipe', {
    p_id: crypto.randomUUID(),
    p_community_id: communityA,
    p_title: 'Receta intrusa',
    p_servings: 2,
    p_instructions: 'Hack',
    p_ingredients: [],
  })
  check(
    'B no puede insertar recetas en la comunidad de A',
    intruderRecipe.status >= 400,
    `HTTP ${intruderRecipe.status}`,
  )

  const readIngredientsB = await select(tokenB, `recipe_ingredients?recipe_id=eq.${recipeIdA}`)
  check(
    'B no lee los ingredientes de la receta de A',
    readIngredientsB.status === 200 && readIngredientsB.body.length === 0,
    `${readIngredientsB.body?.length ?? 0} ingredientes ajenos`,
  )

  const deleteRecipeA = await rpc(tokenA, 'delete_recipe', { p_id: recipeIdA })
  const readAfterDelete = await select(tokenA, `recipes?id=eq.${recipeIdA}`)
  const readIngredientsAfterDelete = await select(tokenA, `recipe_ingredients?recipe_id=eq.${recipeIdA}`)
  check(
    'Al borrar una receta se eliminan la receta y sus ingredientes en cascada',
    (deleteRecipeA.status === 200 || deleteRecipeA.status === 204) &&
      readAfterDelete.body.length === 0 &&
      readIngredientsAfterDelete.body.length === 0,
    'borrada en cascada',
  )

  // -------------------------------------------------------------------------
  // FASE 12 · Planificador semanal de menús (RF-15)
  // -------------------------------------------------------------------------
  const upsertSlotA = await rpc(tokenA, 'upsert_meal_slot', {
    p_community_id: communityA,
    p_date: '2026-09-07',
    p_meal_type: 'lunch',
    p_custom_dish_name: 'Paella de marisco',
    p_servings: 6,
  })
  check(
    'A puede asignar un plato en el menú semanal con upsert_meal_slot',
    upsertSlotA.status === 200 && Boolean(upsertSlotA.body),
    upsertSlotA.body ?? `HTTP ${upsertSlotA.status}`,
  )

  const readMealSlotsB = await select(tokenB, `meal_plan_slots?community_id=eq.${communityA}`)
  check(
    'B no lee el planificador de menús de A',
    readMealSlotsB.status === 200 && readMealSlotsB.body.length === 0,
    `${readMealSlotsB.body?.length ?? 0} menús ajenos`,
  )

  const intruderSlot = await rpc(tokenB, 'upsert_meal_slot', {
    p_community_id: communityA,
    p_date: '2026-09-07',
    p_meal_type: 'lunch',
    p_custom_dish_name: 'Menú intruso',
  })
  check(
    'B no puede insertar ni editar menús en la comunidad de A',
    intruderSlot.status >= 400,
    `HTTP ${intruderSlot.status}`,
  )

  const deleteSlotA = await rpc(tokenA, 'delete_meal_slot', {
    p_community_id: communityA,
    p_date: '2026-09-07',
    p_meal_type: 'lunch',
  })
  const readAfterDeleteSlot = await select(tokenA, `meal_plan_slots?community_id=eq.${communityA}`)
  check(
    'A puede vaciar una comida con delete_meal_slot',
    (deleteSlotA.status === 200 || deleteSlotA.status === 204) &&
      readAfterDeleteSlot.body.length === 0,
    'comida vaciada',
  )

  await cleanup([communityA, communityB, communityLegacy].filter(Boolean), [
    imagePathB,
    imagePathIntruso,
  ])

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
