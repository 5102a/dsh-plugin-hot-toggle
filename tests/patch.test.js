/**
 * dsh-plugin-hot-toggle — unit tests (node:test, zero deps).
 * Run with: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPatchContent } from '../index.js'

test('buildPatchContent: empty content becomes a block list', () => {
  const out = buildPatchContent('', 'session-title-llm', false)
  assert.equal(out, '- id: session-title-llm\n  disabled: true\n')
})

test('buildPatchContent: [] array literal is replaced, comments preserved', () => {
  const input = '# header comment\n[]\n'
  const out = buildPatchContent(input, 'session-title-llm', false)
  assert.ok(out.startsWith('# header comment\n'))
  assert.ok(out.includes('- id: session-title-llm\n  disabled: true'))
  assert.ok(!out.includes('[]'))
})

test('buildPatchContent: updates existing disabled line', () => {
  const input = '- id: session-title-llm\n  disabled: true\n'
  const out = buildPatchContent(input, 'session-title-llm', true)
  assert.equal(out, '- id: session-title-llm\n  disabled: false\n')
})

test('buildPatchContent: appends new entry when absent', () => {
  const input = '- id: timer\n  disabled: true\n'
  const out = buildPatchContent(input, 'dsh-memory-evolve', false)
  assert.ok(out.includes('- id: dsh-memory-evolve\n  disabled: true'))
  assert.ok(out.includes('- id: timer'))
})

test('buildPatchContent: multiple entries stay valid block structure', () => {
  const input = '- id: a\n  disabled: true\n- id: b\n  disabled: false\n'
  const out = buildPatchContent(input, 'b', true)
  assert.equal(out, '- id: a\n  disabled: true\n- id: b\n  disabled: false\n')
})

test('buildPatchContent: enable writes explicit disabled: false (overrides bundle layer)', () => {
  const out = buildPatchContent('[]\n', 'web-runtime', true)
  assert.ok(out.includes('- id: web-runtime\n  disabled: false'))
})

test('buildPatchContent: generated YAML parses as the expected patch list', async () => {
  // Use the real profile patch shape: comments + [].
  const input = '# layer\n[]\n'
  const out1 = buildPatchContent(input, 'session-title-llm', false)
  const out2 = buildPatchContent(out1, 'dsh-memory-evolve', false)
  // Rough structural assertions (no yaml dep in tests).
  const lines = out2.split('\n').filter(Boolean)
  assert.ok(lines.some((l) => l === '- id: session-title-llm'))
  assert.ok(lines.some((l) => l === '  disabled: true'))
  assert.ok(lines.some((l) => l === '- id: dsh-memory-evolve'))
  // Every `- id:` block owns a following `disabled:` line before the next `- id:`.
  const blocks = out2.split(/(?=- id: )/).filter((b) => b.startsWith('- id:'))
  for (const block of blocks) assert.ok(/disabled: (true|false)/.test(block), `block missing disabled: ${block}`)
})
