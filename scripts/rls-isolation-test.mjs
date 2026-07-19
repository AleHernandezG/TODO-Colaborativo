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

async function cleanup(communityIds) {
  if (!secretKey) {
    console.log('\nSin SUPABASE_SECRET_KEY: las comunidades de prueba se quedan en la base.')
    console.log(`Bórralas desde el panel: ${communityIds.join(', ')}`)
    return
  }
  for (const id of communityIds) {
    await fetch(`${url}/rest/v1/communities?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    })
  }
  console.log('\nComunidades de prueba borradas.')
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

  check('Un miembro puede escribir en su propia comunidad', itemB.status === 201, `HTTP ${itemB.status}`)

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
  check('A no puede insertar en la comunidad de B', crossInsert.status >= 400, `HTTP ${crossInsert.status}`)

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

  const badCode = await rpc(tokenA, 'join_community', { p_join_code: 'ZZZ-9999', p_username: 'ana' })
  check(
    'Un join_code inexistente da invalid_join_code',
    badCode.status >= 400 && JSON.stringify(badCode.body).includes('invalid_join_code'),
    `HTTP ${badCode.status}`,
  )

  const takenName = await rpc(tokenA, 'join_community', { p_join_code: joinCodeB, p_username: 'bruno' })
  check(
    'Un username ya usado da username_taken',
    takenName.status >= 400 && JSON.stringify(takenName.body).includes('username_taken'),
    `HTTP ${takenName.status}`,
  )

  await cleanup([communityA, communityB])

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
