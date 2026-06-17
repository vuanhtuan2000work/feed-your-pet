import type { PetRuntimeState } from '../../../types/pet'

export type PetSceneBridge = {
  getState: () => PetRuntimeState
  getPointer: () => {
    x: number
    y: number
    active: boolean
  }
  onPetClick: () => void
  onPositionChange: (x: number, y: number) => void
}

let activeBridge: PetSceneBridge | undefined

export function setActivePetSceneBridge(bridge: PetSceneBridge) {
  activeBridge = bridge
}

export function getActivePetSceneBridge() {
  return activeBridge
}
