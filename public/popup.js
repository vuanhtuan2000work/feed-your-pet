const ENABLED_SITES_KEY = 'feed-your-pet:enabled-sites'

const form = document.getElementById('pet-site-form')
const input = document.getElementById('pet-site-input')
const statusText = document.getElementById('popup-status')
const cancelButton = document.getElementById('cancel-button')

function setStatus(message, tone = 'info') {
  statusText.textContent = message
  if (tone === 'error') {
    statusText.dataset.tone = 'error'
    return
  }
  delete statusText.dataset.tone
}

function normalizeWebsite(value) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return undefined
  }
}

function hostFromTab(tab) {
  if (!tab?.url) {
    return undefined
  }

  try {
    const url = new URL(tab.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }
    return url.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return undefined
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function readEnabledSites() {
  const result = await chrome.storage.local.get(ENABLED_SITES_KEY)
  return Array.isArray(result[ENABLED_SITES_KEY]) ? result[ENABLED_SITES_KEY] : []
}

async function enableSite(host) {
  const enabledSites = await readEnabledSites()
  const nextSites = Array.from(new Set([...enabledSites, host])).sort()
  await chrome.storage.local.set({ [ENABLED_SITES_KEY]: nextSites })
}

async function injectPet(tab) {
  if (!tab?.id) {
    return
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['content.css'],
  })
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  })
  await chrome.tabs.sendMessage(tab.id, { type: 'FEED_YOUR_PET_ENABLE_SITE' }).catch(() => undefined)
}

async function hydrateInput() {
  const tab = await getActiveTab()
  const host = hostFromTab(tab)
  if (host) {
    input.value = host
    setStatus('Add this website to show your pet here.')
    return
  }

  setStatus('Open an http or https website first.', 'error')
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const tab = await getActiveTab()
  const host = normalizeWebsite(input.value) ?? hostFromTab(tab)

  if (!host) {
    setStatus('Enter a valid website, for example github.com.', 'error')
    input.focus()
    return
  }

  try {
    await enableSite(host)
    await injectPet(tab)
    setStatus(`Pet enabled on ${host}.`)
  } catch {
    setStatus('Could not enable pet on this page. Try refreshing the tab.', 'error')
  }
})

cancelButton.addEventListener('click', () => {
  window.close()
})

void hydrateInput()
