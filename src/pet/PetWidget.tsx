import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import {
  playPetActionSound,
  playPetReactionSound,
  startPetSleepLoop,
  stopPetSleepLoop,
} from '../services/petSounds'
import type { PetAnimationKey } from '../game/assets/manifest'
import type { PetActionId } from '../types/pet'

const WIDGET_SIZE = 220
const CHASE_DISTANCE = 96
const VIEWPORT_MARGIN = 8
const RELAXED_ROAM_SPEED_PX_PER_SECOND = 120
const PLAYFUL_ROAM_SPEED_PX_PER_SECOND = 190
const FREE_ROAM_MIN_TRAVEL_MS = 900
const FREE_ROAM_MAX_TRAVEL_MS = 7_200
const TAB_ID = CURRENT_TAB_ID
const ACTIVE_TAB_TTL_MS = 2_500
const SLEEP_LOOP_CURL_START_MS = 900
const INITIAL_CURSOR_EVENT_GRACE_MS = 800
const PET_TOP_Z_INDEX = 2_147_483_645

type ActiveTabRecord = {
  tabId: string
  timestamp: number
}

type WidgetPosition = {
  x: number
  y: number
}

type CursorEventLike = MouseEvent | PointerEvent

type FreeRoamAnimationState = {
  sessionKey: string
  animation: PetAnimationKey
  tilt: number
}

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
    x: clamp(
      cursor.x - WIDGET_SIZE / 2,
      VIEWPORT_MARGIN,
      window.innerWidth - WIDGET_SIZE - VIEWPORT_MARGIN,
    ),
    y: clamp(
      cursor.y - WIDGET_SIZE / 2,
      VIEWPORT_MARGIN,
      window.innerHeight - WIDGET_SIZE - VIEWPORT_MARGIN,
    ),
  }
}

function clampWidgetPosition(position: WidgetPosition, size: { width: number; height: number }) {
  return {
    x: clamp(position.x, VIEWPORT_MARGIN, window.innerWidth - size.width - VIEWPORT_MARGIN),
    y: clamp(position.y, VIEWPORT_MARGIN, window.innerHeight - size.height - VIEWPORT_MARGIN),
  }
}

function getRandomWidgetPosition(size: { width: number; height: number }) {
  const xRatio = randomBetween(0.08, 0.92)
  const yRatio = randomBetween(0.12, 0.88)
  const x = window.innerWidth * xRatio - size.width / 2
  const y = window.innerHeight * yRatio - size.height / 2

  return clampWidgetPosition({ x, y }, size)
}

function getDefaultWidgetPosition() {
  return {
    x: window.innerWidth - WIDGET_SIZE - 24,
    y: window.innerHeight - WIDGET_SIZE - 24,
  }
}

function getInitialWidgetPosition(
  savedPosition: WidgetPosition | undefined,
  size: { width: number; height: number },
) {
  return clampWidgetPosition(savedPosition ?? getDefaultWidgetPosition(), size)
}

function getRandomRoamTravelMs(distance: number, speedPxPerSecond: number) {
  return clamp(
    (distance / Math.max(1, speedPxPerSecond)) * 1_000,
    FREE_ROAM_MIN_TRAVEL_MS,
    FREE_ROAM_MAX_TRAVEL_MS,
  )
}

function getFreeRoamPointDistance(from: WidgetPosition, to: WidgetPosition) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function getRunAnimationFromDelta(dx: number, dy: number): PetAnimationKey {
  if (Math.hypot(dx, dy) < 1) {
    return 'run'
  }

  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  if (degrees >= -22.5 && degrees < 22.5) {
    return 'run_right'
  }
  if (degrees >= 22.5 && degrees < 67.5) {
    return 'run_down_right'
  }
  if (degrees >= 67.5 && degrees < 112.5) {
    return 'run_down'
  }
  if (degrees >= 112.5 && degrees < 157.5) {
    return 'run_down_left'
  }
  if (degrees >= 157.5 || degrees < -157.5) {
    return 'run_left'
  }
  if (degrees >= -157.5 && degrees < -112.5) {
    return 'run_up_left'
  }
  if (degrees >= -112.5 && degrees < -67.5) {
    return 'run_up'
  }
  return 'run_up_right'
}

function getRunTiltFromDelta(dx: number, dy: number) {
  const distance = Math.max(1, Math.hypot(dx, dy))
  return clamp((dy / distance) * 0.16, -0.16, 0.16)
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * Math.max(0, max - min)
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

function isRealCursorMove(event: CursorEventLike, mountedAtMs: number) {
  if (event.type !== 'pointermove' && event.type !== 'mousemove') {
    return false
  }

  if (
    Date.now() - mountedAtMs < INITIAL_CURSOR_EVENT_GRACE_MS &&
    'movementX' in event &&
    'movementY' in event &&
    event.movementX === 0 &&
    event.movementY === 0
  ) {
    return false
  }

  return true
}

export function PetWidget() {
  const widgetRef = useRef<HTMLElement | null>(null)
  const visibleRef = useRef(false)
  const ownerTabRef = useRef<string | undefined>(undefined)
  const cursorOwnerSignatureRef = useRef<string | undefined>(undefined)
  const reactionSoundSignatureRef = useRef<string | undefined>(undefined)
  const cursorIdleTimerRef = useRef<number | undefined>(undefined)
  const mountedAtRef = useRef(0)
  const viewportRef = useRef({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const state = usePetStore((store) => store.state)
  const menuOpen = usePetStore((store) => store.menuOpen)
  const setMenuOpen = usePetStore((store) => store.setMenuOpen)
  const performAction = usePetStore((store) => store.performAction)
  const tick = usePetStore((store) => store.tick)
  const setPosition = usePetStore((store) => store.setPosition)
  const setWidgetPosition = usePetStore((store) => store.setWidgetPosition)
  const hydrateRemote = usePetStore((store) => store.hydrateRemote)
  const [cursor, setCursor] = useState({
    x: window.innerWidth - 134,
    y: window.innerHeight - 134,
    active: false,
  })
  const [petVisible, setPetVisible] = useState(shouldOwnPetInitially)
  const [widgetSize, setWidgetSize] = useState({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
  })
  const [chasePosition, setChasePosition] = useState(() =>
    getInitialWidgetPosition(state.widgetPosition, {
      width: WIDGET_SIZE,
      height: WIDGET_SIZE,
    }),
  )
  const [freeRoamAnimation, setFreeRoamAnimation] =
    useState<FreeRoamAnimationState>()
  const isFreeRoaming =
    state.state === 'run' &&
    state.currentReaction?.id === 'zoomies' &&
    state.actionUntil !== undefined
  const isMoodRandomRoaming =
    (state.mood === 'relaxed' || state.mood === 'playful') &&
    state.state !== 'sleep' &&
    state.state !== 'eat' &&
    state.state !== 'dream' &&
    state.state !== 'follow_cursor' &&
    state.state !== 'need_attention'
  const isRandomRoaming = isFreeRoaming || isMoodRandomRoaming
  const randomRoamSessionKey = isFreeRoaming
    ? `reaction:${state.currentReaction?.startedAt ?? 0}`
    : `mood:${state.state}:${state.mood}`
  const forcedAnimation =
    isRandomRoaming &&
    freeRoamAnimation?.sessionKey === randomRoamSessionKey
      ? freeRoamAnimation.animation
      : undefined
  const forcedTilt =
    isRandomRoaming &&
    freeRoamAnimation?.sessionKey === randomRoamSessionKey
      ? freeRoamAnimation.tilt
      : undefined

  const showPetAtCursor = useCallback((nextCursor: WidgetPosition) => {
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
    setWidgetPosition(chasePosition.x, chasePosition.y)
  }, [chasePosition.x, chasePosition.y, setWidgetPosition])

  useEffect(() => {
    if (state.currentReaction?.id === 'curl_sleep') {
      return
    }

    if (state.state === 'sleep') {
      startPetSleepLoop()
      return
    }

    stopPetSleepLoop()
  }, [state.currentReaction?.id, state.state])

  useEffect(() => {
    const reaction = state.currentReaction
    if (reaction?.id !== 'curl_sleep') {
      return
    }

    stopPetSleepLoop()
    const elapsedMs = Math.max(0, Date.now() - reaction.startedAt)
    const delayMs = Math.max(0, SLEEP_LOOP_CURL_START_MS - elapsedMs)
    const timeout = window.setTimeout(startPetSleepLoop, delayMs)

    return () => window.clearTimeout(timeout)
  }, [state.currentReaction])

  useEffect(() => {
    const reaction = state.currentReaction
    if (!reaction) {
      reactionSoundSignatureRef.current = undefined
      return
    }

    const signature = `${reaction.id}:${reaction.startedAt}`
    if (reactionSoundSignatureRef.current === signature) {
      return
    }

    reactionSoundSignatureRef.current = signature
    playPetReactionSound(reaction.id)
  }, [state.currentReaction])

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
    const keepPetInViewport = () => {
      const previousViewport = viewportRef.current
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      viewportRef.current = nextViewport
      setChasePosition((current) => {
        if (state.state !== 'sleep') {
          return clampWidgetPosition(current, widgetSize)
        }

        const centerRatioX = (current.x + widgetSize.width / 2) / previousViewport.width
        const centerRatioY = (current.y + widgetSize.height / 2) / previousViewport.height
        return clampWidgetPosition(
          {
            x: nextViewport.width * centerRatioX - widgetSize.width / 2,
            y: nextViewport.height * centerRatioY - widgetSize.height / 2,
          },
          widgetSize,
        )
      })
    }

    window.addEventListener('resize', keepPetInViewport)
    window.addEventListener('orientationchange', keepPetInViewport)
    keepPetInViewport()
    return () => {
      window.removeEventListener('resize', keepPetInViewport)
      window.removeEventListener('orientationchange', keepPetInViewport)
    }
  }, [state.state, widgetSize])

  useEffect(() => {
    mountedAtRef.current = Date.now()

    const onPointerMove = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      if (!isRealCursorMove(event, mountedAtRef.current)) {
        return
      }

      if (state.state === 'sleep' || isRandomRoaming) {
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
    window.addEventListener('pointerleave', deactivateCursor)
    window.addEventListener('blur', deactivateCursor)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('pointerleave', deactivateCursor)
      window.removeEventListener('blur', deactivateCursor)
      window.clearTimeout(cursorIdleTimerRef.current)
    }
  }, [isRandomRoaming, showPetAtCursor, state.state])

  const petPointer = useMemo(
    () => (state.state === 'sleep' ? { ...cursor, active: false } : cursor),
    [cursor, state.state],
  )
  const canFollowCursor =
    state.state === 'follow_cursor' || state.state === 'need_attention'

  const shouldChaseCursor =
    petVisible &&
    !menuOpen &&
    !isRandomRoaming &&
    !isUserTyping() &&
    canFollowCursor &&
    petPointer.active

  useEffect(() => {
    if (!shouldChaseCursor) {
      return
    }

    let frameId = 0
    const tickChase = () => {
      setChasePosition((current) => {
        const centerX = current.x + widgetSize.width / 2
        const centerY = current.y + widgetSize.height / 2
        const dx = petPointer.x - centerX
        const dy = petPointer.y - centerY
        const distance = Math.max(1, Math.hypot(dx, dy))
        const followStrength = state.state === 'follow_cursor' ? 0.14 : 0.1
        const desiredCenterX = petPointer.x - (dx / distance) * CHASE_DISTANCE
        const desiredCenterY = petPointer.y - (dy / distance) * CHASE_DISTANCE
        const targetX = clamp(
          desiredCenterX - widgetSize.width / 2,
          VIEWPORT_MARGIN,
          window.innerWidth - widgetSize.width - VIEWPORT_MARGIN,
        )
        const targetY = clamp(
          desiredCenterY - widgetSize.height / 2,
          VIEWPORT_MARGIN,
          window.innerHeight - widgetSize.height - VIEWPORT_MARGIN,
        )

        const nextX = current.x + (targetX - current.x) * followStrength
        const nextY = current.y + (targetY - current.y) * followStrength

        if (Math.abs(nextX - current.x) < 0.1 && Math.abs(nextY - current.y) < 0.1) {
          return current
        }

        return { x: nextX, y: nextY }
      })
      frameId = window.requestAnimationFrame(tickChase)
    }

    frameId = window.requestAnimationFrame(tickChase)
    return () => window.cancelAnimationFrame(frameId)
  }, [
    petPointer.x,
    petPointer.y,
    shouldChaseCursor,
    state.mood,
    state.state,
    widgetSize,
  ])

  useEffect(() => {
    if (!petVisible || menuOpen || !isRandomRoaming) {
      return
    }

    let frameId = 0
    let route:
      | {
          start: WidgetPosition
          target: WidgetPosition
          startedAt: number
          travelMs: number
        }
      | undefined

    const roam = (now: number) => {
      setChasePosition((current) => {
        if (!route) {
          const target = getRandomWidgetPosition(widgetSize)
          const distance = getFreeRoamPointDistance(current, target)
          const speed = isFreeRoaming
            ? PLAYFUL_ROAM_SPEED_PX_PER_SECOND
            : state.mood === 'playful'
              ? PLAYFUL_ROAM_SPEED_PX_PER_SECOND
              : RELAXED_ROAM_SPEED_PX_PER_SECOND
          const dx = target.x - current.x
          const dy = target.y - current.y
          setFreeRoamAnimation({
            sessionKey: randomRoamSessionKey,
            animation: getRunAnimationFromDelta(dx, dy),
            tilt: getRunTiltFromDelta(dx, dy),
          })
          route = {
            start: current,
            target,
            startedAt: now,
            travelMs: getRandomRoamTravelMs(distance, speed),
          }
        }

        const progress = clamp((now - route.startedAt) / route.travelMs, 0, 1)
        const nextPosition = clampWidgetPosition(
          {
            x: route.start.x + (route.target.x - route.start.x) * progress,
            y: route.start.y + (route.target.y - route.start.y) * progress,
          },
          widgetSize,
        )

        if (progress >= 1 || getFreeRoamPointDistance(nextPosition, route.target) < 4) {
          route = undefined
        }

        if (
          Math.abs(nextPosition.x - current.x) < 0.1 &&
          Math.abs(nextPosition.y - current.y) < 0.1
        ) {
          return current
        }

        return nextPosition
      })
      frameId = window.requestAnimationFrame(roam)
    }

    frameId = window.requestAnimationFrame(roam)
    return () => window.cancelAnimationFrame(frameId)
  }, [
    isFreeRoaming,
    isRandomRoaming,
    menuOpen,
    petVisible,
    randomRoamSessionKey,
    state.mood,
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

  const handleAction = useCallback(
    (action: PetActionId) => {
      playPetActionSound(action)
      performAction(action)
    },
    [performAction],
  )

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
      transform: `translate3d(${Math.round(chasePosition.x)}px, ${Math.round(chasePosition.y)}px, 0)`,
      zIndex: PET_TOP_Z_INDEX,
    }
  }, [chasePosition.x, chasePosition.y, petVisible])

  return createPortal(
    <aside
      ref={widgetRef}
      className="pet-widget"
      style={widgetStyle}
      aria-live="polite"
    >
      <PetMoodIcon mood={state.mood} />
      <PetMenu
        open={menuOpen}
        petState={state.state}
        onAction={handleAction}
      />
      <PetCanvas
        active={petVisible}
        state={state}
        pointer={petPointer}
        forcedAnimation={forcedAnimation}
        forcedTilt={forcedTilt}
        onPetClick={handlePetClick}
        onPositionChange={handlePositionChange}
      />
    </aside>,
    document.body,
  )
}
