import type {
  PetActionId,
  PetMemory,
  PetMood,
  PetReactionId,
  PetRuntimeState,
  PetState,
} from '../../../types/pet'

type WeightedReaction = [PetReactionId, number]

export type ReactionDecision = {
  reaction: PetReactionId
  state: PetState
  mood: PetMood
  durationMs: number
  liked: boolean
}

function weightedPick(options: WeightedReaction[]): PetReactionId {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = Math.random() * total
  for (const [reaction, weight] of options) {
    roll -= weight
    if (roll <= 0) {
      return reaction
    }
  }
  return options[options.length - 1][0]
}

function decision(
  reaction: PetReactionId,
  state: PetState,
  mood: PetMood,
  durationMs: number,
  liked = true,
): ReactionDecision {
  return { reaction, state, mood, durationMs, liked }
}

export function decideReaction(
  pet: PetRuntimeState,
  action: PetActionId,
): ReactionDecision {
  const hungerNeed = 100 - pet.hunger
  const overpetted =
    pet.memory.pettingCountInShortTime >
    Math.max(2, Math.round(pet.personality.tolerance / 22))

  if (
    pet.state === 'sleep' &&
    (action === 'wake_up' || action === 'pet_head' || action === 'feed')
  ) {
    return decision('zoomies', 'run', 'playful', 22_000)
  }

  if (pet.state === 'sleep') {
    return decision('sleepy_refuse_wake', 'sleep', 'sleepy', 0, false)
  }

  if (action === 'wake_up') {
    return decision('slow_blink_accept', 'idle', 'curious', 1_800, false)
  }

  if (action === 'feed') {
    if (pet.hunger > 88) {
      return decision('sniff_ignore_food', 'idle', 'curious', 1_900, false)
    }

    if (pet.stress > 68) {
      return decision('eat_careful', 'eat', 'curious', 3_100)
    }

    if (hungerNeed > 55 || pet.personality.foodiness > 72) {
      return decision(
        weightedPick([
          ['eat_excited', 50],
          ['eat_careful', pet.stress > 35 ? 20 : 5],
          ['sniff_ignore_food', hungerNeed < 25 ? 12 : 0],
        ]),
        'eat',
        'happy',
        3_000,
      )
    }

    return decision('eat_careful', 'eat', 'relaxed', 2_600)
  }

  if (action === 'pet_head') {
    if (overpetted || pet.stress > 72) {
      return decision('overpetted_tail', 'pet_head', 'annoyed', 2_400, false)
    }

    if (hungerNeed > 62) {
      return decision('ask_feed', 'pet_head', 'hungry', 2_300, false)
    }

    if (pet.energy < 28 || pet.mood === 'sleepy') {
      return decision('slow_blink_accept', 'pet_head', 'sleepy', 2_800)
    }

    if (pet.affection > 72 && pet.personality.sociability > 58) {
      return decision('head_bump', 'pet_head', 'clingy', 2_600)
    }

    return decision(
      weightedPick([
        ['purr_accept', 60],
        ['slow_blink_accept', 24],
        ['head_bump', pet.affection > 55 ? 22 : 6],
      ]),
      'pet_head',
      'relieved',
      2_500,
    )
  }

  if (action === 'cheek') {
    if (overpetted || pet.stress > 58) {
      return decision('cheek_reject', 'cheek', 'annoyed', 2_000, false)
    }

    return decision('shy_cheek', 'cheek', 'happy', 2_200)
  }

  if (action === 'play') {
    if (hungerNeed > 66) {
      return decision('hungry_play_distracted', 'play', 'hungry', 2_400, false)
    }

    if (pet.energy < 30 || pet.personality.laziness > 78) {
      return decision('lazy_play_reject', 'play', 'sleepy', 2_200, false)
    }

    return decision('zoomies', 'play', 'playful', 3_500)
  }

  if (action === 'sleep') {
    return decision('curl_sleep', 'sleep', 'sleepy', 3_800)
  }

  if (pet.dreamPower > 55 || pet.stress > 45) {
    return decision('dream_guard', 'dream', 'dreaming', 3_800)
  }

  return decision('dream_soft', 'dream', 'dreaming', 3_200)
}

export function rememberReaction(
  memory: PetMemory,
  action: PetActionId,
  reaction: PetReactionId,
  liked: boolean,
  nowMs: number,
): PetMemory {
  const wasRecentPet =
    action === 'pet_head' &&
    memory.lastReactionAt !== undefined &&
    nowMs - memory.lastReactionAt < 18_000

  return {
    recentActions: [...memory.recentActions, action].slice(-8),
    recentReactions: [...memory.recentReactions, reaction].slice(-8),
    pettingCountInShortTime:
      action === 'pet_head' ? (wasRecentPet ? memory.pettingCountInShortTime + 1 : 1) : 0,
    lastReactionAt: nowMs,
    likedLastAction: liked,
  }
}
