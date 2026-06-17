export const CAT_VARIANTS = [
  {
    id: 'abyssinian',
    label: 'Abyssinian',
    runFolder: '1-Abyssinian-lengend',
    runFileStem: 'Abyssinian-lengend',
  },
  {
    id: 'american_bobtail',
    label: 'American Bobtail',
    runFolder: '2-American_Bobtail-lengend',
    runFileStem: 'American_Bobtail-lengend',
  },
  {
    id: 'american_curl',
    label: 'American Curl',
    runFolder: '3-American_Curl-lengend',
    runFileStem: 'American_Curl-lengend',
  },
] as const

export type CatVariantId = (typeof CAT_VARIANTS)[number]['id']

export const DEFAULT_CAT_VARIANT_ID: CatVariantId = 'abyssinian'

export function isCatVariantId(value: unknown): value is CatVariantId {
  return CAT_VARIANTS.some((variant) => variant.id === value)
}

export function getCatVariantPreviewUrl(variant: (typeof CAT_VARIANTS)[number]) {
  return `/assets/pet/cat_actions/run/${variant.runFolder}/1-${variant.runFileStem}.png`
}
