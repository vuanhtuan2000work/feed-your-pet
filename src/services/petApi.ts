import { API_BASE_URL } from '../data/petConfig'
import type { PetActionId, PetSaveState } from '../types/pet'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!API_BASE_URL) {
    return null
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Pet API failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function fetchRemotePetState(deviceId: string, userId?: string) {
  const params = new URLSearchParams({ deviceId })
  if (userId) {
    params.set('userId', userId)
  }
  return request<PetSaveState>(`/api/pet/state?${params}`)
}

export function postRemoteAction(
  deviceId: string,
  action: PetActionId,
  userId?: string,
) {
  return request<PetSaveState>('/api/pet/action', {
    method: 'POST',
    body: JSON.stringify({ deviceId, userId, action }),
  })
}

export function syncRemotePetState(state: PetSaveState) {
  return request<PetSaveState>('/api/pet/sync', {
    method: 'POST',
    body: JSON.stringify(state),
  })
}
