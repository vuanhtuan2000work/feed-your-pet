export const WIDGET_SIZE = 220
export const PET_RENDER_SIZE = 172
export const ONE_HOUR_MS = 60 * 60 * 1000
export const CARE_DECAY_INTERVAL_MS = 5 * 60 * 1000
export const LOCAL_STORAGE_KEY = 'feed-your-pet:state:v1'
export const DEVICE_ID_KEY = 'feed-your-pet:device-id'
export const BROADCAST_CHANNEL = 'feed-your-pet:pet-state'

export const DEFAULT_STATS = {
  hunger: 80,
  happiness: 82,
  energy: 78,
  affection: 50,
  dreamPower: 0,
  boredom: 32,
  cleanliness: 82,
  stress: 12,
} as const

export const DEFAULT_PERSONALITY = {
  sociability: 72,
  playfulness: 66,
  laziness: 42,
  foodiness: 76,
  tolerance: 58,
  curiosity: 62,
} as const

export const DEFAULT_MEMORY = {
  recentActions: [],
  recentReactions: [],
  pettingCountInShortTime: 0,
  likedLastAction: true,
} as const

export const API_BASE_URL =
  import.meta.env.VITE_PET_API_BASE_URL?.replace(/\/$/, '') ?? ''
