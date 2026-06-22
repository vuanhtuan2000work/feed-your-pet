import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../pet/petOverlay.css'
import { PetOverlay } from '../app/PetOverlay'
import { ACTIVE_TAB_KEY } from '../data/petConfig'

const ROOT_ID = 'feed-your-pet-extension-root'
const ENABLED_SITES_KEY = 'feed-your-pet:enabled-sites'

type FeedYourPetWindow = Window & {
  __feedYourPetContentLoaded?: boolean
}

type ChromeRuntimeGlobal = typeof globalThis & {
  chrome?: {
    runtime?: {
      onMessage?: {
        addListener: (
          listener: (
            message: { type?: string },
            sender: unknown,
            sendResponse: () => void,
          ) => void,
        ) => void
      }
    }
    storage?: {
      local?: {
        get: (key: string) => Promise<Record<string, unknown>>
      }
    }
  }
}

function normalizeHost(hostname: string) {
  return hostname.replace(/^www\./, '').toLowerCase()
}

function isHostEnabled(currentHost: string, enabledHost: string) {
  return currentHost === enabledHost || currentHost.endsWith(`.${enabledHost}`)
}

async function isCurrentSiteEnabled() {
  const storage = (globalThis as ChromeRuntimeGlobal).chrome?.storage?.local
  if (!storage) {
    return true
  }

  const currentHost = normalizeHost(window.location.hostname)
  if (!currentHost) {
    return false
  }

  const result = await storage.get(ENABLED_SITES_KEY)
  const enabledSites = result[ENABLED_SITES_KEY]
  return (
    Array.isArray(enabledSites) &&
    enabledSites.some((site) => typeof site === 'string' && isHostEnabled(currentHost, site))
  )
}

function mountPetOverlay() {
  if (document.getElementById(ROOT_ID)) {
    return
  }

  const rootElement = document.createElement('div')
  rootElement.id = ROOT_ID
  rootElement.className = 'feed-your-pet-extension-root'
  document.documentElement.append(rootElement)

  createRoot(rootElement).render(
    <StrictMode>
      <PetOverlay />
    </StrictMode>,
  )
}

function activatePetOverlay() {
  window.localStorage.removeItem(ACTIVE_TAB_KEY)
  mountPetOverlay()
}

async function mountIfEnabled() {
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
    document.addEventListener('DOMContentLoaded', mountIfEnabled, { once: true })
  } else {
    void mountIfEnabled()
  }

  ;(globalThis as ChromeRuntimeGlobal).chrome?.runtime?.onMessage?.addListener((message) => {
    if (message.type === 'FEED_YOUR_PET_ENABLE_SITE') {
      activatePetOverlay()
    }
  })
}
