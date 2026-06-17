import { clampStat } from '../state'
import type { PetActionId, PetRuntimeState } from '../../../types/pet'
import { decideReaction, rememberReaction } from './catBrain'

export function applyCareAction(
  state: PetRuntimeState,
  action: PetActionId,
  nowMs = Date.now(),
): PetRuntimeState {
  const now = new Date(nowMs).toISOString()
  const decision = decideReaction(state, action)
  const next: PetRuntimeState = {
    ...state,
    state: decision.state,
    mood: decision.mood,
    updatedAt: now,
    actionUntil:
      nowMs + decision.durationMs,
    currentReaction: {
      id: decision.reaction,
      startedAt: nowMs,
      durationMs: decision.durationMs,
    },
    memory: rememberReaction(
      state.memory,
      action,
      decision.reaction,
      decision.liked,
      nowMs,
    ),
  }

  if (action === 'feed') {
    const fullReject = decision.reaction === 'sniff_ignore_food'
    return {
      ...next,
      hunger: clampStat(state.hunger + (fullReject ? 2 : 28)),
      happiness: clampStat(state.happiness + (fullReject ? -2 : 12)),
      stress: clampStat(state.stress - (fullReject ? 0 : 4)),
      boredom: clampStat(state.boredom + (fullReject ? 4 : -4)),
      lastCareAt: fullReject ? state.lastCareAt : now,
      lastFedAt: fullReject ? state.lastFedAt : now,
    }
  }

  if (action === 'pet_head') {
    const rejected = !decision.liked
    return {
      ...next,
      happiness: clampStat(state.happiness + (rejected ? -3 : 12)),
      affection: clampStat(state.affection + (rejected ? -2 : 11)),
      stress: clampStat(state.stress + (rejected ? 12 : -9)),
      boredom: clampStat(state.boredom + (rejected ? 3 : -2)),
      lastCareAt: rejected ? state.lastCareAt : now,
      lastPetAt: now,
    }
  }

  if (action === 'cheek') {
    const rejected = !decision.liked
    return {
      ...next,
      happiness: clampStat(state.happiness + (rejected ? -4 : 8)),
      affection: clampStat(state.affection + (rejected ? -1 : 6)),
      stress: clampStat(state.stress + (rejected ? 10 : -3)),
    }
  }

  if (action === 'play') {
    const rejected = !decision.liked
    return {
      ...next,
      happiness: clampStat(state.happiness + (rejected ? -2 : 18)),
      energy: clampStat(state.energy - (rejected ? 2 : 14)),
      boredom: clampStat(state.boredom - (rejected ? 3 : 24)),
      stress: clampStat(state.stress - (rejected ? 0 : 5)),
      lastCareAt: rejected ? state.lastCareAt : now,
    }
  }

  if (action === 'sleep') {
    return {
      ...next,
      energy: clampStat(state.energy + (decision.liked ? 20 : 0)),
      stress: clampStat(state.stress - (decision.liked ? 12 : 0)),
      boredom: clampStat(state.boredom + (decision.liked ? -4 : 5)),
    }
  }

  if (action === 'wake_up') {
    const rejected = !decision.liked
    return {
      ...next,
      energy: clampStat(state.energy - (rejected ? 0 : 3)),
      stress: clampStat(state.stress + (rejected ? 4 : -3)),
      boredom: clampStat(state.boredom + (rejected ? 0 : 4)),
      lastCareAt: rejected ? state.lastCareAt : now,
    }
  }

  return {
    ...next,
    dreamPower: clampStat(state.dreamPower + 15),
    energy: clampStat(state.energy + 5),
    stress: clampStat(state.stress - 8),
  }
}
