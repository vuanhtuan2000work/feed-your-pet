type ChromeRuntimeGlobal = typeof globalThis & {
  chrome?: {
    runtime?: {
      getURL?: (path: string) => string
    }
  }
}

export function getAssetUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '')
  const getRuntimeUrl = (globalThis as ChromeRuntimeGlobal).chrome?.runtime?.getURL

  if (getRuntimeUrl) {
    return getRuntimeUrl(normalizedPath)
  }

  return `/${normalizedPath}`
}
