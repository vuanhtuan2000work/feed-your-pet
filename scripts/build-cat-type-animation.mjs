import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = 'public/assets/pet/cat_type'
const outputDir = 'public/assets/pet/cat/cat_type'
const frameSize = 192

const sources = [
  {
    file: '10-types-thuan-chung-3.png',
    boxes: [
      [42, 243, 246, 561],
      [279, 249, 483, 558],
      [525, 249, 723, 558],
      [765, 246, 969, 558],
      [1023, 252, 1221, 558],
      [39, 705, 222, 903],
      [276, 705, 456, 903],
      [519, 711, 702, 903],
      [759, 705, 963, 903],
      [1017, 720, 1197, 891],
    ],
  },
  {
    file: 'c6475356-a0d4-4e91-81da-7bdd8006478e.png',
    boxes: [
      [48, 261, 237, 555],
      [294, 267, 486, 555],
      [522, 252, 717, 555],
      [765, 252, 966, 564],
      [1017, 252, 1212, 558],
      [36, 714, 231, 903],
      [288, 720, 456, 903],
      [528, 726, 693, 903],
      [765, 735, 963, 903],
      [1026, 720, 1176, 903],
    ],
  },
  {
    file: 'ChatGPT Image Jun 16, 2026, 04_17_05 PM (4).png',
    boxes: [
      [72, 195, 249, 474],
      [282, 195, 492, 477],
      [540, 198, 720, 480],
      [768, 198, 969, 480],
      [1014, 192, 1221, 483],
      [30, 597, 255, 903],
      [288, 627, 492, 897],
      [516, 597, 750, 903],
      [768, 612, 972, 903],
      [996, 615, 1209, 903],
    ],
  },
  {
    file: 'ChatGPT Image Jun 16, 2026, 04_17_12 PM (4).png',
    boxes: [
      [48, 150, 246, 390],
      [288, 150, 486, 393],
      [528, 150, 741, 393],
      [780, 150, 963, 390],
      [1029, 150, 1218, 390],
      [57, 525, 246, 774],
      [297, 525, 483, 774],
      [519, 525, 741, 777],
      [780, 534, 963, 774],
      [1020, 486, 1224, 777],
    ],
  },
  {
    file: 'ChatGPT Image Jun 16, 2026, 04_17_17 PM (4).png',
    boxes: [
      [30, 234, 237, 615],
      [285, 237, 498, 615],
      [540, 330, 720, 615],
      [759, 231, 966, 621],
      [1005, 234, 1221, 624],
    ],
  },
]

function averageCornerColor(data, width, height) {
  const samples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  const total = samples.reduce(
    (sum, [x, y]) => {
      const offset = (y * width + x) * 4
      return [sum[0] + data[offset], sum[1] + data[offset + 1], sum[2] + data[offset + 2]]
    },
    [0, 0, 0],
  )

  return total.map((value) => value / samples.length)
}

function removePaperBackground(data, width, height) {
  const background = averageCornerColor(data, width, height)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const distance = Math.hypot(r - background[0], g - background[1], b - background[2])
      const isPaper = distance < 26 && r > 218 && g > 210 && b > 198

      if (isPaper) {
        data[offset + 3] = 0
        continue
      }

      if (data[offset + 3] > 12) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { data, box: { left: 0, top: 0, width, height } }
  }

  const pad = 8
  return {
    data,
    box: {
      left: Math.max(0, minX - pad),
      top: Math.max(0, minY - pad),
      width: Math.min(width, maxX - minX + 1 + pad * 2),
      height: Math.min(height, maxY - minY + 1 + pad * 2),
    },
  }
}

async function buildFrame(sourceFile, box, frameIndex) {
  const [left, top, right, bottom] = box
  const width = right - left
  const height = bottom - top
  const extracted = await sharp(path.join(sourceDir, sourceFile))
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const normalized = removePaperBackground(
    Buffer.from(extracted.data),
    extracted.info.width,
    extracted.info.height,
  )

  const output = path.join(outputDir, `cat_type_${String(frameIndex).padStart(3, '0')}.png`)
  await sharp(normalized.data, {
    raw: {
      width: extracted.info.width,
      height: extracted.info.height,
      channels: 4,
    },
  })
    .extract(normalized.box)
    .resize({
      width: frameSize,
      height: frameSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output)
}

await mkdir(outputDir, { recursive: true })

let frameIndex = 1
for (const source of sources) {
  for (const box of source.boxes) {
    await buildFrame(source.file, box, frameIndex)
    frameIndex += 1
  }
}

console.log(`Generated ${frameIndex - 1} cat type frames in ${outputDir}`)
