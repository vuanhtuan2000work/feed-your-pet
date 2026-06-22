import {
  CAT_VARIANTS,
  DEFAULT_CAT_VARIANT_ID,
  type CatVariantId,
} from '../../data/catVariants'
import { getAssetUrl } from '../../services/assetUrl'

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
  petType: 'cat'
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
  sleep: 6,
  happy: 7,
  pet_head: 6,
  cheek: 6,
  feed: 6,
  play: 10,
  dream: 6,
  attention: 5,
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
  sleep: 0,
  happy: 0,
  pet_head: 0,
  cheek: 0,
  feed: 0,
  play: 0,
  dream: 0,
  attention: -1,
}

const RUN_FRAME_COUNT = 4
const SLEEP_FRAME_ORDER = [
  { sheetNumber: 1, frameNumber: 4 },
  { sheetNumber: 2, frameNumber: 4 },
] as const

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
type FrameRect = NonNullable<PetFrameAsset['rect']>

const runFrameOrder = Array.from({ length: RUN_FRAME_COUNT }, (_, index) => index + 1)

function getCatRunSource(variantId: CatVariantId, sourceKey: RunSourceKey) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  const direction = runSourceDirections[sourceKey]
  return {
    key: `${variant.id}:cat-actions:run:${direction.sourceSlug}`,
    url: getAssetUrl(
      `assets/pet/cat_actions/run/${variant.runFolder}/${direction.fileNumber}-${variant.runFileStem}.png`,
    ),
  }
}

function getCatSleepSources(variantId: CatVariantId) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  if (!('sleepSheetCount' in variant)) {
    return []
  }

  return Array.from({ length: variant.sleepSheetCount }, (_, index) => {
    const sheetNumber = index + 1
    return {
      key: `${variant.id}:cat-actions:sleep:${sheetNumber}`,
      url: getAssetUrl(
        `assets/pet/cat_actions/sleep/${variant.runFolder}/${sheetNumber}-${variant.runFileStem}.png`,
      ),
    }
  })
}

function getRunSheetSize(variantId: CatVariantId, sourceKey: RunSourceKey) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  if ('runSheetSizes' in variant) {
    const sourceSize = variant.runSheetSizes[sourceKey]
    if (sourceSize) {
      return sourceSize
    }
  }

  return {
    width: variant.runSheetWidth,
    height: variant.runSheetHeight,
  }
}

function getRunFrameRect(variantId: CatVariantId, sourceKey: RunSourceKey, frameNumber: number) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  if ('runFrameRects' in variant) {
    const runFrameRects = variant.runFrameRects as Partial<
      Record<RunSourceKey, readonly FrameRect[]>
    >
    const rect = runFrameRects[sourceKey]?.[frameNumber - 1]
    if (rect) {
      return rect
    }
  }

  const sourceSize = getRunSheetSize(variantId, sourceKey)
  const startX = Math.round(((frameNumber - 1) * sourceSize.width) / RUN_FRAME_COUNT)
  const endX = Math.round((frameNumber * sourceSize.width) / RUN_FRAME_COUNT)

  return {
    x: startX,
    y: 0,
    width: endX - startX,
    height: sourceSize.height,
  }
}

function getSleepFrameRect(variantId: CatVariantId, sheetNumber: number, frameNumber: number) {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  if (!('sleepFrameCount' in variant)) {
    return undefined
  }

  if ('sleepFrameRects' in variant) {
    const rect = variant.sleepFrameRects[sheetNumber - 1]?.[frameNumber - 1]
    if (rect) {
      return rect
    }
  }

  const startX = Math.round(((frameNumber - 1) * variant.sleepSheetWidth) / variant.sleepFrameCount)
  const endX = Math.round((frameNumber * variant.sleepSheetWidth) / variant.sleepFrameCount)

  return {
    x: startX,
    y: 0,
    width: endX - startX,
    height: variant.sleepSheetHeight,
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
      rect: getRunFrameRect(variantId, sourceKey, frameNumber),
    }
  })
}

function makeSleepFrames(variantId: CatVariantId): PetFrameAsset[] {
  const variant = CAT_VARIANTS.find((item) => item.id === variantId) ?? CAT_VARIANTS[0]
  if (!('sleepSheetCount' in variant)) {
    return makeRunFrames(variantId, 'run_up', [2])
  }

  return SLEEP_FRAME_ORDER.filter(
    ({ sheetNumber, frameNumber }) =>
      sheetNumber <= variant.sleepSheetCount && frameNumber <= variant.sleepFrameCount,
  ).map(({ sheetNumber, frameNumber }) => {
    const textureKey = `${variant.id}:cat-actions:sleep:${sheetNumber}`
    const frameId = String(frameNumber).padStart(3, '0')
    return {
      key: `${textureKey}:${frameId}`,
      textureKey,
      frame: `${variant.id}:sleep:${sheetNumber}:${frameId}`,
      rect: getSleepFrameRect(variantId, sheetNumber, frameNumber),
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
    sleep: makeSleepFrames(variantId),
    happy: makeRunFrames(variantId, 'run_down'),
    pet_head: makeRunFrames(variantId, 'run_down', [2, 3, 2]),
    cheek: makeRunFrames(variantId, 'run_down_left', [2, 3, 2]),
    feed: makeRunFrames(variantId, 'run_down', [2, 3, 4]),
    play: makeRunFrames(variantId, 'run_right'),
    dream: makeRunFrames(variantId, 'run_up', [2, 3, 2]),
    attention: makeRunFrames(variantId, 'run_down', [1, 2, 3, 4]),
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
  const runSources = (Object.keys(runSourceDirections) as RunSourceKey[]).map((sourceKey) =>
    getCatRunSource(variantId, sourceKey),
  )
  return {
    petType: 'cat',
    variantId,
    enabled: true,
    sources: [...runSources, ...getCatSleepSources(variantId)],
    animations: Object.fromEntries(
      keys.map((key) => [key, makeCatActionAnimation(variantId, key, sequences[key])]),
    ) as Record<PetAnimationKey, PetAnimationAsset>,
  }
}

export const CAT_VARIANT_MANIFESTS = Object.fromEntries(
  CAT_VARIANTS.map((variant) => [variant.id, makeCatManifest(variant.id)]),
) as Record<CatVariantId, PetAssetManifest>

export function getCatAssetManifest(variantId?: CatVariantId | string) {
  return (
    CAT_VARIANT_MANIFESTS[variantId as CatVariantId] ??
    CAT_VARIANT_MANIFESTS[DEFAULT_CAT_VARIANT_ID]
  )
}
