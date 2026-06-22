import type { PetActionId } from '../types/pet'

export type PetActionDefinition = {
  id: PetActionId
  icon: string
  label: string
  angle: number
}

export const PET_ACTIONS: PetActionDefinition[] = [
  { id: 'sleep', icon: 'Zz', label: 'Sleep', angle: -90 },
  { id: 'follow_cursor', icon: 'Follow', label: 'Follow', angle: -150 },
]

export const SLEEPING_PET_ACTIONS: PetActionDefinition[] = [
  { id: 'wake_up', icon: 'Wake', label: 'Wake', angle: -90 },
  { id: 'follow_cursor', icon: 'Follow', label: 'Follow', angle: -150 },
]
