import { safeGetExtensionUrl } from './extensionContext'

export function getAssetUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '')
  const extensionUrl = safeGetExtensionUrl(normalizedPath)

  if (extensionUrl) {
    return extensionUrl
  }

  return `/${normalizedPath}`
}
