import { useEffect, useState } from 'react'
import {
  CURRENT_TAB_ID,
  createTabTravelBroadcast,
  getViewportScreenBounds,
  readCursorOwner,
  type CursorOwnerEvent,
} from '../services/tabTravelSync'

type CursorPoint = {
  x: number
  y: number
  visible: boolean
  pressed: boolean
  overControl: boolean
}

type CursorEventLike = MouseEvent | PointerEvent

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

export function MouseCursor() {
  const [cursor, setCursor] = useState<CursorPoint>({
    x: -100,
    y: -100,
    visible: false,
    pressed: false,
    overControl: false,
  })

  useEffect(() => {
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

    const move = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      claimCursor(event)
      setCursor((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: true,
        overControl: isControlTarget(event.target),
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
    const leave = () => setCursor((current) => ({ ...current, visible: false }))
    const enter = (event: CursorEventLike) => {
      if (!isMouseInput(event)) {
        return
      }

      claimCursor(event)
      setCursor((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: true,
        overControl: isControlTarget(event.target),
      }))
    }
    const hideWhenInactive = () => {
      if (document.visibilityState !== 'visible') {
        setCursor((current) => ({ ...current, visible: false, pressed: false }))
      }
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', enter, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('mousedown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('mouseup', up)
    window.addEventListener('pointerleave', leave)
    window.addEventListener('pointerenter', enter)
    window.addEventListener('mouseenter', enter)
    window.addEventListener('blur', leave)
    document.addEventListener('visibilitychange', hideWhenInactive)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', enter)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerenter', enter)
      window.removeEventListener('mouseenter', enter)
      window.removeEventListener('blur', leave)
      document.removeEventListener('visibilitychange', hideWhenInactive)
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
      <div className="mouse-cursor__body">
        <span className="mouse-cursor__ear mouse-cursor__ear--left" />
        <span className="mouse-cursor__ear mouse-cursor__ear--right" />
        <span className="mouse-cursor__eye" />
        <span className="mouse-cursor__nose" />
        <span className="mouse-cursor__tail" />
      </div>
    </div>
  )
}
