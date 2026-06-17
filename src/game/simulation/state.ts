import {
  DEFAULT_MEMORY,
  DEFAULT_PERSONALITY,
  DEFAULT_STATS,
} from '../../data/petConfig'
import { DEFAULT_CAT_VARIANT_ID, isCatVariantId } from '../../data/catVariants'
import type {
  PetMemory,
  PetPersonality,
  PetRuntimeState,
  PetSaveState,
} from '../../types/pet'

export function clampStat(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function createDefaultPetState(deviceId: string): PetRuntimeState {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    deviceId,
    petType: 'cat',
    catVariantId: DEFAULT_CAT_VARIANT_ID,
    mood: 'happy',
    state: 'idle',
    ...DEFAULT_STATS,
    personality: { ...DEFAULT_PERSONALITY },
    memory: {
      recentActions: [...DEFAULT_MEMORY.recentActions],
      recentReactions: [...DEFAULT_MEMORY.recentReactions],
      pettingCountInShortTime: DEFAULT_MEMORY.pettingCountInShortTime,
      likedLastAction: DEFAULT_MEMORY.likedLastAction,
    },
    lastCareAt: now,
    lastOpenedAt: now,
    position: { x: 110, y: 190 },
    createdAt: now,
    updatedAt: now,
  }
}

function normalizePersonality(
  personality: Partial<PetPersonality> | undefined,
): PetPersonality {
  return {
    sociability: clampStat(personality?.sociability ?? DEFAULT_PERSONALITY.sociability),
    playfulness: clampStat(personality?.playfulness ?? DEFAULT_PERSONALITY.playfulness),
    laziness: clampStat(personality?.laziness ?? DEFAULT_PERSONALITY.laziness),
    foodiness: clampStat(personality?.foodiness ?? DEFAULT_PERSONALITY.foodiness),
    tolerance: clampStat(personality?.tolerance ?? DEFAULT_PERSONALITY.tolerance),
    curiosity: clampStat(personality?.curiosity ?? DEFAULT_PERSONALITY.curiosity),
  }
}

function normalizeMemory(memory: Partial<PetMemory> | undefined): PetMemory {
  return {
    recentActions: memory?.recentActions?.slice(-8) ?? [],
    recentReactions: memory?.recentReactions?.slice(-8) ?? [],
    pettingCountInShortTime: Math.max(
      0,
      Math.min(12, Math.round(memory?.pettingCountInShortTime ?? 0)),
    ),
    lastReactionAt: memory?.lastReactionAt,
    likedLastAction: memory?.likedLastAction ?? true,
  }
}

export function normalizePetState(
  state: Partial<PetSaveState> | null,
  deviceId: string,
): PetRuntimeState {
  const fallback = createDefaultPetState(deviceId)
  if (!state) {
    return fallback
  }

  return {
    ...fallback,
    ...state,
    id: state.id || fallback.id,
    deviceId: state.deviceId || deviceId,
    petType: state.petType === 'dog' ? 'dog' : 'cat',
    catVariantId: isCatVariantId(state.catVariantId)
      ? state.catVariantId
      : fallback.catVariantId,
    hunger: clampStat(state.hunger ?? fallback.hunger),
    happiness: clampStat(state.happiness ?? fallback.happiness),
    energy: clampStat(state.energy ?? fallback.energy),
    affection: clampStat(state.affection ?? fallback.affection),
    dreamPower: clampStat(state.dreamPower ?? fallback.dreamPower),
    boredom: clampStat(state.boredom ?? fallback.boredom),
    cleanliness: clampStat(state.cleanliness ?? fallback.cleanliness),
    stress: clampStat(state.stress ?? fallback.stress),
    position: state.position ?? fallback.position,
    personality: normalizePersonality(state.personality),
    memory: normalizeMemory(state.memory),
    updatedAt: new Date().toISOString(),
  }
}

export function toSaveState(state: PetRuntimeState): PetSaveState {
  return {
    id: state.id,
    userId: state.userId,
    deviceId: state.deviceId,
    petType: state.petType,
    catVariantId: state.catVariantId,
    petName: state.petName,
    mood: state.mood,
    state: state.state,
    hunger: state.hunger,
    happiness: state.happiness,
    energy: state.energy,
    affection: state.affection,
    dreamPower: state.dreamPower,
    boredom: state.boredom,
    cleanliness: state.cleanliness,
    stress: state.stress,
    lastCareAt: state.lastCareAt,
    lastFedAt: state.lastFedAt,
    lastPetAt: state.lastPetAt,
    lastOpenedAt: state.lastOpenedAt,
    position: state.position,
    personality: state.personality,
    memory: state.memory,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  }
}
