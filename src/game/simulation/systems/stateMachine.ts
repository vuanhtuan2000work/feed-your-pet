import type { PetRuntimeState } from '../../../types/pet'

export function resolveTimedState(
  state: PetRuntimeState,
  nowMs = Date.now(),
): PetRuntimeState {
  if (!state.actionUntil || nowMs < state.actionUntil) {
    return state
  }

  const completedReaction = state.currentReaction?.id
  if (completedReaction === 'curl_sleep') {
    return {
      ...state,
      actionUntil: undefined,
      currentReaction: undefined,
      state: 'sleep',
      mood: 'sleepy',
      updatedAt: new Date(nowMs).toISOString(),
    }
  }

  if (completedReaction === 'sleepy_refuse_wake') {
    return {
      ...state,
      actionUntil: undefined,
      currentReaction: undefined,
      state: 'sleep',
      mood: 'sleepy',
      updatedAt: new Date(nowMs).toISOString(),
    }
  }

  if (completedReaction === 'wake_stretch') {
    return {
      ...state,
      actionUntil: undefined,
      currentReaction: undefined,
      state: 'run',
      mood: 'playful',
      updatedAt: new Date(nowMs).toISOString(),
    }
  }

  return {
    ...state,
    actionUntil: undefined,
    currentReaction: undefined,
    state: 'happy',
    mood:
      state.stress > 62
        ? 'annoyed'
        : state.hunger < 35
          ? 'hungry'
          : state.boredom > 72
            ? 'bored'
            : 'relaxed',
    updatedAt: new Date(nowMs).toISOString(),
  }
}
