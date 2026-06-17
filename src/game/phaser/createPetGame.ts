import Phaser from 'phaser'
import { WIDGET_SIZE } from '../../data/petConfig'
import { PetScene } from './scenes/PetScene'
import {
  setActivePetSceneBridge,
  type PetSceneBridge,
} from './adapters/sceneBridge'

export function createPetGame(parent: HTMLElement, bridge: PetSceneBridge) {
  setActivePetSceneBridge(bridge)

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    transparent: true,
    backgroundColor: 'rgba(0,0,0,0)',
    scene: [],
    scale: {
      mode: Phaser.Scale.NONE,
      width: WIDGET_SIZE,
      height: WIDGET_SIZE,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    audio: {
      noAudio: true,
    },
    callbacks: {
      postBoot(game) {
        game.scene.add('PetScene', PetScene, true, { bridge })
      },
    },
  })
}
