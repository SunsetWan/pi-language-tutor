import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux'
import { initTheme, SessionManager } from '@earendil-works/pi-coding-agent'
import type { EntryRenderer, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { loadConfig, saveConfig } from '../src/config.ts'
import { normalizeStoredConfig } from '../src/core.ts'
import { loadCards, saveCards } from '../src/flashcards.ts'
import { registerReview } from '../src/grammar.ts'
import { runLlm } from '../src/llm.ts'
import { registerLangSettings } from '../src/settings.ts'
import { registerTranslation } from '../src/translate.ts'

vi.mock('../src/config.ts', () => ({
  loadConfig: vi.fn<typeof loadConfig>(),
  saveConfig: vi.fn<typeof saveConfig>()
}))
vi.mock('../src/llm.ts', () => ({
  resolveModel: (ctx: ExtensionContext) => ctx.model,
  runLlm: vi.fn<typeof runLlm>()
}))
vi.mock('../src/flashcards.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/flashcards.ts')>()),
  loadCards: vi.fn<typeof loadCards>(() => []),
  saveCards: vi.fn<typeof saveCards>()
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runLlm).mockReset()
  vi.mocked(loadConfig).mockReturnValue(normalizeStoredConfig({}))
  initTheme('dark')
})

function setup() {
  const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => unknown>()
  const commands = new Map<string, { handler: (args: string, ctx: ExtensionContext) => unknown }>()
  const renderers = new Map<string, EntryRenderer>()
  const session = SessionManager.inMemory()
  const ui = {
    notify: vi.fn<ExtensionContext['ui']['notify']>(),
    setStatus: vi.fn<ExtensionContext['ui']['setStatus']>(),
    setWidget: vi.fn<ExtensionContext['ui']['setWidget']>()
  }
  const model = { provider: 'test', id: 'session' }
  const ctx = {
    hasUI: true,
    mode: 'tui',
    ui,
    model,
    sessionManager: session,
    modelRegistry: { getAvailable: () => [model], getAll: () => [model] }
  } as unknown as ExtensionContext
  const pi = {
    on: (name: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) =>
      handlers.set(name, handler),
    registerCommand: (
      name: string,
      command: { handler: (args: string, ctx: ExtensionContext) => unknown }
    ) => commands.set(name, command),
    registerShortcut: vi.fn<ExtensionAPI['registerShortcut']>(),
    registerEntryRenderer: (name: string, renderer: EntryRenderer) => renderers.set(name, renderer),
    registerMessageRenderer: vi.fn<ExtensionAPI['registerMessageRenderer']>(),
    appendEntry: (name: string, data: unknown) => session.appendCustomEntry(name, data)
  } as unknown as ExtensionAPI
  return {
    pi,
    ctx,
    ui,
    session,
    renderers,
    commands,
    emit: (name: string, event = {}) => handlers.get(name)?.(event, ctx)
  }
}

const answer =
  'This is a complete assistant response with enough words to qualify for automatic translation in the language tutor.'

describe('Pi translation entries and events', () => {
  it('renders custom entries and keeps them out of model context', async () => {
    const h = setup()
    registerTranslation(h.pi, { makeFork: () => undefined })
    h.session.appendMessage(fauxAssistantMessage(answer))
    vi.mocked(runLlm).mockResolvedValue('{"t":["Translated paragraph"]}')
    await h.commands.get('translate')!.handler('', h.ctx)
    const entry = h.session.getBranch().at(-1)!
    expect(entry.type).toBe('custom')
    if (entry.type !== 'custom') throw new Error('Missing translation entry')
    const theme = {
      bg: (_color: string, text: string) => text,
      fg: (_color: string, text: string) => text,
      bold: (text: string) => text
    }
    const card = h.renderers.get('lang-translation')!(entry, { expanded: false }, theme as never)
    const text = card!.render(100).join('\n')
    expect(text).toContain('Translated paragraph')
    expect(text).toContain('译文')
    expect(h.session.buildSessionContext().messages).toHaveLength(1)
    expect(h.pi.registerMessageRenderer).not.toHaveBeenCalled()
  })

  it('translates only settled replies and uses entry identity to deduplicate', async () => {
    vi.mocked(loadConfig).mockReturnValue(normalizeStoredConfig({ auto: true }))
    const h = setup()
    registerTranslation(h.pi, { makeFork: () => undefined })
    vi.mocked(runLlm).mockResolvedValue('{"t":["Translation"]}')
    h.session.appendMessage(fauxAssistantMessage(answer, { stopReason: 'toolUse' }))
    h.emit('turn_end')
    h.emit('agent_settled', { aborted: false })
    expect(runLlm).not.toHaveBeenCalled()
    h.session.appendMessage(fauxAssistantMessage(answer))
    h.emit('agent_settled', { aborted: false })
    await vi.waitFor(() => expect(h.session.getBranch().at(-1)?.type).toBe('custom'))
    h.emit('agent_settled', { aborted: false })
    expect(runLlm).toHaveBeenCalledTimes(1)
    h.session.appendMessage(fauxAssistantMessage(answer))
    h.emit('agent_settled', { aborted: false })
    await vi.waitFor(() => expect(runLlm).toHaveBeenCalledTimes(2))
  })

  it('does not auto-translate an aborted run', () => {
    vi.mocked(loadConfig).mockReturnValue(normalizeStoredConfig({ auto: true }))
    const h = setup()
    registerTranslation(h.pi, { makeFork: () => undefined })
    h.session.appendMessage(fauxAssistantMessage(answer))
    h.emit('agent_settled', { aborted: true })
    expect(runLlm).not.toHaveBeenCalled()
  })

  it('retries a rejected context request without the transcript', async () => {
    vi.mocked(loadConfig).mockReturnValue(normalizeStoredConfig({ context: true }))
    const h = setup()
    const fork = { messages: [], reasoning: undefined }
    registerTranslation(h.pi, { makeFork: () => fork })
    h.session.appendMessage(fauxAssistantMessage(answer))
    vi.mocked(runLlm)
      .mockRejectedValueOnce(new Error('Context rejected'))
      .mockResolvedValueOnce('{"t":["Translation"]}')
    await h.commands.get('translate')!.handler('', h.ctx)
    expect(vi.mocked(runLlm).mock.calls.map((call) => call[4])).toEqual([fork, undefined])
    expect(h.session.getBranch().at(-1)?.type).toBe('custom')
  })

  it('keeps whole-text fallback when paragraph JSON is invalid', async () => {
    const h = setup()
    registerTranslation(h.pi, { makeFork: () => undefined })
    h.session.appendMessage(fauxAssistantMessage(answer))
    vi.mocked(runLlm)
      .mockResolvedValueOnce('invalid JSON')
      .mockResolvedValueOnce('Whole translation')
    await h.commands.get('translate')!.handler('', h.ctx)
    expect(h.session.getBranch().at(-1)).toMatchObject({ data: { text: 'Whole translation' } })
  })
})

describe('Pi review and settings', () => {
  it('shows writing corrections without blocking interactive input', async () => {
    const h = setup()
    registerReview(h.pi, { makeFork: () => undefined })
    vi.mocked(runLlm).mockResolvedValue(
      '{"mode":"check","items":[{"wrong":"anwser","right":"answer","reason":"Spelling"}]}'
    )
    expect(
      h.emit('input', { source: 'interactive', text: 'Please anwser this question for me' })
    ).toBeUndefined()
    await vi.waitFor(() => expect(h.ui.setWidget).toHaveBeenCalledOnce())
    expect(saveCards).not.toHaveBeenCalled()
  })

  it('captures tutor words as flashcards after context-free retry', async () => {
    vi.mocked(loadConfig).mockReturnValue(normalizeStoredConfig({ check: 'context' }))
    const h = setup()
    const fork = { messages: [], reasoning: undefined }
    registerReview(h.pi, { makeFork: () => fork })
    vi.mocked(runLlm)
      .mockResolvedValueOnce('Agent prose instead of review JSON')
      .mockResolvedValueOnce(
        '{"mode":"tutor","sentence":"Refactor this function.","words":[{"word":"refactor","note":"Change the structure"}],"grammar":[]}'
      )
    h.emit('input', { source: 'interactive', text: '我想重构这个函数但是不知道怎么下手' })
    await vi.waitFor(() => expect(saveCards).toHaveBeenCalledOnce())
    expect(vi.mocked(runLlm).mock.calls.map((call) => call[4])).toEqual([fork, undefined])
    expect(loadCards).toHaveBeenCalledOnce()
    expect(saveCards).toHaveBeenCalledWith([expect.objectContaining({ word: 'refactor' })])
    expect(h.ui.setWidget).toHaveBeenCalledOnce()
  })

  it('warns on model_select and saves settings through /lang', async () => {
    const h = setup()
    registerLangSettings(h.pi, { disableReview: vi.fn<(ctx: ExtensionContext) => void>() })
    await h.commands.get('lang')!.handler('auto on', h.ctx)
    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ auto: true }))
    vi.mocked(loadConfig).mockReturnValue(
      normalizeStoredConfig({ context: true, model: 'other/model' })
    )
    h.ui.notify.mockClear()
    h.emit('model_select')
    expect(h.ui.notify).toHaveBeenCalledWith(expect.stringContaining('other/model'), 'warning')
    h.emit('agent_start')
    expect(h.ui.notify).toHaveBeenCalledOnce()
  })
})
