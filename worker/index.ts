type PetActionId =
  | 'feed'
  | 'pet_head'
  | 'cheek'
  | 'play'
  | 'sleep'
  | 'wake_up'
  | 'dream'
type PetType = 'cat' | 'dog'

type PetSaveState = {
  id: string
  userId?: string
  deviceId: string
  petType: PetType
  petName?: string
  mood: string
  state: string
  hunger: number
  happiness: number
  energy: number
  affection: number
  dreamPower: number
  lastCareAt: string
  lastFedAt?: string
  lastPetAt?: string
  lastOpenedAt: string
  position: { x: number; y: number }
  createdAt: string
  updatedAt: string
}

type PetRow = {
  id: string
  user_id: string | null
  device_id: string
  pet_type: PetType
  pet_name: string | null
  mood: string
  state: string
  hunger: number
  happiness: number
  energy: number
  affection: number
  dream_power: number
  last_care_at: string
  last_fed_at: string | null
  last_pet_at: string | null
  last_opened_at: string
  position_x: number | null
  position_y: number | null
  created_at: string
  updated_at: string
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/pet/state') {
        return json(await getPetState(url, env))
      }

      if (request.method === 'POST' && url.pathname === '/api/pet/action') {
        return json(await postPetAction(request, env, ctx))
      }

      if (request.method === 'POST' && url.pathname === '/api/pet/sync') {
        return json(await postPetSync(request, env))
      }

      return json({ error: 'Not found' }, 404)
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          path: url.pathname,
        }),
      )
      return json({ error: 'Pet API error' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

async function getPetState(url: URL, env: Env) {
  const deviceId = url.searchParams.get('deviceId')
  const userId = url.searchParams.get('userId') || undefined
  if (!deviceId) {
    return { error: 'deviceId is required' }
  }

  const row = await findPetRow(env.DB, deviceId, userId)
  if (row) {
    return fromRow(row)
  }

  const state = createDefaultState(deviceId, userId)
  await upsertPetState(env.DB, state)
  return state
}

async function postPetAction(request: Request, env: Env, ctx: ExecutionContext) {
  const body = await request.json<{
    deviceId?: string
    userId?: string
    action?: PetActionId
  }>()

  if (!body.deviceId || !isPetAction(body.action)) {
    return { error: 'deviceId and valid action are required' }
  }

  const existing = await findPetRow(env.DB, body.deviceId, body.userId)
  const current = existing ? fromRow(existing) : createDefaultState(body.deviceId, body.userId)
  const next = applyAction(current, body.action)
  ctx.waitUntil(upsertPetState(env.DB, next))
  return next
}

async function postPetSync(request: Request, env: Env) {
  const body = await request.json<Partial<PetSaveState>>()
  if (!body.deviceId) {
    return { error: 'deviceId is required' }
  }

  const state = normalizeIncomingState(body)
  await upsertPetState(env.DB, state)
  return state
}

async function findPetRow(db: D1Database, deviceId: string, userId?: string) {
  if (userId) {
    const byUser = await db
      .prepare('SELECT * FROM pet_states WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
      .bind(userId)
      .first<PetRow>()
    if (byUser) {
      return byUser
    }
  }

  return db
    .prepare('SELECT * FROM pet_states WHERE device_id = ? ORDER BY updated_at DESC LIMIT 1')
    .bind(deviceId)
    .first<PetRow>()
}

async function upsertPetState(db: D1Database, state: PetSaveState) {
  await db
    .prepare(
      `INSERT INTO pet_states (
        id, user_id, device_id, pet_type, pet_name, mood, state,
        hunger, happiness, energy, affection, dream_power,
        last_care_at, last_fed_at, last_pet_at, last_opened_at,
        position_x, position_y, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        device_id = excluded.device_id,
        pet_type = excluded.pet_type,
        pet_name = excluded.pet_name,
        mood = excluded.mood,
        state = excluded.state,
        hunger = excluded.hunger,
        happiness = excluded.happiness,
        energy = excluded.energy,
        affection = excluded.affection,
        dream_power = excluded.dream_power,
        last_care_at = excluded.last_care_at,
        last_fed_at = excluded.last_fed_at,
        last_pet_at = excluded.last_pet_at,
        last_opened_at = excluded.last_opened_at,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        updated_at = excluded.updated_at`,
    )
    .bind(
      state.id,
      state.userId ?? null,
      state.deviceId,
      state.petType,
      state.petName ?? null,
      state.mood,
      state.state,
      state.hunger,
      state.happiness,
      state.energy,
      state.affection,
      state.dreamPower,
      state.lastCareAt,
      state.lastFedAt ?? null,
      state.lastPetAt ?? null,
      state.lastOpenedAt,
      state.position.x,
      state.position.y,
      state.createdAt,
      state.updatedAt,
    )
    .run()
}

function createDefaultState(deviceId: string, userId?: string): PetSaveState {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    userId,
    deviceId,
    petType: 'cat',
    mood: 'happy',
    state: 'idle',
    hunger: 80,
    happiness: 82,
    energy: 78,
    affection: 50,
    dreamPower: 0,
    lastCareAt: now,
    lastOpenedAt: now,
    position: { x: 110, y: 190 },
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeIncomingState(input: Partial<PetSaveState>): PetSaveState {
  const fallback = createDefaultState(input.deviceId || crypto.randomUUID(), input.userId)
  return {
    ...fallback,
    ...input,
    id: input.id || fallback.id,
    deviceId: input.deviceId || fallback.deviceId,
    petType: input.petType === 'dog' ? 'dog' : 'cat',
    hunger: clampStat(input.hunger ?? fallback.hunger),
    happiness: clampStat(input.happiness ?? fallback.happiness),
    energy: clampStat(input.energy ?? fallback.energy),
    affection: clampStat(input.affection ?? fallback.affection),
    dreamPower: clampStat(input.dreamPower ?? fallback.dreamPower),
    position: input.position ?? fallback.position,
    updatedAt: new Date().toISOString(),
  }
}

function fromRow(row: PetRow): PetSaveState {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    deviceId: row.device_id,
    petType: row.pet_type,
    petName: row.pet_name ?? undefined,
    mood: row.mood,
    state: row.state,
    hunger: row.hunger,
    happiness: row.happiness,
    energy: row.energy,
    affection: row.affection,
    dreamPower: row.dream_power,
    lastCareAt: row.last_care_at,
    lastFedAt: row.last_fed_at ?? undefined,
    lastPetAt: row.last_pet_at ?? undefined,
    lastOpenedAt: row.last_opened_at,
    position: {
      x: row.position_x ?? 110,
      y: row.position_y ?? 190,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function applyAction(state: PetSaveState, action: PetActionId): PetSaveState {
  const now = new Date().toISOString()
  const next = { ...state, updatedAt: now }

  if (action === 'feed') {
    return {
      ...next,
      state: 'eat',
      mood: 'happy',
      hunger: clampStat(state.hunger + 25),
      happiness: clampStat(state.happiness + 10),
      lastCareAt: now,
      lastFedAt: now,
    }
  }

  if (action === 'pet_head') {
    return {
      ...next,
      state: 'pet_head',
      mood: 'relieved',
      happiness: clampStat(state.happiness + 15),
      affection: clampStat(state.affection + 10),
      lastCareAt: now,
      lastPetAt: now,
    }
  }

  if (action === 'cheek') {
    return {
      ...next,
      state: 'cheek',
      mood: 'happy',
      happiness: clampStat(state.happiness + 8),
      affection: clampStat(state.affection + 6),
    }
  }

  if (action === 'play') {
    return {
      ...next,
      state: 'play',
      mood: 'happy',
      happiness: clampStat(state.happiness + 20),
      energy: clampStat(state.energy - 10),
      lastCareAt: now,
    }
  }

  if (action === 'sleep') {
    return {
      ...next,
      state: 'sleep',
      mood: 'sleepy',
      energy: clampStat(state.energy + 20),
    }
  }

  if (action === 'wake_up') {
    return {
      ...next,
      state: 'idle',
      mood: 'relaxed',
      energy: clampStat(state.energy - 3),
      lastCareAt: now,
    }
  }

  return {
    ...next,
    state: 'dream',
    mood: 'dreaming',
    dreamPower: clampStat(state.dreamPower + 15),
    energy: clampStat(state.energy + 5),
  }
}

function isPetAction(action: unknown): action is PetActionId {
  return (
    action === 'feed' ||
    action === 'pet_head' ||
    action === 'cheek' ||
    action === 'play' ||
    action === 'sleep' ||
    action === 'wake_up' ||
    action === 'dream'
  )
}

function clampStat(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
  })
}
