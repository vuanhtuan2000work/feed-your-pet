import type { PetActionId } from '../types/pet'

export type PetActionDefinition = {
  id: PetActionId
  icon: string
  label: string
  angle: number
}

export const PET_ACTIONS: PetActionDefinition[] = [
  { id: 'sleep', icon: 'Zz', label: 'Sleep', angle: -90 },
  { id: 'pet_head', icon: 'Pat', label: 'Pet', angle: -150 },
  { id: 'feed', icon: 'Food', label: 'Feed', angle: -30 },
  { id: 'cheek', icon: 'Cute', label: 'Cheek', angle: 150 },
  { id: 'play', icon: 'Ball', label: 'Play', angle: 30 },
  { id: 'dream', icon: 'Moon', label: 'Dream', angle: 90 },
]

export const SLEEPING_PET_ACTIONS: PetActionDefinition[] = [
  { id: 'wake_up', icon: 'Wake', label: 'Wake', angle: -90 },
  { id: 'pet_head', icon: 'Pat', label: 'Pet', angle: -150 },
  { id: 'feed', icon: 'Food', label: 'Feed', angle: -30 },
]
