import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PetCanvas } from './PetCanvas'
import { PetMenu } from './PetMenu'
import { PetMoodIcon } from './PetMoodIcon'
import { usePetStore } from '../store/petStore'
import { isUserTyping } from '../game/simulation/systems/attentionSystem'
import { ACTIVE_TAB_KEY, CURSOR_OWNER_KEY } from '../data/petConfig'
import {
  CURRENT_TAB_ID,
  createTabTravelBroadcast,
  readCursorOwner,
  type CursorOwnerEvent,
} from '../services/tabTravelSync'

const WIDGET_SIZE = 220
const CHASE_DISTANCE = 96
const TAB_ID = CURRENT_TAB_ID
const ACTIVE_TAB_TTL_MS = 2_500

type ActiveTabRecord = {
  tabId: string
  timestamp: number
}

type WidgetPosition = {
  x: number
  y: number
}

type CursorEventLike = MouseEvent | PointerEvent

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function readActiveTab() {
  const raw = window.localStorage.getItem(ACTIVE_TAB_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ActiveTabRecord
  } catch {
    return null
  }
}

function claimActiveTab() {
  window.localStorage.setItem(
    ACTIVE_TAB_KEY,
    JSON.stringify({ tabId: TAB_ID, timestamp: Date.now() } satisfies ActiveTabRecord),
  )
}

function shouldOwnPetInitially() {
  const activeTab = readActiveTab()
  if (!activeTab || Date.now() - activeTab.timestamp > ACTIVE_TAB_TTL_MS) {
    claimActiveTab()
    return true
  }

  return activeTab.tabId === TAB_ID
}

function getCursorAnchoredPosition(cursor: WidgetPosition) {
  return {
    x: clamp(cursor.x - WIDGET_SIZE / 2, 8, window.innerWidth - WIDGET_SIZE - 8),
    y: clamp(cursor.y - WIDGET_SIZE / 2, 8, window.innerHeight - WIDGET_SIZE - 8),
  }
}

function isCurrentCursorOwnerEvent(event: CursorOwnerEvent) {
  const owner = readCursorOwner()
  return (
    owner?.tabId === event.tabId &&
    owner.timestamp === event.timestamp &&
    owner.cursor.x === event.cursor.x &&
    owner.cursor.y === event.cursor.y
  )
}

function isMouseInput(event: CursorEventLike) {
  return !('pointerType' in event) || event.pointerType === 'mouse'
}

export function PetWidget() {
  const widgetRef = useRef<HTMLElement | null>(null)
  const visibleRef = useRef(false)
  const ownerTabRef = useRef<string | undefined>(undefined)
  const cursorOwnerSignatureRef = useRef<string | undefined>(undefined)
  const cursorIdleTimerRef = useRef<number | undefined>(undefined)
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
  const [petVisible, setPetVisible] = useState(shouldOwnPetInitially)
  const [chasePosition, setChasePosition] = useState({
    x: window.innerWidth - WIDGET_SIZE - 24,
    y: window.innerHeight - WIDGET_SIZE - 24,
  })
  const [widgetSize, setWidgetSize] = useState({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
  })
  const [petRenderNonce, setPetRenderNonce] = useState(0)

  const showPetAtCursor = useCallback((nextCursor: WidgetPosition) => {
    if (ownerTabRef.current !== TAB_ID) {
      setPetRenderNonce((nonce) => nonce + 1)
    }
    ownerTabRef.current = TAB_ID
    claimActiveTab()
    setCursor({ ...nextCursor, active: true })
    if (!visibleRef.current) {
      setChasePosition(getCursorAnchoredPosition(nextCursor))
    }
    setPetVisible(true)
  }, [])

  const syncCursorOwner = useCallback(
    (owner: CursorOwnerEvent | null) => {
      if (!owner) {
        return
      }

      const signature = `${owner.tabId}:${owner.timestamp}:${owner.cursor.x}:${owner.cursor.y}`
      if (cursorOwnerSignatureRef.current === signature) {
        return
      }
      cursorOwnerSignatureRef.current = signature

      if (owner.tabId === TAB_ID) {
        showPetAtCursor(owner.cursor)
        return
      }

      ownerTabRef.current = owner.tabId
      window.clearTimeout(cursorIdleTimerRef.current)
      setCursor((current) => ({ ...current, active: false }))
      setPetVisible(false)
      setMenuOpen(false)
    },
    [setMenuOpen, showPetAtCursor],
  )

  useEffect(() => {
    visibleRef.current = petVisible
    if (petVisible) {
      claimActiveTab()
    }
  }, [petVisible])

  useEffect(() => {
    const travel = createTabTravelBroadcast((event) => {
      if (event.type !== 'PET_CURSOR_OWNER' || !isCurrentCursorOwnerEvent(event)) {
        return
      }

      syncCursorOwner(event)
    })

    return () => travel.close()
  }, [syncCursorOwner])

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === CURSOR_OWNER_KEY) {
        syncCursorOwner(readCursorOwner())
      }
    }

    const interval = window.setInterval(() => {
      syncCursorOwner(readCursorOwner())
    }, 100)

    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [syncCursorOwner])

  useEffect(() => {
    void hydrateRemote()
  }, [hydrateRemote])

  useEffect(() => {
    const interval = window.setInterval(tick, 1_000)
    return () => window.clearInterval(interval)
  }, [tick])

  useEffect(() => {
    if (!petVisible) {
      return
    }

    const interval = window.setInterval(claimActiveTab, 750)
    return () => window.clearInterval(interval)
  }, [petVisible])

  useEffect(() => {
    if (petVisible) {
      return
    }

    const claimIfOwnerExpired = () => {
      const activeTab = readActiveTab()
      if (!activeTab || Date.now() - activeTab.timestamp > ACTIVE_TAB_TTL_MS) {
        claimActiveTab()
        setPetVisible(true)
      }
    }

    const interval = window.setInterval(claimIfOwnerExpired, 1_000)
    return () => window.clearInterval(interval)
  }, [petVisible])

  useEffect(() => {
    const releaseActiveTab = () => {
      const activeTab = readActiveTab()
      if (activeTab?.tabId === TAB_ID) {
        window.localStorage.removeItem(ACTIVE_TAB_KEY)
      }
    }

    window.addEventListener('beforeunload', releaseActiveTab)
    return () => window.removeEventListener('beforeunload', releaseActiveTab)
  }, [])

  useEffect(() => {
    const syncActiveTab = (event: StorageEvent) => {
      if (event.key !== ACTIVE_TAB_KEY) {
        return
      }

      const activeTab = readActiveTab()
      if (activeTab?.tabId !== TAB_ID) {
        setPetVisible(false)
      }
    }

    window.addEventListener('storage', syncActiveTab)
    return () => window.removeEventListener('storage', syncActiveTab)
  }, [])

  useEffect(() => {
    if (!widgetRef.current) {
      return
    }

    const updateSize = () => {
      if (!widgetRef.current) {
        return
      }

      const bounds = widgetRef.current.getBoundingClientRect()
      if (bounds.width < WIDGET_SIZE * 0.75 || bounds.height < WIDGET_SIZE * 0.75) {
        return
      }

      setWidgetSize({
        width: Math.max(WIDGET_SIZE, bounds.width),
        height: Math.max(WIDGET_SIZE, bounds.height),
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(widgetRef.current)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onPointerMove = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      showPetAtCursor({ x: event.clientX, y: event.clientY })
      window.clearTimeout(cursorIdleTimerRef.current)
      cursorIdleTimerRef.current = window.setTimeout(() => {
        setCursor((current) => ({ ...current, active: false }))
      }, 8_000)
    }

    const deactivateCursor = () => {
      window.clearTimeout(cursorIdleTimerRef.current)
      setCursor((current) => ({ ...current, active: false }))
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('mousemove', onPointerMove, { passive: true })
    window.addEventListener('mouseover', onPointerMove, { passive: true })
    window.addEventListener('mouseenter', onPointerMove)
    window.addEventListener('pointerleave', deactivateCursor)
    window.addEventListener('blur', deactivateCursor)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseover', onPointerMove)
      window.removeEventListener('mouseenter', onPointerMove)
      window.removeEventListener('pointerleave', deactivateCursor)
      window.removeEventListener('blur', deactivateCursor)
      window.clearTimeout(cursorIdleTimerRef.current)
    }
  }, [showPetAtCursor])

  const shouldChaseCursor =
    petVisible &&
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
    widgetSize,
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
    if (!petVisible) {
      return { display: 'none' }
    }

    return {
      left: `${chasePosition.x}px`,
      top: `${chasePosition.y}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }, [chasePosition.x, chasePosition.y, petVisible])

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
        key={petRenderNonce}
        state={state}
        pointer={cursor}
        onPetClick={handlePetClick}
        onPositionChange={handlePositionChange}
      />
    </aside>
  )
}
