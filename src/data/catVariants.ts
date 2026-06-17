import { GENERATED_CAT_VARIANTS } from './generatedCatVariants'

export const CAT_VARIANTS = GENERATED_CAT_VARIANTS

export type CatVariantId = (typeof CAT_VARIANTS)[number]['id']

export const DEFAULT_CAT_VARIANT_ID: CatVariantId = 'abyssinian'

export function isCatVariantId(value: unknown): value is CatVariantId {
  return CAT_VARIANTS.some((variant) => variant.id === value)
}

export function getCatVariantPreviewUrl(variant: (typeof CAT_VARIANTS)[number]) {
  return `/assets/pet/cat_actions/run/${variant.runFolder}/1-${variant.runFileStem}.png`
}
