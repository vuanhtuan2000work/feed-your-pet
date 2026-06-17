import { PET_ACTIONS, SLEEPING_PET_ACTIONS } from '../data/petActions'
import { CAT_VARIANTS, getCatVariantPreviewUrl, type CatVariantId } from '../data/catVariants'
import type { PetActionId, PetState } from '../types/pet'

type PetMenuProps = {
  open: boolean
  petState: PetState
  selectedCatVariantId: CatVariantId
  onAction: (action: PetActionId) => void
  onSelectCatVariant: (catVariantId: CatVariantId) => void
}

export function PetMenu({
  open,
  petState,
  selectedCatVariantId,
  onAction,
  onSelectCatVariant,
}: PetMenuProps) {
  if (!open) {
    return null
  }

  const actions = petState === 'sleep' ? SLEEPING_PET_ACTIONS : PET_ACTIONS

  return (
    <div className="pet-menu" role="menu" aria-label="Pet care menu">
      {actions.map((action) => {
        const radius = 82
        const x = Math.cos((action.angle * Math.PI) / 180) * radius
        const y = Math.sin((action.angle * Math.PI) / 180) * radius
        return (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            className="pet-menu__item"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            onClick={() => onAction(action.id)}
            title={action.label}
          >
            <span>{action.icon}</span>
            <small>{action.label}</small>
          </button>
        )
      })}
      <div className="pet-menu__variants" aria-label="Cat selector">
        {CAT_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className="pet-menu__variant"
            aria-pressed={selectedCatVariantId === variant.id}
            title={variant.label}
            onClick={() => onSelectCatVariant(variant.id)}
          >
            <img src={getCatVariantPreviewUrl(variant)} alt="" />
            <span>{variant.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
