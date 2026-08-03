import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !anonKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.')
  console.error('Ejecuta:  node --env-file=.env scripts/realtime-check.mjs')
  process.exit(1)
}

const results = []

function check(name, passed, detail = '') {
  results.push({ name, passed, detail })
  const mark = passed ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFALLA\x1b[0m'
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntil(condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return true
    await wait(200)
  }
  return condition()
}

function newClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function signIn(client) {
  const { data, error } = await client.auth.signInAnonymously()
  if (error) {
    throw new Error(
      `No se pudo crear la sesión anónima: ${error.message}\n` +
        'Comprueba que "Allow anonymous sign-ins" está activado en Authentication > Sign In / Providers.',
    )
  }
  return data.session.access_token
}

function watchItems(client, name, filter) {
  const events = []
  const channel = client.channel(name).on(
    'postgres_changes',
    filter
      ? { event: '*', schema: 'public', table: 'items', filter }
      : { event: '*', schema: 'public', table: 'items' },
    (payload) => events.push(payload),
  )

  const subscribed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`El canal ${name} no llegó a SUBSCRIBED`)), 15000)
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`El canal ${name} falló: ${status} ${error?.message ?? ''}`))
      }
    })
  })

  return { channel, events, subscribed }
}

function watchPresence(client, communityId, username) {
  const channel = client.channel(`presence:${communityId}`, {
    config: { presence: { key: username, enabled: true } },
  })

  channel.on('presence', { event: 'sync' }, () => {})

  const names = () =>
    Object.values(channel.presenceState())
      .flat()
      .map((entry) => entry.username)
      .filter(Boolean)
      .sort()

  const joined = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`El canal de presencia de ${username} no llegó a SUBSCRIBED`)),
      15000,
    )
    channel.subscribe(async (status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        await channel.track({ username })
        setTimeout(() => void channel.track({ username }), 2000)
        resolve()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`La presencia de ${username} falló: ${status} ${error?.message ?? ''}`))
      }
    })
  })

  const leave = () => {
    void channel.untrack()
    void client.removeChannel(channel)
  }

  return { channel, names, joined, leave }
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
  const clientA = newClient()
  const clientB = newClient()

  await signIn(clientA)
  await signIn(clientB)

  const { data: createdA, error: errorA } = await clientA.rpc('create_community', {
    p_name: `rt-test-A-${stamp}`,
    p_username: 'ana',
  })
  const { data: createdB, error: errorB } = await clientB.rpc('create_community', {
    p_name: `rt-test-B-${stamp}`,
    p_username: 'bruno',
  })

  if (errorA || errorB) {
    throw new Error(`create_community falló: A=${errorA?.message} B=${errorB?.message}`)
  }

  const communityA = createdA[0].community_id
  const communityB = createdB[0].community_id

  const watcherA = watchItems(clientA, `items:${communityA}`, `community_id=eq.${communityA}`)
  const watcherB = watchItems(clientB, `items:${communityB}`, `community_id=eq.${communityB}`)
  const watcherAll = watchItems(clientB, `items:all-${stamp}`, null)

  await Promise.all([watcherA.subscribed, watcherB.subscribed, watcherAll.subscribed])
  check('El canal filtrado por comunidad se suscribe', true, `items:${communityA}`)

  await wait(2000)

  const { data: inserted, error: insertError } = await clientA
    .from('items')
    .insert({ community_id: communityA, name: 'leche', quantity: 2 })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(`No se pudo insertar el artículo de prueba: ${insertError.message}`)
  }

  await wait(1500)
  await clientA.from('items').update({ is_purchased: true }).eq('id', inserted.id)

  await wait(1500)
  await clientA.from('items').delete().eq('id', inserted.id)

  await wait(3000)

  const insertEvent = watcherA.events.find((e) => e.eventType === 'INSERT')
  const updateEvent = watcherA.events.find((e) => e.eventType === 'UPDATE')
  const deleteEvent = watcherA.events.find((e) => e.eventType === 'DELETE')

  check(
    'Llega el alta con su community_id',
    insertEvent?.new?.community_id === communityA,
    insertEvent?.new?.name ?? 'no llegó',
  )
  check(
    'Llega la modificación',
    updateEvent?.new?.is_purchased === true,
    updateEvent ? `is_purchased=${updateEvent.new.is_purchased}` : 'no llegó',
  )
  check(
    'replica identity full activo: el UPDATE trae la fila anterior entera',
    updateEvent?.old?.community_id === communityA && updateEvent?.old?.is_purchased === false,
    updateEvent?.old ? `old.community_id=${updateEvent.old.community_id}` : 'sin old',
  )
  check('Llega el borrado al canal de su comunidad', Boolean(deleteEvent), deleteEvent ? '' : 'no llegó')
  check(
    'El borrado identifica la fila',
    deleteEvent?.old?.id === inserted.id,
    JSON.stringify(deleteEvent?.old ?? null),
  )

  check(
    'El canal de B no recibe nada de la comunidad de A',
    watcherB.events.length === 0,
    watcherB.events.length === 0
      ? 'ni altas, ni cambios, ni borrados'
      : `${watcherB.events.length} eventos: ${watcherB.events.map((e) => e.eventType).join(', ')}`,
  )

  const identifiableLeaks = watcherAll.events.filter(
    (e) => (e.new?.community_id ?? e.old?.community_id) === communityA,
  )
  check(
    'Sin filtro no se filtra ningún dato de la comunidad ajena',
    identifiableLeaks.length === 0,
    `${identifiableLeaks.length} eventos con datos ajenos`,
  )

  const blindDeletes = watcherAll.events.filter(
    (e) => e.eventType === 'DELETE' && !e.old?.community_id,
  )
  if (blindDeletes.length > 0) {
    console.log(
      `\nNota: un canal SIN filtro recibe ${blindDeletes.length} borrado(s) ajeno(s) reducidos a su uuid.\n` +
        'Es comportamiento de Realtime, no se puede desactivar. Por eso la app siempre se\n' +
        'suscribe con filter=community_id: con filtro, esos borrados no llegan.',
    )
  }

  const clientC = newClient()
  await signIn(clientC)

  const { data: joined, error: joinError } = await clientC.rpc('join_community', {
    p_join_code: createdA[0].join_code,
    p_username: 'carla',
  })

  if (joinError || joined[0].status !== 'ok') {
    throw new Error(`join_community falló: ${joinError?.message ?? joined[0].status}`)
  }

  const watcherC = watchItems(clientC, `items:${communityA}-carla`, `community_id=eq.${communityA}`)
  await watcherC.subscribed
  await wait(2000)

  const seenByA = watcherA.events.length
  const { data: fromC, error: fromCError } = await clientC
    .from('items')
    .insert({ community_id: communityA, name: 'pan', quantity: 1 })
    .select('id')
    .single()

  if (fromCError) {
    throw new Error(`El segundo miembro no pudo insertar: ${fromCError.message}`)
  }

  await wait(2500)

  const receivedByA = watcherA.events.slice(seenByA).find((e) => e.new?.id === fromC.id)
  check(
    'El alta de un miembro llega al otro miembro de la misma lista',
    Boolean(receivedByA),
    receivedByA ? `${receivedByA.eventType} ${receivedByA.new.name}` : 'no llegó',
  )
  check(
    'Quien escribe también recibe su propio evento',
    watcherC.events.some((e) => e.new?.id === fromC.id),
    `${watcherC.events.length} evento(s) en el canal del segundo miembro`,
  )

  const presenceA = watchPresence(clientA, communityA, 'ana')
  const presenceC = watchPresence(clientC, communityA, 'carla')

  await Promise.all([presenceA.joined, presenceC.joined])
  await waitUntil(
    () => presenceA.names().includes('carla') && presenceC.names().includes('ana'),
    10000,
  )

  check(
    'Cada uno ve quién más tiene la lista abierta',
    presenceA.names().includes('carla') && presenceC.names().includes('ana'),
    `A ve [${presenceA.names()}] · C ve [${presenceC.names()}]`,
  )

  presenceC.leave()
  await waitUntil(() => !presenceA.names().includes('carla'), 10000)

  check(
    'Al cerrar la lista se deja de aparecer',
    !presenceA.names().includes('carla'),
    `A ve [${presenceA.names()}]`,
  )

  await clientA.removeAllChannels()
  await clientB.removeAllChannels()
  await clientC.removeAllChannels()
  await cleanup([communityA, communityB])

  const failed = results.filter((r) => !r.passed)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)

  if (failed.length > 0) {
    console.log('\nRealtime no está entregando lo que la app necesita. No sigas con la fase.')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
