import { describe, expect, it, vi } from 'vitest'
import {
  fauxAssistantMessage,
  fauxProvider,
  type FauxResponseFactory
} from '@earendil-works/pi-ai/providers/faux'
import { InMemoryCredentialStore } from '@earendil-works/pi-ai'
import { ModelRegistry, ModelRuntime } from '@earendil-works/pi-coding-agent'
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { createForkTracker, runLlm } from '../src/llm.ts'

async function setup() {
  const runtime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: null,
    refreshOnCreate: false
  })
  const registry = new ModelRegistry(runtime)
  const faux = fauxProvider({ provider: 'tutor-test' })
  registry.registerProvider(faux.provider)
  const ctx = {
    modelRegistry: registry,
    sessionManager: { getSessionId: () => 'test-session' }
  } as ExtensionContext
  return { registry, faux, ctx, model: faux.getModel() }
}

describe('Pi SDK side calls', () => {
  it('uses a keyless native provider and returns trimmed text', async () => {
    const { faux, ctx, model } = await setup()
    faux.setResponses([fauxAssistantMessage('  translated\n')])
    await expect(runLlm(ctx, model, 'translate this')).resolves.toBe('translated')
    expect(faux.state.callCount).toBe(1)
  })

  it('keeps the full transcript, tools, reasoning and session cache key', async () => {
    const { faux, ctx, model } = await setup()
    const messages = [
      {
        role: 'system' as const,
        content: 'Session instructions',
        toolsAdded: [{ name: 'read', description: 'Read a file', parameters: { type: 'object' } }],
        timestamp: 0
      },
      { role: 'user' as const, content: 'Previous prompt', timestamp: 1 }
    ]
    const response = vi.fn<FauxResponseFactory>((context, options) => {
      expect(context.messages.slice(0, -1)).toEqual(messages)
      expect(context.messages.at(-1)).toMatchObject({
        role: 'user',
        content: [{ type: 'text', text: 'translate this' }]
      })
      expect(options).toMatchObject({ reasoning: 'high', sessionId: 'test-session' })
      return fauxAssistantMessage('translated')
    })
    faux.setResponses([response])
    await expect(
      runLlm(ctx, model, 'translate this', undefined, {
        messages,
        reasoning: 'high'
      })
    ).resolves.toBe('translated')
    expect(response).toHaveBeenCalledOnce()
  })

  it('lets the runtime apply provider authentication and its request URL', async () => {
    const { registry, faux, ctx, model } = await setup()
    registry.registerProvider({
      ...faux.provider,
      auth: {
        apiKey: {
          name: 'Test',
          resolve: async () => ({
            auth: {
              apiKey: 'test-key',
              headers: { 'x-test': 'yes' },
              baseUrl: 'https://test.invalid'
            },
            env: { TEST_PROVIDER: 'yes' }
          })
        }
      }
    })
    const response = vi.fn<FauxResponseFactory>((_context, options, _state, requestModel) => {
      expect(requestModel.baseUrl).toBe('https://test.invalid')
      expect(options).toMatchObject({
        apiKey: 'test-key',
        headers: { 'x-test': 'yes' },
        env: { TEST_PROVIDER: 'yes' }
      })
      return fauxAssistantMessage('ok')
    })
    faux.setResponses([response])
    await expect(runLlm(ctx, model, 'translate')).resolves.toBe('ok')
    expect(response).toHaveBeenCalledOnce()
  })

  it('supports config-registered providers', async () => {
    const { registry, faux, ctx, model } = await setup()
    registry.unregisterProvider(model.provider)
    registry.registerProvider(model.provider, {
      api: model.api,
      baseUrl: 'https://test.invalid',
      apiKey: 'test-key',
      models: [model],
      streamSimple: faux.provider.streamSimple
    })
    faux.setResponses([fauxAssistantMessage('ok')])
    await expect(runLlm(ctx, model, 'translate')).resolves.toBe('ok')
  })

  it('routes virtual models through the runtime', async () => {
    const { registry, faux, ctx, model } = await setup()
    await registry.refresh({ allowNetwork: false })
    const route = vi.fn<() => { model: typeof model; thinkingLevel: 'off' }>(() => ({
      model,
      thinkingLevel: 'off'
    }))
    registry.registerVirtualModel({ provider: 'router', id: 'auto', name: 'Auto', route })
    faux.setResponses([fauxAssistantMessage('routed')])
    await expect(runLlm(ctx, registry.find('router', 'auto')!, 'translate')).resolves.toBe('routed')
    expect(route).toHaveBeenCalledOnce()
  })

  it.each(['toolUse', 'error', 'aborted'] as const)(
    'rejects partial output after %s',
    async (stopReason) => {
      const { faux, ctx, model } = await setup()
      faux.setResponses([fauxAssistantMessage('partial output', { stopReason })])
      await expect(runLlm(ctx, model, 'translate')).resolves.toBeUndefined()
    }
  )

  it('does not send a cancelled request to the provider', async () => {
    const { faux, ctx, model } = await setup()
    const signal = AbortSignal.abort()
    await expect(runLlm(ctx, model, 'translate', signal)).resolves.toBeUndefined()
    expect(faux.state.callCount).toBe(0)
  })

  it('returns no output when authentication fails', async () => {
    const { registry, faux, ctx, model } = await setup()
    registry.registerProvider({
      ...faux.provider,
      auth: {
        apiKey: {
          name: 'Test',
          resolve: async () => {
            throw new Error('Missing credentials')
          }
        }
      }
    })
    await expect(runLlm(ctx, model, 'translate')).resolves.toBeUndefined()
    expect(faux.state.callCount).toBe(0)
  })
})

it('captures the complete Pi transcript and clears it on navigation', () => {
  const handlers = new Map<string, (event: unknown) => void>()
  const pi = {
    on: (name: string, handler: (event: unknown) => void) => {
      handlers.set(name, handler)
    },
    getThinkingLevel: () => 'high'
  } as ExtensionAPI
  const tracker = createForkTracker(pi)
  expect(tracker.makeFork()).toBeUndefined()
  const messages = [
    { role: 'system', content: 'Session instructions', timestamp: 0 },
    { role: 'user', content: 'Hello', timestamp: 1 }
  ]
  handlers.get('context_with_system')!({ messages })
  expect(tracker.makeFork()).toEqual({ messages, reasoning: 'high' })
  handlers.get('session_tree')!({})
  expect(tracker.makeFork()).toBeUndefined()
  handlers.get('context_with_system')!({ messages })
  handlers.get('session_start')!({})
  expect(tracker.makeFork()).toBeUndefined()
})
