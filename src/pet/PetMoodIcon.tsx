import type { PetMood } from '../types/pet'

const moodLabels: Record<PetMood, string> = {
  relaxed: 'Relaxed',
  happy: 'Happy',
  hungry: 'Hungry',
  sleepy: 'Sleepy',
  playful: 'Playful',
  bored: 'Bored',
  clingy: 'Clingy',
  annoyed: 'Annoyed',
  scared: 'Scared',
  curious: 'Curious',
  relieved: 'Relieved',
  dreaming: 'Dreaming',
  attention: 'Wants attention',
}

export function PetMoodIcon({ mood }: { mood: PetMood }) {
  return <div className="pet-mood">{moodLabels[mood]}</div>
}
