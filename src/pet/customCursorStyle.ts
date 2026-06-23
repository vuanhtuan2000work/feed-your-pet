const CURSOR_STYLE_ID = 'feed-your-pet-cursor-style'
const HIDE_CURSOR_CLASS = 'feed-your-pet-hide-native-cursor'

const HIDE_NATIVE_CURSOR_CSS = `
html.${HIDE_CURSOR_CLASS},
html.${HIDE_CURSOR_CLASS} *,
html.${HIDE_CURSOR_CLASS} *::before,
html.${HIDE_CURSOR_CLASS} *::after,
body.${HIDE_CURSOR_CLASS},
body.${HIDE_CURSOR_CLASS} *,
body.${HIDE_CURSOR_CLASS} *::before,
body.${HIDE_CURSOR_CLASS} *::after {
  cursor: none !important;
}
`

export function ensureCustomCursorStyle() {
  if (document.getElementById(CURSOR_STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = CURSOR_STYLE_ID
  style.textContent = HIDE_NATIVE_CURSOR_CSS
  document.documentElement.append(style)
}

export function setNativeCursorHidden(hidden: boolean) {
  ensureCustomCursorStyle()
  document.documentElement.classList.toggle(HIDE_CURSOR_CLASS, hidden)
  document.body?.classList.toggle(HIDE_CURSOR_CLASS, hidden)
}

export function teardownCustomCursorStyle() {
  setNativeCursorHidden(false)
  document.getElementById(CURSOR_STYLE_ID)?.remove()
}
