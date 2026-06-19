import type { PetRuntimeState } from '../../../types/pet'
import type { PetAnimationKey } from '../../assets/manifest'

export type PetHideAnchor = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type PetSceneBridge = {
  getState: () => PetRuntimeState
  getPointer: () => {
    x: number
    y: number
    active: boolean
  }
  getForcedAnimation: () => PetAnimationKey | undefined
  getForcedTilt: () => number | undefined
  getHideAnchors: () => PetHideAnchor[]
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
