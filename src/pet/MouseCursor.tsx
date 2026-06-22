import { useEffect, useRef, useState } from 'react'
import {
  CURRENT_TAB_ID,
  createTabTravelBroadcast,
  getViewportScreenBounds,
  readCursorOwner,
  type CursorOwnerEvent,
} from '../services/tabTravelSync'
import { getAssetUrl } from '../services/assetUrl'

type CursorPoint = {
  x: number
  y: number
  visible: boolean
  pressed: boolean
  overControl: boolean
  frameIndex: number
}

type CursorEventLike = MouseEvent | PointerEvent
type CursorPosition = Pick<CursorPoint, 'x' | 'y'>

const MOUSE_FRAME_SIZE = 72
const MOUSE_IDLE_FRAME_INDEX = 5
const MOUSE_IDLE_DELAY_MS = 260
const MOUSE_MOVEMENT_THRESHOLD = 2
const MOUSE_RUN_FRAME_MS = 96
const INITIAL_CURSOR_EVENT_GRACE_MS = 800

function isControlTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'),
  )
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

function getMouseFrameIndexFromDelta(dx: number, dy: number) {
  if (Math.hypot(dx, dy) < MOUSE_MOVEMENT_THRESHOLD) {
    return MOUSE_IDLE_FRAME_INDEX
  }

  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  if (degrees >= -22.5 && degrees < 22.5) {
    return 2
  }
  if (degrees >= 22.5 && degrees < 67.5) {
    return 1
  }
  if (degrees >= 67.5 && degrees < 112.5) {
    return 0
  }
  if (degrees >= 112.5 && degrees < 157.5) {
    return 7
  }
  if (degrees >= 157.5 || degrees < -157.5) {
    return 6
  }
  if (degrees >= -157.5 && degrees < -112.5) {
    return 5
  }
  if (degrees >= -112.5 && degrees < -67.5) {
    return 4
  }
  return 3
}

function getMouseRunFrameSequence(frameIndex: number) {
  const sequences: Record<number, number[]> = {
    0: [0, 1, 0, 7],
    1: [1, 2, 1, 0],
    2: [2, 3, 2, 1],
    3: [3, 4, 3, 2],
    4: [4, 5, 4, 3],
    5: [5, 6, 5, 4],
    6: [6, 7, 6, 5],
    7: [7, 0, 7, 6],
  }

  return sequences[frameIndex] ?? [frameIndex]
}

export function MouseCursor() {
  const lastPositionRef = useRef<CursorPosition | undefined>(undefined)
  const mountedAtRef = useRef(0)
  const idleTimerRef = useRef<number | undefined>(undefined)
  const runTimerRef = useRef<number | undefined>(undefined)
  const runSequenceKeyRef = useRef<number | undefined>(undefined)
  const runSequenceStepRef = useRef(0)
  const [cursor, setCursor] = useState<CursorPoint>({
    x: -100,
    y: -100,
    visible: false,
    pressed: false,
    overControl: false,
    frameIndex: MOUSE_IDLE_FRAME_INDEX,
  })

  useEffect(() => {
    mountedAtRef.current = Date.now()

    const cursorSync = createTabTravelBroadcast((event) => {
      if (event.type === 'PET_CURSOR_OWNER' && !isCurrentCursorOwnerEvent(event)) {
        return
      }

      if (event.type === 'PET_CURSOR_OWNER' && event.tabId !== CURRENT_TAB_ID) {
        setCursor((current) => ({ ...current, visible: false, pressed: false }))
      }
    })

    const claimCursor = (event: CursorEventLike) => {
      cursorSync.publishCursorOwner({
        tabId: CURRENT_TAB_ID,
        bounds: getViewportScreenBounds(),
        cursor: {
          x: event.clientX,
          y: event.clientY,
        },
      })
    }

    const isMouseInput = (event: CursorEventLike) =>
      !('pointerType' in event) || event.pointerType === 'mouse'

    const stopMovementLoop = () => {
      window.clearInterval(runTimerRef.current)
      runTimerRef.current = undefined
      runSequenceKeyRef.current = undefined
      runSequenceStepRef.current = 0
    }

    const startMovementLoop = (frameIndex: number) => {
      if (runSequenceKeyRef.current === frameIndex && runTimerRef.current !== undefined) {
        return
      }

      stopMovementLoop()
      const sequence = getMouseRunFrameSequence(frameIndex)
      runSequenceKeyRef.current = frameIndex
      runSequenceStepRef.current = 0
      setCursor((current) => ({ ...current, frameIndex: sequence[0] }))
      runTimerRef.current = window.setInterval(() => {
        runSequenceStepRef.current = (runSequenceStepRef.current + 1) % sequence.length
        setCursor((current) => ({
          ...current,
          frameIndex: sequence[runSequenceStepRef.current],
        }))
      }, MOUSE_RUN_FRAME_MS)
    }

    const scheduleIdleFrame = () => {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        stopMovementLoop()
        setCursor((current) => ({ ...current, frameIndex: MOUSE_IDLE_FRAME_INDEX }))
      }, MOUSE_IDLE_DELAY_MS)
    }

    const updateMovementFrame = (event: CursorEventLike) => {
      const previous = lastPositionRef.current
      const nextPosition = { x: event.clientX, y: event.clientY }
      lastPositionRef.current = nextPosition

      if (!previous) {
        scheduleIdleFrame()
        return undefined
      }

      const dx = nextPosition.x - previous.x
      const dy = nextPosition.y - previous.y
      scheduleIdleFrame()
      if (Math.hypot(dx, dy) < MOUSE_MOVEMENT_THRESHOLD) {
        return undefined
      }

      const frameIndex = getMouseFrameIndexFromDelta(dx, dy)
      startMovementLoop(frameIndex)
      return frameIndex
    }

    const move = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      if (
        Date.now() - mountedAtRef.current < INITIAL_CURSOR_EVENT_GRACE_MS &&
        'movementX' in event &&
        'movementY' in event &&
        event.movementX === 0 &&
        event.movementY === 0
      ) {
        return
      }

      const frameIndex = updateMovementFrame(event)
      claimCursor(event)
      setCursor((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: true,
        overControl: isControlTarget(event.target),
        frameIndex: frameIndex ?? current.frameIndex,
      }))
    }
    const down = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      claimCursor(event)
      setCursor((current) => ({ ...current, pressed: true }))
    }
    const up = () => setCursor((current) => ({ ...current, pressed: false }))
    const leave = () => {
      window.clearTimeout(idleTimerRef.current)
      stopMovementLoop()
      lastPositionRef.current = undefined
      setCursor((current) => ({
        ...current,
        visible: false,
        frameIndex: MOUSE_IDLE_FRAME_INDEX,
      }))
    }
    const hideWhenInactive = () => {
      if (document.visibilityState !== 'visible') {
        window.clearTimeout(idleTimerRef.current)
        stopMovementLoop()
        lastPositionRef.current = undefined
        setCursor((current) => ({
          ...current,
          visible: false,
          pressed: false,
          frameIndex: MOUSE_IDLE_FRAME_INDEX,
        }))
      }
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('mousedown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('mouseup', up)
    window.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    document.addEventListener('visibilitychange', hideWhenInactive)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      document.removeEventListener('visibilitychange', hideWhenInactive)
      window.clearTimeout(idleTimerRef.current)
      stopMovementLoop()
      cursorSync.close()
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle(
      'mouse-cursor-enabled',
      cursor.visible && !cursor.overControl,
    )
    return () => document.documentElement.classList.remove('mouse-cursor-enabled')
  }, [cursor.visible, cursor.overControl])

  if (!cursor.visible || cursor.overControl) {
    return null
  }

  return (
    <div
      className={`mouse-cursor${cursor.pressed ? ' mouse-cursor--pressed' : ''}`}
      style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }}
      aria-hidden="true"
    >
      <span
        className="mouse-cursor__sprite"
        style={{
          backgroundImage: `url("${getAssetUrl('assets/cursor/mouse-run.png')}")`,
          backgroundPosition: `-${cursor.frameIndex * MOUSE_FRAME_SIZE}px 0`,
        }}
      />
    </div>
  )
}
