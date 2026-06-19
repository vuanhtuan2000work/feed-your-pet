import Phaser from 'phaser'
import { PET_LEVEL_ONE_HEIGHT, WIDGET_SIZE } from '../../../data/petConfig'
import { getCatVariant } from '../../../data/catVariants'
import {
  CAT_VARIANT_MANIFESTS,
  getCatAssetManifest,
  type PetAnimationKey,
  type PetFrameAsset,
} from '../../assets/manifest'
import { isUserTyping } from '../../simulation/systems/attentionSystem'
import {
  getActivePetSceneBridge,
  type PetSceneBridge,
} from '../adapters/sceneBridge'
import {
  chooseMicroBehavior,
  type MicroBehaviorProfile,
} from '../view/catLifeMotion'
import {
  REACTION_MOTIONS,
  REACTION_SEQUENCES,
  type MotionMood,
  type PetMotionPhase,
} from '../view/petMotion'

type Wander = {
  nextDecisionAt: number
  targetX: number
  targetY: number
}

type FollowPointer = {
  x: number
  y: number
}

type FrameContentBounds = {
  width: number
  height: number
  denseWidth: number
  denseHeight: number
  visualSize: number
}

const FOLLOW_POINTER_MOVE_THRESHOLD = 2.5
const FOLLOW_IDLE_DELAY_MS = 300
const FOLLOW_RUN_MAX_TILT = 0.36
const FOLLOW_HORIZONTAL_DEADZONE_RATIO = 0.18
const FOLLOW_VERTICAL_DEADZONE_RATIO = 0.12
const PET_DEPTH = 10
const CONTENT_ALPHA_THRESHOLD = 64
const CONTENT_DENSE_PROJECTION_RATIO = 0.1
const CONTENT_VISUAL_MAJOR_WEIGHT = 0.82
const CONTENT_VISUAL_AREA_WEIGHT = 0.18

export class PetScene extends Phaser.Scene {
  private bridge!: PetSceneBridge
  private pet?: Phaser.GameObjects.Sprite
  private occlusionMaskGraphics?: Phaser.GameObjects.Graphics
  private occlusionMask?: Phaser.Display.Masks.GeometryMask
  private contentBoundsByFrame = new Map<string, FrameContentBounds>()
  private contentVisualSizeByAnimation = new Map<string, number>()
  private currentAnimation?: string
  private currentAnimationKey?: PetAnimationKey
  private currentReactionId?: string
  private currentReactionPhase?: string
  private currentReactionStartedAt?: number
  private activeMicro?: MicroBehaviorProfile
  private activeMicroUntil = 0
  private nextMicroAt = 0
  private lastFollowPointer?: FollowPointer
  private lastFollowMoveAt = 0
  private currentFollowTilt = 0
  private baseScale = 1
  private breathingPhase = Math.random() * Math.PI
  private lastPointerX = WIDGET_SIZE / 2
  private wander: Wander = {
    nextDecisionAt: 0,
    targetX: WIDGET_SIZE / 2,
    targetY: 190,
  }

  constructor() {
    super('PetScene')
  }

  init(data?: { bridge?: PetSceneBridge }) {
    const bridge = data?.bridge ?? getActivePetSceneBridge()
    if (!bridge) {
      throw new Error('PetScene bridge was not configured before scene start.')
    }
    this.bridge = bridge
  }

  preload() {
    Object.values(CAT_VARIANT_MANIFESTS).forEach((manifest) => {
      manifest.sources.forEach((source) => this.load.image(source.key, source.url))
    })
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')
    this.createTextureFrames()
    this.createAnimations()

    const state = this.bridge.getState()
    const startX = Phaser.Math.Clamp(state.position.x, 58, WIDGET_SIZE - 58)
    const startY = Phaser.Math.Clamp(state.position.y, 156, WIDGET_SIZE - 12)
    const idleFrame = this.getCurrentCatManifest().animations.idle.frames[0]
    this.pet = this.add
      .sprite(startX, startY, idleFrame.textureKey, idleFrame.frame)
      .setOrigin(0.5, 1)
      .setDepth(PET_DEPTH)
    this.syncFrameScale()
    this.pet.setScale(this.baseScale)
    this.pet.setInteractive({ useHandCursor: true })

    this.pet.on('pointerdown', () => this.bridge.onPetClick())
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPointerX = pointer.x
    })
    this.occlusionMaskGraphics = this.add.graphics().setVisible(false)
  }

  update(time: number, delta: number) {
    if (!this.pet) {
      return
    }

    const state = this.bridge.getState()
    const forcedAnimation = this.bridge.getForcedAnimation()
    if (!state.currentReaction) {
      this.currentReactionId = undefined
      this.currentReactionPhase = undefined
      this.currentReactionStartedAt = undefined
    }

    const isFollowingCursor =
      (state.state === 'follow_cursor' || state.state === 'need_attention') &&
      !isUserTyping()
    if (!isFollowingCursor) {
      this.lastFollowPointer = undefined
      this.lastFollowMoveAt = 0
      this.currentFollowTilt = 0
    }

    if (forcedAnimation) {
      this.playAnimation(forcedAnimation)
      this.currentReactionId = undefined
      this.currentReactionPhase = undefined
      this.activeMicro = undefined
      this.pet.setScale(this.baseScale)
      this.pet.setRotation(
        Phaser.Math.Linear(this.pet.rotation, this.bridge.getForcedTilt() ?? 0, 0.22),
      )
    } else if (isFollowingCursor) {
      this.moveToward(WIDGET_SIZE / 2, 188, delta, 70)
      this.playAnimation(this.getFollowCursorAnimation(time))
    } else if (state.currentReaction && state.actionUntil) {
      this.playReactionMotion(
        state.currentReaction.id,
        Math.max(0, Date.now() - state.currentReaction.startedAt),
      )
      if (state.state === 'play') {
        this.playBounce(delta, state.currentReaction.id === 'zoomies' ? 1 : 0.45)
      }
    } else if (state.state === 'sleep') {
      this.playAnimation('sleep')
      this.syncFrameScale()
      this.pet.setScale(this.baseScale)
      this.pet.setRotation(0)
    } else {
      this.liveIdle(time, delta)
    }

    this.updatePageOcclusionMask()
    this.applyPointerGaze()
    this.bridge.onPositionChange(Math.round(this.pet.x), Math.round(this.pet.y))
  }

  private updatePageOcclusionMask() {
    if (!this.pet) {
      return
    }

    const anchors = this.bridge.getHideAnchors()
    if (anchors.length === 0) {
      this.clearPageOcclusionMask()
      return
    }

    const graphics = this.occlusionMaskGraphics ?? this.add.graphics().setVisible(false)
    this.occlusionMaskGraphics = graphics
    graphics.clear()
    graphics.fillStyle(0xffffff, 1)
    anchors.forEach((anchor) => {
      graphics.fillRect(anchor.x, anchor.y, anchor.width, anchor.height)
    })

    if (!this.occlusionMask) {
      this.occlusionMask = graphics.createGeometryMask()
      this.occlusionMask.setInvertAlpha(true)
      this.pet.setMask(this.occlusionMask)
    }
  }

  private clearPageOcclusionMask() {
    this.occlusionMaskGraphics?.clear()
    if (this.pet?.mask) {
      this.pet.clearMask(false)
    }
    this.occlusionMask = undefined
  }

  private createTextureFrames() {
    const preparedFrames = new Set<string>()

    Object.values(CAT_VARIANT_MANIFESTS).forEach((manifest) => {
      Object.values(manifest.animations).forEach((animation) => {
        animation.frames.forEach((frame) => {
          if (!frame.rect) {
            return
          }

          const frameId = `${frame.textureKey}:${frame.frame}`
          if (preparedFrames.has(frameId)) {
            return
          }

          const texture = this.textures.get(frame.textureKey)
          if (!texture.has(frame.frame)) {
            texture.add(
              frame.frame,
              0,
              frame.rect.x,
              frame.rect.y,
              frame.rect.width,
              frame.rect.height,
            )
          }
          preparedFrames.add(frameId)
        })
      })
    })
  }

  private createAnimations() {
    Object.values(CAT_VARIANT_MANIFESTS).forEach((manifest) => {
      Object.values(manifest.animations).forEach((animation) => {
        if (this.anims.exists(animation.key)) {
          return
        }

        this.anims.create({
          key: animation.key,
          frames: animation.frames.map((frame) => this.makeAnimationFrame(frame)),
          frameRate: animation.frameRate,
          repeat: animation.repeat,
        })
      })
    })
  }

  private makeAnimationFrame(frame: PetFrameAsset) {
    return {
      key: frame.textureKey,
      frame: frame.frame,
    }
  }

  private playAnimation(key: PetAnimationKey) {
    if (!this.pet) {
      return
    }

    const animation = this.getCurrentCatManifest().animations[key]
    if (this.currentAnimation === animation.key) {
      return
    }

    this.currentAnimation = animation.key
    this.currentAnimationKey = key
    this.pet.play(animation.key)
    this.syncFrameScale()
    this.pet.setScale(this.baseScale)
    if (this.isDirectionalRunAnimation()) {
      this.pet.setFlipX(false)
    }
  }

  private getCurrentCatManifest() {
    return getCatAssetManifest(this.bridge.getState().catVariantId)
  }

  private getFollowCursorAnimation(time: number): PetAnimationKey {
    const pointer = this.bridge.getPointer()
    if (!this.pet || !pointer.active) {
      this.lastFollowPointer = undefined
      this.lastFollowMoveAt = 0
      this.currentFollowTilt = 0
      return 'idle'
    }

    const currentPointer = { x: pointer.x, y: pointer.y }
    if (!this.lastFollowPointer) {
      this.lastFollowPointer = currentPointer
      this.lastFollowMoveAt = time
      const followVector = this.getFollowVectorToPointer()
      const animation = this.getRunAnimationFromVector(followVector.dx, followVector.dy)
      this.currentFollowTilt = this.getFollowTiltFromVector(
        followVector.dx,
        followVector.dy,
        animation,
      )
      return animation
    }

    const dx = currentPointer.x - this.lastFollowPointer.x
    const dy = currentPointer.y - this.lastFollowPointer.y
    const distance = Math.hypot(dx, dy)

    if (distance <= FOLLOW_POINTER_MOVE_THRESHOLD) {
      if (time - this.lastFollowMoveAt >= FOLLOW_IDLE_DELAY_MS) {
        this.currentFollowTilt = 0
        return 'idle'
      }

      return this.isDirectionalRunAnimation() ? this.currentAnimationKey ?? 'idle' : 'idle'
    }

    this.lastFollowPointer = currentPointer
    this.lastFollowMoveAt = time
    const followVector = this.getFollowVectorToPointer()
    const animation = this.getRunAnimationFromVector(followVector.dx, followVector.dy)
    this.currentFollowTilt = this.getFollowTiltFromVector(
      followVector.dx,
      followVector.dy,
      animation,
    )
    return animation
  }

  private getFollowVectorToPointer() {
    if (!this.pet) {
      return { dx: 1, dy: 0 }
    }

    const pointer = this.getPointerInScene()
    const topY = this.pet.y - this.pet.displayHeight
    const centerY = topY + this.pet.displayHeight / 2
    const centerX = this.pet.x
    const halfWidth = this.pet.displayWidth / 2
    const halfHeight = this.pet.displayHeight / 2
    const horizontalDeadzone = Math.max(4, halfWidth * FOLLOW_HORIZONTAL_DEADZONE_RATIO)
    const verticalDeadzone = Math.max(4, halfHeight * FOLLOW_VERTICAL_DEADZONE_RATIO)
    const rawDx = pointer.x - centerX
    const rawDy = pointer.y - centerY
    const dx = Math.abs(rawDx) <= horizontalDeadzone ? 0 : rawDx
    const dy = Math.abs(rawDy) <= verticalDeadzone ? 0 : rawDy

    return {
      dx,
      dy,
    }
  }

  private getPointerInScene() {
    const pointer = this.bridge.getPointer()
    if (!pointer.active) {
      return { x: this.lastPointerX, y: this.pet?.y ?? WIDGET_SIZE / 2 }
    }

    const canvasBounds = this.game.canvas.getBoundingClientRect()
    return {
      x: ((pointer.x - canvasBounds.left) / canvasBounds.width) * WIDGET_SIZE,
      y: ((pointer.y - canvasBounds.top) / canvasBounds.height) * WIDGET_SIZE,
    }
  }

  private getFollowTiltFromVector(
    dx: number,
    dy: number,
    animation: PetAnimationKey,
  ) {
    if (
      animation !== 'run_up_left' &&
      animation !== 'run_up_right' &&
      animation !== 'run_down_left' &&
      animation !== 'run_down_right'
    ) {
      return 0
    }

    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (absX <= FOLLOW_POINTER_MOVE_THRESHOLD || absY <= FOLLOW_POINTER_MOVE_THRESHOLD) {
      return 0
    }

    const tiltMagnitude = Math.min(
      FOLLOW_RUN_MAX_TILT,
      Math.atan2(absY, absX) * 0.45,
    )

    if (animation === 'run_up_left' || animation === 'run_down_right') {
      return dy < 0 ? tiltMagnitude : tiltMagnitude
    }

    return dy < 0 ? -tiltMagnitude : -tiltMagnitude
  }

  private getRunAnimationFromVector(dx: number, dy: number): PetAnimationKey {
    if (Math.abs(dx) <= FOLLOW_POINTER_MOVE_THRESHOLD) {
      return dy < 0 ? 'run_up' : 'run_down'
    }
    if (Math.abs(dy) <= FOLLOW_POINTER_MOVE_THRESHOLD) {
      return dx < 0 ? 'run_left' : 'run_right'
    }

    const degrees = Phaser.Math.RadToDeg(Math.atan2(dy, dx))

    if (degrees >= -22.5 && degrees < 22.5) {
      return 'run_right'
    }
    if (degrees >= 22.5 && degrees < 67.5) {
      return 'run_down_right'
    }
    if (degrees >= 67.5 && degrees < 112.5) {
      return 'run_down'
    }
    if (degrees >= 112.5 && degrees < 157.5) {
      return 'run_down_left'
    }
    if (degrees >= 157.5 || degrees < -157.5) {
      return 'run_left'
    }
    if (degrees >= -157.5 && degrees < -112.5) {
      return 'run_up_left'
    }
    if (degrees >= -112.5 && degrees < -67.5) {
      return 'run_up'
    }
    return 'run_up_right'
  }

  private isDirectionalRunAnimation() {
    return (
      this.currentAnimationKey === 'run_left' ||
      this.currentAnimationKey === 'run_right' ||
      this.currentAnimationKey === 'run_up' ||
      this.currentAnimationKey === 'run_down' ||
      this.currentAnimationKey === 'run_up_left' ||
      this.currentAnimationKey === 'run_up_right' ||
      this.currentAnimationKey === 'run_down_left' ||
      this.currentAnimationKey === 'run_down_right'
    )
  }

  private syncFrameScale() {
    if (!this.pet) {
      return
    }

    const variant = getCatVariant(this.bridge.getState().catVariantId)
    const level = Math.max(1, variant.level)
    const levelScale = 1 + (level - 1) * 0.06
    const levelOneHeight = variant.levelOneHeight || PET_LEVEL_ONE_HEIGHT
    const contentVisualSize = this.getCurrentAnimationContentVisualSize()
    this.baseScale = (levelOneHeight * levelScale) / Math.max(1, contentVisualSize)
  }

  private getCurrentAnimationContentVisualSize() {
    if (!this.currentAnimationKey) {
      return this.getCurrentFrameFallbackVisualSize()
    }

    const state = this.bridge.getState()
    const cacheKey = `${state.catVariantId}:${this.currentAnimationKey}`
    const cached = this.contentVisualSizeByAnimation.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const animation = this.getCurrentCatManifest().animations[this.currentAnimationKey]
    const visualSize = Math.max(
      this.getMedian(animation.frames.map((frame) => this.getFrameContentBounds(frame).visualSize)),
      1,
    )

    this.contentVisualSizeByAnimation.set(cacheKey, visualSize)
    return visualSize
  }

  private getFrameContentBounds(frameAsset: PetFrameAsset): FrameContentBounds {
    const cacheKey = `${frameAsset.textureKey}:${frameAsset.frame}`
    const cached = this.contentBoundsByFrame.get(cacheKey)
    if (cached) {
      return cached
    }

    const textureFrame = this.textures.getFrame(frameAsset.textureKey, frameAsset.frame)
    const fallbackWidth =
      textureFrame?.realWidth || textureFrame?.width || frameAsset.rect?.width || PET_LEVEL_ONE_HEIGHT
    const fallbackHeight =
      textureFrame?.realHeight || textureFrame?.height || frameAsset.rect?.height || PET_LEVEL_ONE_HEIGHT
    const fallback = this.makeFrameContentBounds(fallbackWidth, fallbackHeight)

    if (!textureFrame) {
      this.contentBoundsByFrame.set(cacheKey, fallback)
      return fallback
    }

    try {
      const sourceImage = textureFrame.source.image as CanvasImageSource
      const width = Math.max(1, Math.round(textureFrame.cutWidth || fallbackWidth))
      const height = Math.max(1, Math.round(textureFrame.cutHeight || fallbackHeight))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        this.contentBoundsByFrame.set(cacheKey, fallback)
        return fallback
      }

      context.drawImage(
        sourceImage,
        textureFrame.cutX,
        textureFrame.cutY,
        width,
        height,
        0,
        0,
        width,
        height,
      )

      const pixels = context.getImageData(0, 0, width, height).data
      const columnAlphaCounts = Array.from({ length: width }, () => 0)
      const rowAlphaCounts = Array.from({ length: height }, () => 0)
      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1

      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] <= CONTENT_ALPHA_THRESHOLD) {
          continue
        }

        const pixelIndex = (index - 3) / 4
        const x = pixelIndex % width
        const y = Math.floor(pixelIndex / width)
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        columnAlphaCounts[x] += 1
        rowAlphaCounts[y] += 1
      }

      let bounds = fallback
      if (maxX >= minX && maxY >= minY) {
        const denseX = this.getDenseProjectionRange(columnAlphaCounts, minX, maxX)
        const denseY = this.getDenseProjectionRange(rowAlphaCounts, minY, maxY)
        bounds = this.makeFrameContentBounds(
          maxX - minX + 1,
          maxY - minY + 1,
          denseX.max - denseX.min + 1,
          denseY.max - denseY.min + 1,
        )
      }

      this.contentBoundsByFrame.set(cacheKey, bounds)
      return bounds
    } catch {
      this.contentBoundsByFrame.set(cacheKey, fallback)
      return fallback
    }
  }

  private makeFrameContentBounds(
    width: number,
    height: number,
    denseWidth = width,
    denseHeight = height,
  ): FrameContentBounds {
    const denseMajorSize = Math.max(denseWidth, denseHeight)
    const denseAreaSize = Math.sqrt(Math.max(1, denseWidth * denseHeight))
    return {
      width,
      height,
      denseWidth,
      denseHeight,
      visualSize:
        denseMajorSize * CONTENT_VISUAL_MAJOR_WEIGHT +
        denseAreaSize * CONTENT_VISUAL_AREA_WEIGHT,
    }
  }

  private getDenseProjectionRange(counts: number[], fallbackMin: number, fallbackMax: number) {
    const maxCount = Math.max(...counts)
    const threshold = Math.max(1, maxCount * CONTENT_DENSE_PROJECTION_RATIO)
    let min = fallbackMin
    let max = fallbackMax

    for (let index = fallbackMin; index <= fallbackMax; index += 1) {
      if ((counts[index] ?? 0) >= threshold) {
        min = index
        break
      }
    }

    for (let index = fallbackMax; index >= fallbackMin; index -= 1) {
      if ((counts[index] ?? 0) >= threshold) {
        max = index
        break
      }
    }

    return { min, max }
  }

  private getMedian(values: number[]) {
    if (values.length === 0) {
      return 0
    }

    const sorted = [...values].sort((first, second) => first - second)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]
  }

  private getCurrentFrameFallbackVisualSize() {
    if (!this.pet) {
      return PET_LEVEL_ONE_HEIGHT
    }

    const frameWidth = this.pet.frame.realWidth || this.pet.frame.width
    const frameHeight = this.pet.frame.realHeight || this.pet.frame.height
    return this.makeFrameContentBounds(frameWidth, frameHeight).visualSize
  }

  private playReactionMotion(
    reactionId: keyof typeof REACTION_MOTIONS,
    elapsedMs: number,
  ) {
    if (!this.pet) {
      return
    }

    const phase = this.getReactionPhase(reactionId, elapsedMs)
    const profile = phase ?? REACTION_MOTIONS[reactionId]
    this.playAnimation(profile.animation)
    this.applyAmbientMotion(this.time.now, profile.mood)

    const phaseKey = phase ? `${reactionId}:${phase.label}` : reactionId
    if (this.currentReactionId === reactionId && this.currentReactionPhase === phaseKey) {
      const reaction = this.bridge.getState().currentReaction
      if (reaction?.startedAt === this.currentReactionStartedAt) {
        return
      }
    }

    this.currentReactionId = reactionId
    this.currentReactionPhase = phaseKey
    this.currentReactionStartedAt = this.bridge.getState().currentReaction?.startedAt
    this.tweens.killTweensOf(this.pet)

    const originalX = this.pet.x
    const originalY = this.pet.y
    const direction = this.pet.flipX ? -1 : 1
    this.pet.setRotation(Phaser.Math.DegToRad(profile.lean * 0.45 * direction))

    this.tweens.add({
      targets: this.pet,
      x: originalX + profile.lean * direction,
      y: originalY - profile.hop,
      scaleX: this.baseScale * (1 + profile.squash),
      scaleY: this.baseScale * (1 - profile.squash),
      rotation: Phaser.Math.DegToRad(profile.lean * direction),
      duration: profile.settleMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.pet) {
          return
        }

        this.tweens.add({
          targets: this.pet,
          x: originalX,
          y: originalY,
          scaleX: this.baseScale,
          scaleY: this.baseScale,
          rotation: 0,
          duration: profile.settleMs + 120,
          ease: 'Back.easeOut',
        })
      },
    })
  }

  private getReactionPhase(
    reactionId: keyof typeof REACTION_MOTIONS,
    elapsedMs: number,
  ): PetMotionPhase | undefined {
    const sequence = REACTION_SEQUENCES[reactionId]
    if (!sequence) {
      return undefined
    }

    return sequence.reduce<PetMotionPhase | undefined>((active, phase) => {
      if (elapsedMs >= phase.at) {
        return phase
      }
      return active
    }, sequence[0])
  }

  private liveIdle(time: number, delta: number) {
    if (!this.pet) {
      return
    }

    if (this.activeMicro && time < this.activeMicroUntil) {
      this.playMicroBehavior(time, delta, this.activeMicro)
      return
    }

    if (this.activeMicro && time >= this.activeMicroUntil) {
      this.finishMicroBehavior()
    }

    const state = this.bridge.getState()

    if (time >= this.nextMicroAt && this.shouldChooseMicroBehavior(state)) {
      this.startMicroBehavior(time, chooseMicroBehavior(state))
      return
    }

    this.wanderAround(time, delta, state)
  }

  private wanderAround(time: number, delta: number, state = this.bridge.getState()) {
    if (!this.pet) {
      return
    }

    if (time >= this.wander.nextDecisionAt) {
      const wantsToRoam =
        state.boredom > 58 ||
        state.mood === 'playful' ||
        Math.random() < 0.2 + state.personality.curiosity / 400
      this.wander.nextDecisionAt = time + Phaser.Math.Between(3_800, 8_500)
      if (wantsToRoam) {
        this.wander.targetX = Phaser.Math.Between(74, WIDGET_SIZE - 52)
        this.wander.targetY = Phaser.Math.Between(170, WIDGET_SIZE - 12)
      } else {
        this.wander.targetX = this.pet.x
        this.wander.targetY = this.pet.y
      }
    }

    const distance = Phaser.Math.Distance.Between(
      this.pet.x,
      this.pet.y,
      this.wander.targetX,
      this.wander.targetY,
    )

    if (distance > 8) {
      const speed = state.mood === 'playful' ? 32 : state.mood === 'sleepy' ? 12 : 20
      this.moveToward(this.wander.targetX, this.wander.targetY, delta, speed)
      this.playAnimation('walk')
    } else {
      this.playAnimation('idle')
      this.applyAmbientMotion(time, state.mood === 'sleepy' ? 'sleepy' : 'soft')
      this.faceSoftlyTowardPointer()
    }
  }

  private shouldChooseMicroBehavior(state = this.bridge.getState()) {
    if (!this.pet) {
      return false
    }

    if (state.mood === 'sleepy' || state.energy < 35 || state.stress > 60) {
      return true
    }

    return Math.random() < 0.72
  }

  private startMicroBehavior(time: number, behavior: MicroBehaviorProfile) {
    if (!this.pet) {
      return
    }

    this.activeMicro = behavior
    this.activeMicroUntil = time + behavior.durationMs
    this.nextMicroAt = this.activeMicroUntil + Phaser.Math.Between(1_200, 3_800)
    this.tweens.killTweensOf(this.pet)
    this.playAnimation(behavior.animation)
    this.currentReactionId = undefined

    const direction = this.lastPointerX < this.pet.x ? -1 : 1
    const originalX = this.pet.x
    const originalY = this.pet.y

    this.pet.setFlipX(direction < 0)
    this.tweens.add({
      targets: this.pet,
      x: originalX + behavior.lean * direction,
      y: originalY - behavior.hop,
      scaleX: this.baseScale * (1 + behavior.scalePulse),
      scaleY: this.baseScale * (1 - behavior.scalePulse * 0.65),
      rotation: Phaser.Math.DegToRad(behavior.lean * direction * 0.45),
      yoyo: true,
      repeat: behavior.id === 'annoyed_tail' || behavior.id === 'bored_paw_tap' ? 2 : 0,
      duration: Math.min(420, behavior.durationMs / 3),
      ease: behavior.mood === 'reject' ? 'Cubic.easeOut' : 'Sine.easeInOut',
    })
  }

  private playMicroBehavior(
    time: number,
    delta: number,
    behavior: MicroBehaviorProfile,
  ) {
    if (!this.pet) {
      return
    }

    this.applyAmbientMotion(time, behavior.mood)

    if (behavior.id === 'tiny_pounce') {
      this.playBounce(delta, 0.45)
      return
    }

    if (behavior.id === 'curious_step') {
      const direction = this.lastPointerX < this.pet.x ? -1 : 1
      this.moveToward(
        Phaser.Math.Clamp(this.pet.x + direction * 18, 54, WIDGET_SIZE - 54),
        this.pet.y,
        delta,
        18,
      )
    }
  }

  private finishMicroBehavior() {
    if (!this.pet) {
      return
    }

    this.activeMicro = undefined
    this.tweens.killTweensOf(this.pet)
    this.pet.setScale(this.baseScale)
    this.pet.setRotation(0)
    this.currentReactionPhase = undefined
    this.playAnimation('idle')
  }

  private faceSoftlyTowardPointer() {
    if (!this.pet) {
      return
    }

    const distance = Math.abs(this.lastPointerX - this.pet.x)
    if (distance > 24) {
      this.pet.setFlipX(this.lastPointerX < this.pet.x)
    }
  }

  private applyPointerGaze() {
    if (!this.pet || isUserTyping()) {
      return
    }

    const pointer = this.bridge.getPointer()
    if (!pointer.active) {
      return
    }

    const canvasBounds = this.game.canvas.getBoundingClientRect()
    const pointerX = ((pointer.x - canvasBounds.left) / canvasBounds.width) * WIDGET_SIZE
    const pointerY = ((pointer.y - canvasBounds.top) / canvasBounds.height) * WIDGET_SIZE
    this.lastPointerX = pointerX

    const headX = this.pet.x
    const headY = this.pet.y - this.pet.displayHeight * 0.58
    const dx = pointerX - headX
    const dy = pointerY - headY
    const distance = Math.max(1, Math.hypot(dx, dy))
    const targetRotation = Phaser.Math.Clamp(
      (dx / distance) * 0.075 + (dy / distance) * 0.035,
      -0.12,
      0.12,
    )

    if (this.isDirectionalRunAnimation()) {
      this.pet.setFlipX(false)
      this.pet.setRotation(
        Phaser.Math.Linear(this.pet.rotation, this.currentFollowTilt, 0.42),
      )
      return
    }

    this.pet.setFlipX(dx < 0)
    this.pet.setRotation(Phaser.Math.Linear(this.pet.rotation, targetRotation, 0.38))
  }

  private playBounce(delta: number, intensity: number) {
    if (!this.pet) {
      return
    }

    const targetX = Phaser.Math.Clamp(
      this.pet.x + 0.08 * delta * intensity,
      52,
      WIDGET_SIZE - 52,
    )
    const targetY = 178 + Math.sin(this.time.now / 90) * 18 * intensity
    this.pet.setPosition(targetX, targetY)
  }

  private applyAmbientMotion(time: number, mood: MotionMood) {
    if (!this.pet || this.currentReactionId) {
      return
    }

    const speed = mood === 'sleepy' ? 950 : mood === 'playful' ? 280 : 620
    const breath = Math.sin(time / speed + this.breathingPhase)
    const scaleY = this.baseScale * (1 + breath * 0.018)
    const scaleX = this.baseScale * (1 - breath * 0.012)
    const rotation =
      mood === 'soft' ? Math.sin(time / 1_250) * 0.025 : Math.sin(time / 780) * 0.015

    this.pet.setScale(scaleX, scaleY)
    this.pet.setRotation(rotation)
  }

  private moveToward(targetX: number, targetY: number, delta: number, speed: number) {
    if (!this.pet) {
      return
    }

    const distance = Phaser.Math.Distance.Between(this.pet.x, this.pet.y, targetX, targetY)
    if (distance <= 1) {
      return
    }

    const step = Math.min(distance, (speed * delta) / 1_000)
    const angle = Phaser.Math.Angle.Between(this.pet.x, this.pet.y, targetX, targetY)
    this.pet.x += Math.cos(angle) * step
    this.pet.y += Math.sin(angle) * step
    if (!this.isDirectionalRunAnimation()) {
      this.pet.setFlipX(targetX < this.pet.x)
    }
    this.currentReactionId = undefined
    this.currentReactionPhase = undefined
    this.activeMicro = undefined
    this.pet.setScale(this.baseScale)
  }
}
