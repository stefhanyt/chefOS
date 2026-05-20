/**
 * Generates PNG icons for the PWA from icon.svg.
 * Run once after setup: node scripts/generate-icons.mjs
 *
 * Requires: npm install --save-dev sharp
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const svgPath = resolve(root, 'public/icons/icon.svg')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Please install sharp first: npm install --save-dev sharp')
  process.exit(1)
}

if (!existsSync(svgPath)) {
  console.error('SVG icon not found at', svgPath)
  process.exit(1)
}

const svg = readFileSync(svgPath)

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const out = resolve(root, 'public/icons', name)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`Created ${out}`)
}

console.log('Done! PNG icons are ready in public/icons/')
