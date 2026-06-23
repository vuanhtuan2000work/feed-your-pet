type ChromeRuntimeGlobal = typeof globalThis & {
  chrome?: {
    runtime?: {
      id?: string
      getURL?: (path: string) => string
      onMessage?: {
        addListener: (
          listener: (
            message: { type?: string },
            sender: unknown,
            sendResponse: () => void,
          ) => void,
        ) => void
        removeListener: (
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

export function isExtensionContextValid() {
  const runtime = (globalThis as ChromeRuntimeGlobal).chrome?.runtime
  if (!runtime) {
    return false
  }

  try {
    return typeof runtime.id === 'string' && runtime.id.length > 0
  } catch {
    return false
  }
}

export function safeGetExtensionUrl(path: string) {
  if (!isExtensionContextValid()) {
    return undefined
  }

  try {
    const getRuntimeUrl = (globalThis as ChromeRuntimeGlobal).chrome?.runtime?.getURL
    if (!getRuntimeUrl) {
      return undefined
    }

    return getRuntimeUrl(path.replace(/^\/+/, ''))
  } catch {
    return undefined
  }
}

export async function safeStorageGet(key: string) {
  if (!isExtensionContextValid()) {
    return undefined
  }

  const storage = (globalThis as ChromeRuntimeGlobal).chrome?.storage?.local
  if (!storage) {
    return undefined
  }

  try {
    return await storage.get(key)
  } catch {
    return undefined
  }
}

export function safeAddMessageListener(
  listener: (
    message: { type?: string },
    sender: unknown,
    sendResponse: () => void,
  ) => void,
) {
  if (!isExtensionContextValid()) {
    return () => undefined
  }

  try {
    const onMessage = (globalThis as ChromeRuntimeGlobal).chrome?.runtime?.onMessage
    if (!onMessage) {
      return () => undefined
    }

    onMessage.addListener(listener)
    return () => {
      try {
        onMessage.removeListener(listener)
      } catch {
        // Context may already be invalidated.
      }
    }
  } catch {
    return () => undefined
  }
}

export function watchExtensionContext(onInvalidate: () => void) {
  if (!isExtensionContextValid()) {
    onInvalidate()
    return () => undefined
  }

  const intervalId = window.setInterval(() => {
    if (!isExtensionContextValid()) {
      window.clearInterval(intervalId)
      onInvalidate()
    }
  }, 2_000)

  return () => window.clearInterval(intervalId)
}
