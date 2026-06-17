import { useEffect, useRef } from 'react'
import { createPetGame } from '../game/phaser/createPetGame'
import type { PetSceneBridge } from '../game/phaser/adapters/sceneBridge'
import type { PetRuntimeState } from '../types/pet'

type PetCanvasProps = {
  state: PetRuntimeState
  pointer: {
    x: number
    y: number
    active: boolean
  }
  onPetClick: () => void
  onPositionChange: (x: number, y: number) => void
}

export function PetCanvas({ state, pointer, onPetClick, onPositionChange }: PetCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef(state)
  const pointerRef = useRef(pointer)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    pointerRef.current = pointer
  }, [pointer])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const bridge: PetSceneBridge = {
      getState: () => stateRef.current,
      getPointer: () => pointerRef.current,
      onPetClick,
      onPositionChange,
    }

    const game = createPetGame(hostRef.current, bridge)
    return () => game.destroy(true)
  }, [onPetClick, onPositionChange])

  return <div ref={hostRef} className="pet-canvas" aria-label="Pet companion" />
}
