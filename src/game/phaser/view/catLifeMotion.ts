import type { PetAnimationKey } from '../../assets/manifest'
import type { MotionMood } from './petMotion'
import type { PetRuntimeState } from '../../../types/pet'

export type MicroBehaviorId =
  | 'slow_blink'
  | 'soft_breathe'
  | 'paw_groom'
  | 'sniff_air'
  | 'watch_cursor'
  | 'loaf_pause'
  | 'tiny_pounce'
  | 'bored_paw_tap'
  | 'annoyed_tail'
  | 'sleepy_yawn'
  | 'curious_step'

export type MicroBehaviorProfile = {
  id: MicroBehaviorId
  animation: PetAnimationKey
  mood: MotionMood
  durationMs: number
  lean: number
  hop: number
  scalePulse: number
}

const MICRO_PROFILES: Record<MicroBehaviorId, MicroBehaviorProfile> = {
  slow_blink: {
    id: 'slow_blink',
    animation: 'idle',
    mood: 'soft',
    durationMs: 2_400,
    lean: 0,
    hop: 0,
    scalePulse: 0.018,
  },
  soft_breathe: {
    id: 'soft_breathe',
    animation: 'idle',
    mood: 'soft',
    durationMs: 2_800,
    lean: 1,
    hop: 0,
    scalePulse: 0.014,
  },
  paw_groom: {
    id: 'paw_groom',
    animation: 'pet_head',
    mood: 'soft',
    durationMs: 2_700,
    lean: -2,
    hop: 0,
    scalePulse: 0.018,
  },
  sniff_air: {
    id: 'sniff_air',
    animation: 'attention',
    mood: 'wary',
    durationMs: 2_100,
    lean: -4,
    hop: 5,
    scalePulse: 0.02,
  },
  watch_cursor: {
    id: 'watch_cursor',
    animation: 'attention',
    mood: 'wary',
    durationMs: 2_300,
    lean: -3,
    hop: 3,
    scalePulse: 0.018,
  },
  loaf_pause: {
    id: 'loaf_pause',
    animation: 'sleep',
    mood: 'sleepy',
    durationMs: 3_100,
    lean: 0,
    hop: 0,
    scalePulse: 0.012,
  },
  tiny_pounce: {
    id: 'tiny_pounce',
    animation: 'play',
    mood: 'playful',
    durationMs: 2_000,
    lean: -7,
    hop: 14,
    scalePulse: 0.05,
  },
  bored_paw_tap: {
    id: 'bored_paw_tap',
    animation: 'attention',
    mood: 'wary',
    durationMs: 2_200,
    lean: 2,
    hop: 2,
    scalePulse: 0.018,
  },
  annoyed_tail: {
    id: 'annoyed_tail',
    animation: 'pet_head',
    mood: 'reject',
    durationMs: 2_000,
    lean: 8,
    hop: 0,
    scalePulse: 0.016,
  },
  sleepy_yawn: {
    id: 'sleepy_yawn',
    animation: 'sleep',
    mood: 'sleepy',
    durationMs: 2_600,
    lean: 1,
    hop: 0,
    scalePulse: 0.025,
  },
  curious_step: {
    id: 'curious_step',
    animation: 'walk',
    mood: 'wary',
    durationMs: 1_900,
    lean: -4,
    hop: 4,
    scalePulse: 0.025,
  },
}

type WeightedMicro = [MicroBehaviorId, number]

function weightedPick(options: WeightedMicro[]) {
  const usable = options.filter(([, weight]) => weight > 0)
  const total = usable.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = Math.random() * total
  for (const [id, weight] of usable) {
    roll -= weight
    if (roll <= 0) {
      return MICRO_PROFILES[id]
    }
  }
  return MICRO_PROFILES.soft_breathe
}

export function chooseMicroBehavior(pet: PetRuntimeState): MicroBehaviorProfile {
  const hungerNeed = 100 - pet.hunger

  if (pet.stress > 68) {
    return weightedPick([
      ['annoyed_tail', 42],
      ['watch_cursor', 24],
      ['sniff_air', 16],
      ['soft_breathe', 8],
    ])
  }

  if (hungerNeed > 62) {
    return weightedPick([
      ['watch_cursor', 44],
      ['sniff_air', 32],
      ['bored_paw_tap', 16],
      ['curious_step', 8],
    ])
  }

  if (pet.energy < 34 || pet.personality.laziness > 72) {
    return weightedPick([
      ['loaf_pause', 44],
      ['sleepy_yawn', 28],
      ['slow_blink', 20],
      ['paw_groom', 8],
    ])
  }

  if (pet.boredom > 66 || pet.personality.playfulness > 74) {
    return weightedPick([
      ['tiny_pounce', 36],
      ['bored_paw_tap', 28],
      ['curious_step', 20],
      ['watch_cursor', 16],
    ])
  }

  if (pet.cleanliness < 42) {
    return weightedPick([
      ['paw_groom', 52],
      ['sniff_air', 16],
      ['slow_blink', 16],
      ['soft_breathe', 16],
    ])
  }

  return weightedPick([
    ['slow_blink', 28],
    ['soft_breathe', 24],
    ['paw_groom', 18],
    ['sniff_air', pet.personality.curiosity],
    ['watch_cursor', pet.personality.sociability / 2],
    ['loaf_pause', pet.personality.laziness / 3],
  ])
}
