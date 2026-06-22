import { GENERATED_CAT_VARIANTS } from './generatedCatVariants'

export const CAT_VARIANTS = GENERATED_CAT_VARIANTS

export type CatVariantId = (typeof CAT_VARIANTS)[number]['id']

export const DEFAULT_CAT_VARIANT_ID: CatVariantId = 'balinese'

export function isCatVariantId(value: unknown): value is CatVariantId {
  return CAT_VARIANTS.some((variant) => variant.id === value)
}

export function getCatVariant(variantId?: CatVariantId | string) {
  return (
    CAT_VARIANTS.find((variant) => variant.id === variantId) ??
    CAT_VARIANTS.find((variant) => variant.id === DEFAULT_CAT_VARIANT_ID) ??
    CAT_VARIANTS[0]
  )
}
