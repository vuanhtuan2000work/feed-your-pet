import { CURSOR_OWNER_KEY, TAB_TRAVEL_CHANNEL } from '../data/petConfig'

export const CURRENT_TAB_ID = crypto.randomUUID()

export type TravelEdge = 'left' | 'right' | 'top' | 'bottom'

export type TabScreenBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type TabPresenceEvent = {
  type: 'PET_TAB_PRESENCE'
  tabId: string
  bounds: TabScreenBounds
  visible: boolean
  ownsPet: boolean
  timestamp: number
}

export type TabTransferEvent = {
  type: 'PET_TAB_TRANSFER'
  transferId: string
  sourceTabId: string
  targetTabId: string
  edge: TravelEdge
  entry: {
    x: number
    y: number
  }
  timestamp: number
}

export type TabTransferAcceptedEvent = {
  type: 'PET_TAB_TRANSFER_ACCEPTED'
  transferId: string
  sourceTabId: string
  targetTabId: string
  timestamp: number
}

export type CursorOwnerEvent = {
  type: 'PET_CURSOR_OWNER'
  tabId: string
  bounds: TabScreenBounds
  cursor: {
    x: number
    y: number
  }
  timestamp: number
}

export type TabTravelEvent =
  | TabPresenceEvent
  | TabTransferEvent
  | TabTransferAcceptedEvent
  | CursorOwnerEvent

export function createTabTravelBroadcast(onEvent: (event: TabTravelEvent) => void) {
  if (!('BroadcastChannel' in window)) {
    return {
      publishPresence: () => undefined,
      publishTransfer: () => undefined,
      publishTransferAccepted: () => undefined,
      publishCursorOwner(event: Omit<CursorOwnerEvent, 'type' | 'timestamp'>) {
        writeCursorOwner({
          ...event,
          type: 'PET_CURSOR_OWNER',
          timestamp: Date.now(),
        })
      },
      close: () => undefined,
    }
  }

  const channel = new BroadcastChannel(TAB_TRAVEL_CHANNEL)
  channel.onmessage = (event: MessageEvent<TabTravelEvent>) => {
    const data = event.data
    if (
      data?.type === 'PET_TAB_PRESENCE' ||
      data?.type === 'PET_TAB_TRANSFER' ||
      data?.type === 'PET_TAB_TRANSFER_ACCEPTED' ||
      data?.type === 'PET_CURSOR_OWNER'
    ) {
      onEvent(data)
    }
  }

  return {
    publishPresence(event: Omit<TabPresenceEvent, 'type' | 'timestamp'>) {
      channel.postMessage({
        ...event,
        type: 'PET_TAB_PRESENCE',
        timestamp: Date.now(),
      } satisfies TabPresenceEvent)
    },
    publishTransfer(event: Omit<TabTransferEvent, 'type' | 'timestamp'>) {
      channel.postMessage({
        ...event,
        type: 'PET_TAB_TRANSFER',
        timestamp: Date.now(),
      } satisfies TabTransferEvent)
    },
    publishTransferAccepted(event: Omit<TabTransferAcceptedEvent, 'type' | 'timestamp'>) {
      channel.postMessage({
        ...event,
        type: 'PET_TAB_TRANSFER_ACCEPTED',
        timestamp: Date.now(),
      } satisfies TabTransferAcceptedEvent)
    },
    publishCursorOwner(event: Omit<CursorOwnerEvent, 'type' | 'timestamp'>) {
      const message = {
        ...event,
        type: 'PET_CURSOR_OWNER',
        timestamp: Date.now(),
      } satisfies CursorOwnerEvent
      writeCursorOwner(message)
      channel.postMessage(message)
    },
    close() {
      channel.close()
    },
  }
}

export function readCursorOwner() {
  const raw = window.localStorage.getItem(CURSOR_OWNER_KEY)
  if (!raw) {
    return null
  }

  try {
    const owner = JSON.parse(raw) as CursorOwnerEvent
    return owner.type === 'PET_CURSOR_OWNER' ? owner : null
  } catch {
    return null
  }
}

function writeCursorOwner(owner: CursorOwnerEvent) {
  window.localStorage.setItem(CURSOR_OWNER_KEY, JSON.stringify(owner))
}

export function getViewportScreenBounds(): TabScreenBounds {
  return {
    left: window.screenX,
    top: window.screenY,
    width: window.innerWidth,
    height: window.innerHeight,
  }
}
