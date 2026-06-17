import { useEffect, useState } from 'react'

type CursorPoint = {
  x: number
  y: number
  visible: boolean
  pressed: boolean
  overControl: boolean
}

function isControlTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'),
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
    const move = (event: PointerEvent) => {
      setCursor((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: event.pointerType === 'mouse',
        overControl: isControlTarget(event.target),
      }))
    }
    const down = () => setCursor((current) => ({ ...current, pressed: true }))
    const up = () => setCursor((current) => ({ ...current, pressed: false }))
    const leave = () => setCursor((current) => ({ ...current, visible: false }))
    const enter = () => setCursor((current) => ({ ...current, visible: true }))

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointerleave', leave)
    window.addEventListener('pointerenter', enter)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerenter', enter)
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
