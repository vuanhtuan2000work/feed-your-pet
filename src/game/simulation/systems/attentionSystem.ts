import { ONE_HOUR_MS } from '../../../data/petConfig'
import type { PetRuntimeState } from '../../../types/pet'

export function isUserTyping() {
  const active = document.activeElement as HTMLElement | null
  const tag = active?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(active?.isContentEditable)
}

export function shouldSeekAttention(state: PetRuntimeState, nowMs = Date.now()) {
  return nowMs - Date.parse(state.lastCareAt) >= ONE_HOUR_MS
}

export function applyAttentionState(
  state: PetRuntimeState,
  nowMs = Date.now(),
): PetRuntimeState {
  if (state.state === 'sleep' || state.actionUntil) {
    return state
  }

  if (shouldSeekAttention(state, nowMs)) {
    return {
      ...state,
      state: 'follow_cursor',
      mood: 'attention',
      updatedAt: new Date(nowMs).toISOString(),
    }
  }

  return state
}
