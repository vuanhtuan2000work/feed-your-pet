import { useEffect, useRef } from 'react'
import { createPetGame } from '../game/phaser/createPetGame'
import type { PetSceneBridge } from '../game/phaser/adapters/sceneBridge'
import type { PetAnimationKey } from '../game/assets/manifest'
import type { PetRuntimeState } from '../types/pet'

type PetCanvasProps = {
  active: boolean
  state: PetRuntimeState
  pointer: {
    x: number
    y: number
    active: boolean
  }
  forcedAnimation?: PetAnimationKey
  forcedTilt?: number
  onPetClick: () => void
  onPositionChange: (x: number, y: number) => void
}

export function PetCanvas({
  active,
  state,
  pointer,
  forcedAnimation,
  forcedTilt,
  onPetClick,
  onPositionChange,
}: PetCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<ReturnType<typeof createPetGame> | null>(null)
  const stateRef = useRef(state)
  const pointerRef = useRef(pointer)
  const forcedAnimationRef = useRef(forcedAnimation)
  const forcedTiltRef = useRef(forcedTilt)
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
    onPetClickRef.current = onPetClick
  }, [onPetClick])

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      gameRef.current?.loop.sleep()
      return
    }

    if (!gameRef.current && hostRef.current) {
      const bridge: PetSceneBridge = {
        getState: () => stateRef.current,
        getPointer: () => pointerRef.current,
        getForcedAnimation: () => forcedAnimationRef.current,
        getForcedTilt: () => forcedTiltRef.current,
        onPetClick: () => onPetClickRef.current(),
        onPositionChange: (x, y) => onPositionChangeRef.current(x, y),
      }
      gameRef.current = createPetGame(hostRef.current, bridge)
      return
    }

    gameRef.current?.loop.wake()
  }, [active])

  return (
    <div
      ref={hostRef}
      className="pet-canvas"
      aria-label="Pet companion"
      onPointerDown={() => onPetClickRef.current()}
    />
  )
}
