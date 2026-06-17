import { LOCAL_STORAGE_KEY } from '../data/petConfig'
import { normalizePetState, toSaveState } from '../game/simulation/state'
import type { PetRuntimeState } from '../types/pet'

export function loadPetState(deviceId: string): PetRuntimeState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return normalizePetState(raw ? JSON.parse(raw) : null, deviceId)
  } catch {
    return normalizePetState(null, deviceId)
  }
}

export function savePetState(state: PetRuntimeState) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSaveState(state)))
}
