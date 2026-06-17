import { CARE_DECAY_INTERVAL_MS } from '../../../data/petConfig'
import type { PetRuntimeState } from '../../../types/pet'
import { clampStat } from '../state'

export function applyOfflineDecay(state: PetRuntimeState, nowMs = Date.now()) {
  const elapsed = Math.max(0, nowMs - Date.parse(state.updatedAt))
  const steps = Math.floor(elapsed / CARE_DECAY_INTERVAL_MS)
  if (steps <= 0) {
    return state
  }

  return {
    ...state,
    hunger: clampStat(state.hunger - steps * 2),
    happiness: clampStat(state.happiness - steps),
    energy: clampStat(state.energy - steps),
    boredom: clampStat(state.boredom + steps * 2),
    stress: clampStat(state.stress + (state.boredom > 70 ? steps : 0)),
    cleanliness: clampStat(state.cleanliness - steps),
    updatedAt: new Date(nowMs).toISOString(),
  }
}
