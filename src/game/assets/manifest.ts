import {
  CAT_VARIANTS,
  DEFAULT_CAT_VARIANT_ID,
  type CatVariantId,
} from '../../data/catVariants'
import type { PetType } from '../../types/pet'

export type PetAnimationKey =
  | 'idle'
  | 'walk'
  | 'run'
  | 'run_left'
  | 'run_right'
  | 'run_up'
  | 'run_down'
  | 'run_up_left'
  | 'run_up_right'
  | 'run_down_left'
  | 'run_down_right'
  | 'sleep'
  | 'happy'
  | 'pet_head'
  | 'cheek'
  | 'feed'
  | 'play'
  | 'dream'
  | 'attention'
  | 'cat_type'

export type PetFrameAsset = {
  key: string
  textureKey: string
  frame: string
  rect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type PetAnimationAsset = {
  key: string
  frameRate: number
  repeat: number
  frames: PetFrameAsset[]
}

export type PetAssetManifest = {
  petType: PetType
  variantId?: CatVariantId
  enabled: boolean
  sources: Array<{
    key: string
    url: string
  }>
  animations: Record<PetAnimationKey, PetAnimationAsset>
}

const RUN_FRAME_RATE = 9

const rates: Record<PetAnimationKey, number> = {
  idle: 4,
  walk: 8,
  run: RUN_FRAME_RATE,
  run_left: RUN_FRAME_RATE,
  run_right: RUN_FRAME_RATE,
  run_up: RUN_FRAME_RATE,
  run_down: RUN_FRAME_RATE,
  run_up_left: RUN_FRAME_RATE,
  run_up_right: RUN_FRAME_RATE,
  run_down_left: RUN_FRAME_RATE,
  run_down_right: RUN_FRAME_RATE,
  sleep: 3,
  happy: 7,
  pet_head: 6,
  cheek: 6,
  feed: 6,
  play: 10,
  dream: 6,
  attention: 5,
  cat_type: 3,
}

const repeats: Record<PetAnimationKey, number> = {
  idle: -1,
  walk: -1,
  run: -1,
  run_left: -1,
  run_right: -1,
  run_up: -1,
  run_down: -1,
  run_up_left: -1,
  run_up_right: -1,
  run_down_left: -1,
  run_down_right: -1,
  sleep: -1,
  happy: 0,
  pet_head: 0,
  cheek: 0,
  feed: 0,
  play: 0,
  dream: 0,
  attention: -1,
  cat_type: -1,
}

const RUN_FRAME_SIZE = 250
const RUN_FRAME_COUNT = 4

const runSourceDirections = {
  run_down: { fileNumber: 1, sourceSlug: 'down' },
  run_right: { fileNumber: 2, sourceSlug: 'right' },
  run_down_right: { fileNumber: 3, sourceSlug: 'down-right' },
  run_up_right: { fileNumber: 4, sourceSlug: 'up-right' },
  run_up: { fileNumber: 5, sourceSlug: 'up' },
  run_up_left: { fileNumber: 6, sourceSlug: 'up-left' },
  run_left: { fileNumber: 7, sourceSlug: 'left' },
  run_down_left: { fileNumber: 8, sourceSlug: 'down-left' },
} satisfies Record<string, { fileNumber: number; sourceSlug: string }>

type RunSourceKey = keyof typeof runSourceDirections

const runFrameOrder = Array.from({ length: RUN_FRAME_COUNT }, (_, index) => index + 1)

function getCatRunSource(variantId: CatVariantId, sourceKey: RunSourceKey) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  const direction = runSourceDirections[sourceKey]
  return {
    key: `${variant.id}:cat-actions:run:${direction.sourceSlug}`,
    url: `/assets/pet/cat_actions/run/${variant.runFolder}/${direction.fileNumber}-${variant.runFileStem}.png`,
  }
}

function makeRunFrames(
  variantId: CatVariantId,
  sourceKey: RunSourceKey,
  order = runFrameOrder,
): PetFrameAsset[] {
  const source = getCatRunSource(variantId, sourceKey)
  return order.map((frameNumber): PetFrameAsset => {
    const frameId = String(frameNumber).padStart(3, '0')
    return {
      key: `${source.key}:${frameId}`,
      textureKey: source.key,
      frame: `${variantId}:${sourceKey}:${frameId}`,
      rect: {
        x: (frameNumber - 1) * RUN_FRAME_SIZE,
        y: 0,
        width: RUN_FRAME_SIZE,
        height: RUN_FRAME_SIZE,
      },
    }
  })
}

function makeCatActionSequences(variantId: CatVariantId): Record<PetAnimationKey, PetFrameAsset[]> {
  return {
    idle: makeRunFrames(variantId, 'run_down', [2]),
    walk: makeRunFrames(variantId, 'run_right'),
    run: makeRunFrames(variantId, 'run_right'),
    run_left: makeRunFrames(variantId, 'run_left'),
    run_right: makeRunFrames(variantId, 'run_right'),
    run_up: makeRunFrames(variantId, 'run_up'),
    run_down: makeRunFrames(variantId, 'run_down'),
    run_up_left: makeRunFrames(variantId, 'run_up_left'),
    run_up_right: makeRunFrames(variantId, 'run_up_right'),
    run_down_left: makeRunFrames(variantId, 'run_down_left'),
    run_down_right: makeRunFrames(variantId, 'run_down_right'),
    sleep: makeRunFrames(variantId, 'run_up', [2]),
    happy: makeRunFrames(variantId, 'run_down'),
    pet_head: makeRunFrames(variantId, 'run_down', [2, 3, 2]),
    cheek: makeRunFrames(variantId, 'run_down_left', [2, 3, 2]),
    feed: makeRunFrames(variantId, 'run_down', [2, 3, 4]),
    play: makeRunFrames(variantId, 'run_right'),
    dream: makeRunFrames(variantId, 'run_up', [2, 3, 2]),
    attention: makeRunFrames(variantId, 'run_down', [1, 2, 3, 4]),
    cat_type: makeRunFrames(variantId, 'run_down', [2, 3, 2]),
  }
}

function makeCatActionAnimation(
  variantId: CatVariantId,
  key: PetAnimationKey,
  frames: PetFrameAsset[],
): PetAnimationAsset {
  return {
    key: `${variantId}:${key}`,
    frameRate: rates[key],
    repeat: repeats[key],
    frames,
  }
}

function makeCatManifest(variantId: CatVariantId): PetAssetManifest {
  const sequences = makeCatActionSequences(variantId)
  const keys = Object.keys(sequences) as PetAnimationKey[]
  return {
    petType: 'cat',
    variantId,
    enabled: true,
    sources: (Object.keys(runSourceDirections) as RunSourceKey[]).map((sourceKey) =>
      getCatRunSource(variantId, sourceKey),
    ),
    animations: Object.fromEntries(
      keys.map((key) => [key, makeCatActionAnimation(variantId, key, sequences[key])]),
    ) as Record<PetAnimationKey, PetAnimationAsset>,
  }
}

function makeDisabledManifest(petType: PetType): PetAssetManifest {
  const animations = {} as Record<PetAnimationKey, PetAnimationAsset>
  ;(Object.keys(rates) as PetAnimationKey[]).forEach((key) => {
    animations[key] = {
      key: `${petType}:${key}`,
      frameRate: rates[key],
      repeat: repeats[key],
      frames: [],
    }
  })

  return {
    petType,
    enabled: false,
    sources: [],
    animations,
  }
}

export const CAT_VARIANT_MANIFESTS = Object.fromEntries(
  CAT_VARIANTS.map((variant) => [variant.id, makeCatManifest(variant.id)]),
) as Record<CatVariantId, PetAssetManifest>

export function getCatAssetManifest(variantId?: CatVariantId) {
  return CAT_VARIANT_MANIFESTS[variantId ?? DEFAULT_CAT_VARIANT_ID]
}

export const PET_MANIFESTS: Record<PetType, PetAssetManifest> = {
  cat: getCatAssetManifest(),
  dog: makeDisabledManifest('dog'),
}
