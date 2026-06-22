import { create } from 'zustand'
import { applyAttentionState } from '../game/simulation/systems/attentionSystem'
import { applyCareAction } from '../game/simulation/systems/careSystem'
import { applyOfflineDecay } from '../game/simulation/systems/decaySystem'
import { resolveTimedState } from '../game/simulation/systems/stateMachine'
import { normalizePetState, toSaveState } from '../game/simulation/state'
import { createPetBroadcast } from '../services/crossTabSync'
import { getDeviceId } from '../services/deviceId'
import { fetchRemotePetState, postRemoteAction, syncRemotePetState } from '../services/petApi'
import { loadPetState, savePetState } from '../services/petStorage'
import type { CatVariantId } from '../data/catVariants'
import type { PetActionId, PetRuntimeState, PetSaveState } from '../types/pet'

type PetStore = {
  deviceId: string
  state: PetRuntimeState
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  performAction: (action: PetActionId) => void
  selectCatVariant: (catVariantId: CatVariantId) => void
  tick: () => void
  setPosition: (x: number, y: number) => void
  setWidgetPosition: (x: number, y: number) => void
  hydrateRemote: () => Promise<void>
}

const deviceId = getDeviceId()
let lastPositionWriteAt = 0
let lastWidgetPositionWriteAt = 0
const broadcast = createPetBroadcast((event) => {
  usePetStore.getState().replaceFromBroadcast(event.state)
})

function persist(state: PetRuntimeState, publish = true) {
  savePetState(state)
  if (publish) {
    broadcast.publish(toSaveState(state))
  }
}

export const usePetStore = create<
  PetStore & { replaceFromBroadcast: (state: PetSaveState) => void }
>((set, get) => ({
  deviceId,
  state: applyOfflineDecay(loadPetState(deviceId)),
  menuOpen: false,
  setMenuOpen(open) {
    set({ menuOpen: open })
  },
  performAction(action) {
    const next = applyCareAction(get().state, action)
    persist(next)
    set({ state: next, menuOpen: false })
    void postRemoteAction(deviceId, action).catch(() => syncRemotePetState(toSaveState(next)))
  },
  selectCatVariant(catVariantId) {
    const current = get().state
    if (current.catVariantId === catVariantId) {
      set({ menuOpen: false })
      return
    }

    const next = {
      ...current,
      catVariantId,
      updatedAt: new Date().toISOString(),
    }
    persist(next)
    set({ state: next, menuOpen: false })
    void syncRemotePetState(toSaveState(next)).catch(() => undefined)
  },
  tick() {
    const current = get().state
    const next = applyAttentionState(resolveTimedState(current))
    if (next !== current) {
      persist(next)
      set({ state: next })
    }
  },
  setPosition(x, y) {
    const nowMs = Date.now()
    if (nowMs - lastPositionWriteAt < 500) {
      return
    }
    lastPositionWriteAt = nowMs

    const current = get().state
    const next = {
      ...current,
      position: { x, y },
      updatedAt: new Date().toISOString(),
    }
    persist(next, false)
    set({ state: next })
  },
  setWidgetPosition(x, y) {
    const nowMs = Date.now()
    if (nowMs - lastWidgetPositionWriteAt < 500) {
      return
    }
    lastWidgetPositionWriteAt = nowMs

    const current = get().state
    const nextPosition = { x: Math.round(x), y: Math.round(y) }
    if (
      current.widgetPosition?.x === nextPosition.x &&
      current.widgetPosition.y === nextPosition.y
    ) {
      return
    }

    const next = {
      ...current,
      widgetPosition: nextPosition,
      updatedAt: new Date().toISOString(),
    }
    persist(next, false)
    set({ state: next })
  },
  async hydrateRemote() {
    const remote = await fetchRemotePetState(deviceId).catch(() => null)
    if (!remote) {
      return
    }

    const next = normalizePetState(
      {
        ...remote,
        catVariantId: remote.catVariantId ?? get().state.catVariantId,
      },
      deviceId,
    )
    persist(next)
    set({ state: next })
  },
  replaceFromBroadcast(state) {
    const next = normalizePetState(state, deviceId)
    persist(next, false)
    set({ state: next })
  },
}))
