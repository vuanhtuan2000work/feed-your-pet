import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PetCanvas } from './PetCanvas'
import { PetMenu } from './PetMenu'
import { PetMoodIcon } from './PetMoodIcon'
import { usePetStore } from '../store/petStore'
import { isUserTyping } from '../game/simulation/systems/attentionSystem'

const WIDGET_SIZE = 220
const CHASE_DISTANCE = 96

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function PetWidget() {
  const widgetRef = useRef<HTMLElement | null>(null)
  const state = usePetStore((store) => store.state)
  const menuOpen = usePetStore((store) => store.menuOpen)
  const setMenuOpen = usePetStore((store) => store.setMenuOpen)
  const performAction = usePetStore((store) => store.performAction)
  const selectCatVariant = usePetStore((store) => store.selectCatVariant)
  const tick = usePetStore((store) => store.tick)
  const setPosition = usePetStore((store) => store.setPosition)
  const hydrateRemote = usePetStore((store) => store.hydrateRemote)
  const [cursor, setCursor] = useState({
    x: window.innerWidth - 134,
    y: window.innerHeight - 134,
    active: false,
  })
  const cursorIdleTimerRef = useRef<number | undefined>(undefined)
  const [chasePosition, setChasePosition] = useState({
    x: window.innerWidth - WIDGET_SIZE - 24,
    y: window.innerHeight - WIDGET_SIZE - 24,
  })
  const [widgetSize, setWidgetSize] = useState({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
  })

  useEffect(() => {
    void hydrateRemote()
  }, [hydrateRemote])

  useEffect(() => {
    const interval = window.setInterval(tick, 1_000)
    return () => window.clearInterval(interval)
  }, [tick])

  useEffect(() => {
    if (!widgetRef.current) {
      return
    }

    const updateSize = () => {
      if (!widgetRef.current) {
        return
      }

      const bounds = widgetRef.current.getBoundingClientRect()
      setWidgetSize({
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(widgetRef.current)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      setCursor({ x: event.clientX, y: event.clientY, active: true })
      window.clearTimeout(cursorIdleTimerRef.current)
      cursorIdleTimerRef.current = window.setTimeout(() => {
        setCursor((current) => ({ ...current, active: false }))
      }, 8_000)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.clearTimeout(cursorIdleTimerRef.current)
    }
  }, [])

  const shouldChaseCursor =
    !menuOpen &&
    !isUserTyping() &&
    state.state !== 'sleep' &&
    state.state !== 'dream' &&
    state.state !== 'eat' &&
    cursor.active

  useEffect(() => {
    if (!shouldChaseCursor) {
      return
    }

    let frameId = 0
    const tickChase = () => {
      setChasePosition((current) => {
        const centerX = current.x + widgetSize.width / 2
        const centerY = current.y + widgetSize.height / 2
        const dx = cursor.x - centerX
        const dy = cursor.y - centerY
        const distance = Math.max(1, Math.hypot(dx, dy))
        const followStrength =
          state.state === 'follow_cursor' || state.mood === 'playful' ? 0.14 : 0.075
        const desiredCenterX = cursor.x - (dx / distance) * CHASE_DISTANCE
        const desiredCenterY = cursor.y - (dy / distance) * CHASE_DISTANCE
        const targetX = clamp(
          desiredCenterX - widgetSize.width / 2,
          8,
          window.innerWidth - widgetSize.width - 8,
        )
        const targetY = clamp(
          desiredCenterY - widgetSize.height / 2,
          8,
          window.innerHeight - widgetSize.height - 8,
        )

        return {
          x: current.x + (targetX - current.x) * followStrength,
          y: current.y + (targetY - current.y) * followStrength,
        }
      })
      frameId = window.requestAnimationFrame(tickChase)
    }

    frameId = window.requestAnimationFrame(tickChase)
    return () => window.cancelAnimationFrame(frameId)
  }, [
    cursor.x,
    cursor.y,
    shouldChaseCursor,
    state.mood,
    state.state,
    widgetSize.height,
    widgetSize.width,
  ])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.pet-widget')) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen, setMenuOpen])

  const handlePetClick = useCallback(() => {
    setMenuOpen(!menuOpen)
  }, [menuOpen, setMenuOpen])

  const handlePositionChange = useCallback(
    (x: number, y: number) => {
      setPosition(x, y)
    },
    [setPosition],
  )

  const widgetStyle = useMemo(() => {
    if (!shouldChaseCursor) {
      return undefined
    }

    return {
      left: `${chasePosition.x}px`,
      top: `${chasePosition.y}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }, [chasePosition.x, chasePosition.y, shouldChaseCursor])

  return (
    <aside ref={widgetRef} className="pet-widget" style={widgetStyle} aria-live="polite">
      <PetMoodIcon mood={state.mood} />
      <PetMenu
        open={menuOpen}
        petState={state.state}
        selectedCatVariantId={state.catVariantId}
        onAction={performAction}
        onSelectCatVariant={selectCatVariant}
      />
      <PetCanvas
        state={state}
        pointer={cursor}
        onPetClick={handlePetClick}
        onPositionChange={handlePositionChange}
      />
    </aside>
  )
}
