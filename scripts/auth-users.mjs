const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.')
  console.error('Ejecuta:  node --env-file=.env scripts/auth-users.mjs')
  console.error('La secret key se salta RLS: solo para esto, nunca en la app.')
  process.exit(1)
}

const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}` }

async function fetchJson(path) {
  const res = await fetch(`${url}${path}`, { headers })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${path}: ${JSON.stringify(body)}`)
  }
  return body
}

const { users } = await fetchJson('/auth/v1/admin/users?per_page=1000')
const members = await fetchJson('/rest/v1/members?select=auth_user_id')

const withMembership = new Set(members.map((m) => m.auth_user_id))
const anonymous = users.filter((u) => u.is_anonymous)
const orphans = anonymous.filter((u) => !withMembership.has(u.id))

console.log(`usuarios:   ${users.length}`)
console.log(`anónimos:   ${anonymous.length}`)
console.log(`huérfanos:  ${orphans.length}  (anónimos sin ninguna fila en members)`)

if (users.length > 0) {
  console.log('')
  for (const user of users) {
    const mark = withMembership.has(user.id) ? 'en uso   ' : 'huérfano '
    console.log(`  ${mark} ${user.id}  creado ${user.created_at}`)
  }
}

if (process.argv.includes('--delete-orphans')) {
  console.log('')
  for (const user of orphans) {
    const res = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
    console.log(`  borrado ${user.id} -> HTTP ${res.status}`)
  }
  console.log(`\n${orphans.length} usuarios huérfanos borrados.`)
} else if (orphans.length > 0) {
  console.log('\nPara borrarlos:  node --env-file=.env scripts/auth-users.mjs --delete-orphans')
  console.log('Ojo: un móvil con la app instalada y sin unirse a ninguna lista cuenta como')
  console.log('huérfano. Borrarlo le crea una sesión nueva la próxima vez que abra.')
}
