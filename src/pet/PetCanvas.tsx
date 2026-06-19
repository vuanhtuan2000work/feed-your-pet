import { useEffect, useRef } from 'react'
import { createPetGame } from '../game/phaser/createPetGame'
import type {
  PetHideAnchor,
  PetSceneBridge,
} from '../game/phaser/adapters/sceneBridge'
import type { PetAnimationKey } from '../game/assets/manifest'
import type { PetRuntimeState } from '../types/pet'

type PetCanvasProps = {
  state: PetRuntimeState
  pointer: {
    x: number
    y: number
    active: boolean
  }
  forcedAnimation?: PetAnimationKey
  forcedTilt?: number
  hideAnchors: PetHideAnchor[]
  onPetClick: () => void
  onPositionChange: (x: number, y: number) => void
}

export function PetCanvas({
  state,
  pointer,
  forcedAnimation,
  forcedTilt,
  hideAnchors,
  onPetClick,
  onPositionChange,
}: PetCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef(state)
  const pointerRef = useRef(pointer)
  const forcedAnimationRef = useRef(forcedAnimation)
  const forcedTiltRef = useRef(forcedTilt)
  const hideAnchorsRef = useRef(hideAnchors)
  const onPetClickRef = useRef(onPetClick)
  const onPositionChangeRef = useRef(onPositionChange)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    pointerRef.current = pointer
  }, [pointer])

  useEffect(() => {
    forcedAnimationRef.current = forcedAnimation
  }, [forcedAnimation])

  useEffect(() => {
    forcedTiltRef.current = forcedTilt
  }, [forcedTilt])

  useEffect(() => {
    hideAnchorsRef.current = hideAnchors
  }, [hideAnchors])

  useEffect(() => {
    onPetClickRef.current = onPetClick
  }, [onPetClick])

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const bridge: PetSceneBridge = {
      getState: () => stateRef.current,
      getPointer: () => pointerRef.current,
      getForcedAnimation: () => forcedAnimationRef.current,
      getForcedTilt: () => forcedTiltRef.current,
      getHideAnchors: () => hideAnchorsRef.current,
      onPetClick: () => onPetClickRef.current(),
      onPositionChange: (x, y) => onPositionChangeRef.current(x, y),
    }

    const game = createPetGame(hostRef.current, bridge)
    return () => game.destroy(true)
  }, [])

  return <div ref={hostRef} className="pet-canvas" aria-label="Pet companion" />
}
