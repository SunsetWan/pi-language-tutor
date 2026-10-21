/**
 * LLM access: model resolution, completion calls, and the session-fork
 * machinery that lets a call replay the main session's request prefix so the
 * provider's prompt cache is reused.
 */

import type { Message, SimpleStreamOptions } from '@earendil-works/pi-ai'
import { convertToLlm } from '@earendil-works/pi-coding-agent'
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { finalAssistantReplyText, resolveStoredModelReference } from './core.ts'
import type { Config } from './core.ts'

export type ResolvedModel = NonNullable<ExtensionContext['model']>

/** The last request's transcript includes its system prompt and tool declarations. */
export interface ForkContext {
  messages: Message[]
  reasoning: SimpleStreamOptions['reasoning']
}

/** The model to use for checks and translations: the configured override, else the session model. */
export function resolveModel(ctx: ExtensionContext, cfg: Config): ResolvedModel | undefined {
  if (cfg.model && cfg.model !== 'default') {
    // A saved canonical provider/id is restored exactly; only hand-edited
    // bare ids go through CLI-style disambiguation. `needsAuth` is returned
    // too: an override whose provider lost its auth (/logout, env var
    // removed) must fail visibly at the runtime auth check, not silently
    // re-route side-calls to another provider.
    const resolved = resolveStoredModelReference(
      cfg.model,
      ctx.modelRegistry.getAvailable(),
      ctx.modelRegistry.getAll()
    )
    if (resolved.kind === 'found' || resolved.kind === 'needsAuth') return resolved.model
  }
  return ctx.model
}

/** Run a single-prompt completion; with `fork`, replay the session prefix first. */
export async function runLlm(
  ctx: ExtensionContext,
  model: ResolvedModel,
  prompt: string,
  signal?: AbortSignal,
  fork?: ForkContext
): Promise<string | undefined> {
  const user: Message = {
    role: 'user',
    content: [{ type: 'text' as const, text: prompt }],
    timestamp: Date.now()
  }
  // The registry owns authentication, transcript preparation and virtual-model routing.
  const response = await ctx.modelRegistry
    .streamSimple(
      model,
      { messages: [...(fork?.messages ?? []), user] },
      {
        signal,
        ...(fork ? { reasoning: fork.reasoning, sessionId: ctx.sessionManager.getSessionId() } : {})
      }
    )
    .result()

  return finalAssistantReplyText(response)
}

/**
 * Track the main session's LLM requests so `makeFork` can replay the exact
 * prefix of the most recent one. Returns undefined before the first request
 * (callers then fall back to a context-free call).
 */
export function createForkTracker(pi: ExtensionAPI): {
  makeFork(): ForkContext | undefined
} {
  let fork: ForkContext | undefined

  pi.on('context_with_system', (event) => {
    const thinking = pi.getThinkingLevel()
    fork = {
      messages: convertToLlm(event.messages),
      reasoning: thinking === 'off' ? undefined : thinking
    }
  })

  const clear = () => {
    fork = undefined
  }
  pi.on('session_tree', clear)
  pi.on('session_start', clear)

  return { makeFork: () => fork }
}
