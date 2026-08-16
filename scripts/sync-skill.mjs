/**
 * Sync the global dsh-plugin-development skill into this repo's docs copy.
 *
 * The global skill (~/.dsh/skills/dsh-plugin-development/SKILL.md) is the
 * authoritative, self-evolving SOP. After improving it (per its
 * Self-evolution protocol), run this to mirror it into the project:
 *
 *   node scripts/sync-skill.mjs
 *
 * Requires DSH_HOME (defaults to ~/.dsh). Zero dependencies.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
const source = join(dshHome, 'skills', 'dsh-plugin-development', 'SKILL.md')
const target = join(root, 'docs', 'DSH-PLUGIN-DEVELOPMENT-SOP.md')

if (!existsSync(source)) {
  console.error(`global skill not found: ${source}`)
  process.exit(1)
}

// Preserve a per-repo header if the project copy already has one (e.g. a
// "synced from" note); otherwise write the global skill verbatim.
const content = readFileSync(source, 'utf8')
writeFileSync(target, content, 'utf8')

console.log(`synced: ${source}`)
console.log(`  -> ${target} (${content.length} bytes)`)
