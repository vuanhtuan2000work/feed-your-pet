import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '../pet/petOverlay.css'
import { PetOverlay } from '../app/PetOverlay'
import { ACTIVE_TAB_KEY } from '../data/petConfig'
import { teardownCustomCursorStyle } from '../pet/customCursorStyle'
import {
  isExtensionContextValid,
  safeAddMessageListener,
  safeStorageGet,
  watchExtensionContext,
} from '../services/extensionContext'

const ROOT_ID = 'feed-your-pet-extension-root'
const ENABLED_SITES_KEY = 'feed-your-pet:enabled-sites'

type FeedYourPetWindow = Window & {
  __feedYourPetContentLoaded?: boolean
}

let overlayRoot: Root | undefined

function normalizeHost(hostname: string) {
  return hostname.replace(/^www\./, '').toLowerCase()
}

function isHostEnabled(currentHost: string, enabledHost: string) {
  return currentHost === enabledHost || currentHost.endsWith(`.${enabledHost}`)
}

async function isCurrentSiteEnabled() {
  if (!isExtensionContextValid()) {
    return false
  }

  const currentHost = normalizeHost(window.location.hostname)
  if (!currentHost) {
    return false
  }

  const result = await safeStorageGet(ENABLED_SITES_KEY)
  if (!result) {
    return false
  }

  const enabledSites = result[ENABLED_SITES_KEY]
  return (
    Array.isArray(enabledSites) &&
    enabledSites.some((site) => typeof site === 'string' && isHostEnabled(currentHost, site))
  )
}

function teardownPetOverlay() {
  overlayRoot?.unmount()
  overlayRoot = undefined
  document.getElementById(ROOT_ID)?.remove()
  teardownCustomCursorStyle()
}

function mountPetOverlay() {
  if (!isExtensionContextValid()) {
    return
  }

  if (document.getElementById(ROOT_ID)) {
    return
  }

  const rootElement = document.createElement('div')
  rootElement.id = ROOT_ID
  rootElement.className = 'feed-your-pet-extension-root'
  document.documentElement.append(rootElement)

  overlayRoot = createRoot(rootElement)
  overlayRoot.render(
    <StrictMode>
      <PetOverlay />
    </StrictMode>,
  )
}

function activatePetOverlay() {
  if (!isExtensionContextValid()) {
    return
  }

  window.localStorage.removeItem(ACTIVE_TAB_KEY)
  mountPetOverlay()
}

async function mountIfEnabled() {
  if (!isExtensionContextValid()) {
    teardownPetOverlay()
    return
  }

  if (await isCurrentSiteEnabled()) {
    mountPetOverlay()
  }
}

const petWindow = window as FeedYourPetWindow

if (petWindow.__feedYourPetContentLoaded) {
  void mountIfEnabled()
} else {
  petWindow.__feedYourPetContentLoaded = true

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void mountIfEnabled(), { once: true })
  } else {
    void mountIfEnabled()
  }

  safeAddMessageListener((message) => {
    if (message.type === 'FEED_YOUR_PET_ENABLE_SITE') {
      activatePetOverlay()
    }
  })

  watchExtensionContext(teardownPetOverlay)
}
