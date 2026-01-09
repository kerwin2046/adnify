/**
 * 上下文压缩服务
 * 
 * 职责：使用 LLM 生成对话摘要
 * 与 ContextManager 配合，提供更高质量的摘要
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { useAgentStore } from '../store/AgentStore'
import { ChatMessage, isAssistantMessage, TextContent, ToolCallPart } from '../types'
import { estimateTokens } from '../context/TokenEstimator'
import { getAgentConfig } from '../utils/AgentConfig'

/** 压缩状态 */
interface CompactionState {
  isCompacting: boolean
  lastCompactedAt: number | null
  summary: string | null
  compactedMessageIds: Set<string>
}

class ContextCompactionServiceClass {
  private state: CompactionState = {
    isCompacting: false,
    lastCompactedAt: null,
    summary: null,
    compactedMessageIds: new Set(),
  }

  private compactionQueue: Promise<string | null> | null = null

  getSummary(): string | null {
    return this.state.summary
  }

  isCompacting(): boolean {
    return this.state.isCompacting
  }

  /**
   * 请求 LLM 生成摘要
   */
  async requestCompaction(messages: ChatMessage[]): Promise<string | null> {
    if (this.compactionQueue) {
      return this.compactionQueue
    }

    this.compactionQueue = this.doCompaction(messages)

    try {
      return await this.compactionQueue
    } finally {
      this.compactionQueue = null
    }
  }

  private async doCompaction(messages: ChatMessage[]): Promise<string | null> {
    if (this.state.isCompacting) {
      return this.state.summary
    }

    // 过滤出需要压缩的消息
    const config = getAgentConfig()
    const keepCount = config.keepRecentTurns * 2
    
    if (messages.length <= keepCount) {
      return this.state.summary
    }

    const messagesToCompact = messages.slice(0, -keepCount)
    const newMessages = messagesToCompact.filter(m => !this.state.compactedMessageIds.has(m.id))

    if (newMessages.length === 0 && this.state.summary) {
      return this.state.summary
    }

    this.state.isCompacting = true
    logger.agent.info(`[ContextCompaction] Compacting ${newMessages.length} messages`)

    try {
      const prompt = this.buildPrompt(newMessages, this.state.summary)
      const summary = await this.callLLM(prompt)

      if (summary) {
        this.state.summary = summary
        this.state.lastCompactedAt = Date.now()
        
        for (const msg of messagesToCompact) {
          this.state.compactedMessageIds.add(msg.id)
        }

        useAgentStore.getState().setContextSummary(summary)
        
        const originalTokens = estimateTokens(messagesToCompact.map(m => this.getMessageText(m)).join(''))
        const savedTokens = originalTokens - estimateTokens(summary)
        logger.agent.info(`[ContextCompaction] Saved ${savedTokens} tokens`)

        return summary
      }

      return null
    } catch (error) {
      logger.agent.error('[ContextCompaction] Failed:', error)
      return null
    } finally {
      this.state.isCompacting = false
    }
  }

  private getMessageText(msg: ChatMessage): string {
    if (!('content' in msg)) return ''
    const content = msg.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.filter((p): p is TextContent => p.type === 'text').map(p => p.text).join('\n')
    }
    return ''
  }

  private buildPrompt(messages: ChatMessage[], existingSummary?: string | null): string {
    const summaries = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool'
      const content = this.getMessageText(msg)

      if (msg.role === 'tool') {
        return `[${role}]: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`
      }

      if (isAssistantMessage(msg) && msg.parts) {
        const toolCalls = msg.parts
          .filter((p): p is ToolCallPart => p.type === 'tool_call')
          .map(p => p.toolCall.name)
        if (toolCalls.length > 0) {
          return `[${role}] Used: ${toolCalls.join(', ')}. ${content.slice(0, 300)}`
        }
      }

      return `[${role}]: ${content.slice(0, 500)}${content.length > 500 ? '...' : ''}`
    }).join('\n\n')

    const existingContext = existingSummary 
      ? `\n\nPrevious Summary:\n${existingSummary}\n`
      : ''

    return `Summarize this conversation (max 2000 chars).${existingContext}
Focus on: user goals, key decisions, modified files, errors.

Conversation:
${summaries}

Summary:`
  }

  private async callLLM(prompt: string): Promise<string | null> {
    try {
      const { useStore } = await import('@store')
      const state = useStore.getState()
      const llmConfig = state.llmConfig
      const providerConfigs = state.providerConfigs

      const apiKey = llmConfig?.apiKey || providerConfigs[llmConfig?.provider]?.apiKey
      if (!apiKey) {
        logger.agent.warn('[ContextCompaction] No API key')
        return null
      }

      const result = await api.llm.compactContext({
        config: {
          ...llmConfig,
          apiKey,
          maxTokens: 1000,
          temperature: 0.3,
        },
        messages: [{ role: 'user', content: prompt }],
        tools: [],
        systemPrompt: 'Summarize conversations concisely. Output only the summary.',
      })

      if (result.error) {
        logger.agent.error('[ContextCompaction] LLM error:', result.error)
        return null
      }

      const content = result.content || ''
      return content.length > 2000 ? content.slice(0, 2000) + '...' : content || null
    } catch (error) {
      logger.agent.error('[ContextCompaction] Error:', error)
      return null
    }
  }

  clearSummary(): void {
    this.state.summary = null
    this.state.compactedMessageIds.clear()
    this.state.lastCompactedAt = null
    useAgentStore.getState().setContextSummary('')
  }

  reset(): void {
    this.state = {
      isCompacting: false,
      lastCompactedAt: null,
      summary: null,
      compactedMessageIds: new Set(),
    }
  }

  /**
   * 从 store 恢复摘要
   */
  restoreFromStore(): void {
    const store = useAgentStore.getState() as any
    if (store.contextSummary) {
      this.state.summary = store.contextSummary
      logger.agent.info('[ContextCompaction] Restored summary from store')
    }
  }

  /**
   * 获取压缩统计
   */
  getStats(): { lastCompactedAt: number | null; compactedMessageCount: number } {
    return {
      lastCompactedAt: this.state.lastCompactedAt,
      compactedMessageCount: this.state.compactedMessageIds.size,
    }
  }

  /**
   * 强制压缩
   */
  async forceCompaction(messages: ChatMessage[]): Promise<string | null> {
    // 清除已压缩记录，强制重新压缩
    this.state.compactedMessageIds.clear()
    return this.doCompaction(messages)
  }
}

export const contextCompactionService = new ContextCompactionServiceClass()
