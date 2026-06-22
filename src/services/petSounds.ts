import type { PetActionId, PetReactionId } from '../types/pet'
import { getAssetUrl } from './assetUrl'

const soundUrls = {
  hungry: getAssetUrl('assets/pet/sound/need-attention/freesound_community-cat-meow-14536.mp3'),
  sleep: getAssetUrl('assets/pet/sound/sleep/dragon-studio-purring-cat-401727.mp3'),
  wakeUp: getAssetUrl('assets/pet/sound/wake-up/sound_garage-cat-meow-8-fx-306184.mp3'),
} as const

const actionSounds: Partial<Record<PetActionId, keyof typeof soundUrls>> = {
  feed: 'hungry',
  wake_up: 'wakeUp',
}

const reactionSounds: Partial<Record<PetReactionId, keyof typeof soundUrls>> = {
  ask_feed: 'hungry',
  hungry_play_distracted: 'hungry',
  wake_stretch: 'wakeUp',
}

let sleepLoop: HTMLAudioElement | undefined
let sleepLoopWanted = false
let unlockListenersActive = false

function removeSleepUnlockListeners() {
  if (!unlockListenersActive) {
    return
  }

  window.removeEventListener('pointerdown', retrySleepLoopAfterUnlock)
  window.removeEventListener('keydown', retrySleepLoopAfterUnlock)
  window.removeEventListener('touchstart', retrySleepLoopAfterUnlock)
  unlockListenersActive = false
}

function retrySleepLoopAfterUnlock() {
  removeSleepUnlockListeners()
  if (sleepLoopWanted) {
    startPetSleepLoop()
  }
}

function waitForSleepAudioUnlock() {
  if (unlockListenersActive) {
    return
  }

  window.addEventListener('pointerdown', retrySleepLoopAfterUnlock, { once: true })
  window.addEventListener('keydown', retrySleepLoopAfterUnlock, { once: true })
  window.addEventListener('touchstart', retrySleepLoopAfterUnlock, { once: true })
  unlockListenersActive = true
}

function playSound(sound: keyof typeof soundUrls, volume = 0.75) {
  const audio = new Audio(soundUrls[sound])
  audio.volume = volume
  void audio.play().catch(() => undefined)
}

export function playPetActionSound(action: PetActionId) {
  const sound = actionSounds[action]
  if (!sound) {
    return
  }

  if (action === 'wake_up' || action === 'follow_cursor') {
    stopPetSleepLoop()
  }

  playSound(sound)
}

export function playPetReactionSound(reaction: PetReactionId) {
  const sound = reactionSounds[reaction]
  if (!sound) {
    return
  }

  playSound(sound, sound === 'hungry' ? 0.65 : 0.75)
}

export function startPetSleepLoop() {
  sleepLoopWanted = true
  if (!sleepLoop) {
    sleepLoop = new Audio(soundUrls.sleep)
    sleepLoop.loop = true
    sleepLoop.volume = 0.38
  }

  void sleepLoop.play().then(removeSleepUnlockListeners).catch(waitForSleepAudioUnlock)
}

export function stopPetSleepLoop() {
  sleepLoopWanted = false
  removeSleepUnlockListeners()
  if (!sleepLoop) {
    return
  }

  sleepLoop.pause()
  sleepLoop.currentTime = 0
}
