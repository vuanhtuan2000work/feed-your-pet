import { BROADCAST_CHANNEL } from '../data/petConfig'
import type { PetSaveState } from '../types/pet'

export type PetBroadcastEvent = {
  type: 'PET_STATE_UPDATED'
  state: PetSaveState
  timestamp: number
}

export function createPetBroadcast(
  onState: (event: PetBroadcastEvent) => void,
) {
  if (!('BroadcastChannel' in window)) {
    return {
      publish: () => undefined,
      close: () => undefined,
    }
  }

  const channel = new BroadcastChannel(BROADCAST_CHANNEL)
  channel.onmessage = (event: MessageEvent<PetBroadcastEvent>) => {
    if (event.data?.type === 'PET_STATE_UPDATED') {
      onState(event.data)
    }
  }

  return {
    publish(state: PetSaveState) {
      channel.postMessage({
        type: 'PET_STATE_UPDATED',
        state,
        timestamp: Date.now(),
      } satisfies PetBroadcastEvent)
    },
    close() {
      channel.close()
    },
  }
}
