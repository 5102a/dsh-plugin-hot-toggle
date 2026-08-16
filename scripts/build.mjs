/**
 * dsh-plugin-hot-toggle — zero-dependency client bundle build.
 *
 * Wraps src/client.js (a CommonJS module that requires('react')) into the
 * window.__ModuleLoader__.load({ id, factory }) carrier the DSH web shell
 * executes. No bundler, no transform: the source IS the factory body, so the
 * built artifact stays byte-faithful to what you review.
 *
 * Usage:  node scripts/build.mjs   (also wired as `npm run build` / `prepare`)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcPath = join(root, 'src', 'client.js')
const outPath = join(root, 'lib', 'client.js')

const source = readFileSync(srcPath, 'utf8')

const bundle = `/**
 * dsh-plugin-hot-toggle — client half (Web).
 * Generated from src/client.js by scripts/build.mjs — do not edit by hand.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-hot-toggle',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

${source}

    return module.exports
  },
})
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, bundle, 'utf8')
console.log(`built ${outPath} (${bundle.length} bytes)`)
