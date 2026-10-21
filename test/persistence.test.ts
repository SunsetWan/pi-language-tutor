import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'

const agentDir = mkdtempSync(join(tmpdir(), 'language-tutor-test-'))
vi.stubEnv('PI_CODING_AGENT_DIR', agentDir)
const { loadConfig, saveConfig } = await import('../src/config.ts')
const { addCards, loadCards, saveCards } = await import('../src/flashcards.ts')
const { loadSettings, saveSettings } = await import('../src/flashcard-settings.ts')

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(agentDir, { recursive: true, force: true })
})

it('persists settings and flashcards in the Pi agent directory', () => {
  const cfg = { ...loadConfig(), native: 'ja', context: true, model: 'test/model' }
  saveConfig(cfg)
  expect(loadConfig()).toEqual(cfg)
  expect(JSON.parse(readFileSync(join(agentDir, 'language-learn.json'), 'utf8'))).toMatchObject(cfg)

  const cards = loadCards()
  addCards(cards, [{ word: 'refactor', note: 'Change the structure' }], 'tutor')
  saveCards(cards)
  expect(loadCards()).toEqual(cards)
  expect(loadCards()[0].fsrs.due).toBeInstanceOf(Date)
  expect(JSON.parse(readFileSync(join(agentDir, 'flashcards.json'), 'utf8'))).toHaveLength(1)

  const settings = { ...loadSettings(), newPerDay: 12, sessionLimit: 8 }
  saveSettings(settings)
  expect(loadSettings()).toEqual(settings)
  expect(JSON.parse(readFileSync(join(agentDir, 'flashcards-settings.json'), 'utf8'))).toEqual(
    settings
  )
})
