import type { CatVariantId } from '../data/catVariants'

export type PetType = 'cat' | 'dog'

export type PetMood =
  | 'relaxed'
  | 'happy'
  | 'hungry'
  | 'sleepy'
  | 'playful'
  | 'bored'
  | 'clingy'
  | 'annoyed'
  | 'scared'
  | 'curious'
  | 'relieved'
  | 'dreaming'
  | 'attention'

export type PetState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'run'
  | 'sleep'
  | 'eat'
  | 'pet_head'
  | 'cheek'
  | 'play'
  | 'dream'
  | 'happy'
  | 'need_attention'
  | 'follow_cursor'

export type PetActionId =
  | 'feed'
  | 'pet_head'
  | 'follow_cursor'
  | 'cheek'
  | 'play'
  | 'sleep'
  | 'wake_up'
  | 'dream'

export type PetStats = {
  hunger: number
  happiness: number
  energy: number
  affection: number
  dreamPower: number
  boredom: number
  cleanliness: number
  stress: number
}

export type PetPersonality = {
  sociability: number
  playfulness: number
  laziness: number
  foodiness: number
  tolerance: number
  curiosity: number
}

export type PetReactionId =
  | 'eat_excited'
  | 'eat_careful'
  | 'sniff_ignore_food'
  | 'purr_accept'
  | 'slow_blink_accept'
  | 'ask_feed'
  | 'overpetted_tail'
  | 'head_bump'
  | 'shy_cheek'
  | 'cheek_reject'
  | 'zoomies'
  | 'lazy_play_reject'
  | 'hungry_play_distracted'
  | 'curl_sleep'
  | 'wake_stretch'
  | 'sleepy_refuse_wake'
  | 'resist_sleep'
  | 'dream_soft'
  | 'dream_guard'

export type PetReaction = {
  id: PetReactionId
  startedAt: number
  durationMs: number
}

export type PetMemory = {
  recentActions: PetActionId[]
  recentReactions: PetReactionId[]
  pettingCountInShortTime: number
  lastReactionAt?: number
  likedLastAction: boolean
}

export type PetPosition = {
  x: number
  y: number
}

export type PetSaveState = PetStats & {
  id: string
  userId?: string
  deviceId: string
  petType: PetType
  catVariantId: CatVariantId
  petName?: string
  mood: PetMood
  state: PetState
  lastCareAt: string
  lastFedAt?: string
  lastPetAt?: string
  lastOpenedAt: string
  position: PetPosition
  widgetPosition?: PetPosition
  personality: PetPersonality
  memory: PetMemory
  createdAt: string
  updatedAt: string
}

export type PetRuntimeState = PetSaveState & {
  actionUntil?: number
  currentReaction?: PetReaction
}

export type PetActionResult = {
  state: PetState
  mood: PetMood
  durationMs?: number
}
