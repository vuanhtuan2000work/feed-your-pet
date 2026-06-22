import { PET_ACTIONS, SLEEPING_PET_ACTIONS } from '../data/petActions'
import type { PetActionId, PetState } from '../types/pet'

type PetMenuProps = {
  open: boolean
  petState: PetState
  onAction: (action: PetActionId) => void
}

export function PetMenu({
  open,
  petState,
  onAction,
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
    </div>
  )
}
