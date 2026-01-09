/**
 * 上下文管理器
 * 
 * 核心职责：
 * 1. 滑动窗口管理 - 保留最近 N 轮完整对话
 * 2. 智能截断 - 根据内容类型动态截断
 * 3. 摘要管理 - 协调 LLM 摘要生成
 * 4. 统计分析 - 提供上下文使用统计
 */

import { logger } from '@utils/Logger'
import type { OpenAIMessage } from '../llm/MessageConverter'
import type { ContextConfig, OptimizedContext, MessageGroup } from './types'
import { DEFAULT_CONTEXT_CONFIG } from './types'
import { estimateMessageTokens } from './TokenEstimator'
import { truncateToolResult } from './MessageTruncator'
import { getAgentConfig } from '../utils/AgentConfig'
import { isWriteTool } from '@/shared/config/tools'

export class ContextManager {
  private summary: string | null = null

  /**
   * 获取当前摘要
   */
  getSummary(): string | null {
    return this.summary
  }

  /**
   * 设置摘要
   */
  setSummary(summary: string | null): void {
    this.summary = summary
  }

  /**
   * 清除摘要
   */
  clearSummary(): void {
    this.summary = null
  }

  /**
   * 优化上下文
   * 应用滑动窗口策略，返回优化后的消息列表
   */
  optimize(
    messages: OpenAIMessage[],
    config: Partial<ContextConfig> = {}
  ): OptimizedContext {
    const cfg = this.mergeConfig(config)

    // 分离 system 消息
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    // 计算原始 Token 数
    const originalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)

    // 如果在限制内，只做工具结果截断
    if (originalTokens <= cfg.maxTokens) {
      const truncatedMessages = this.truncateAllToolResults(messages, cfg)
      const finalTokens = truncatedMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)

      return {
        messages: truncatedMessages,
        summary: this.summary,
        stats: {
          originalTokens,
          finalTokens,
          savedPercent: Math.round((1 - finalTokens / originalTokens) * 100),
          keptTurns: this.groupMessages(nonSystemMessages).length,
          compactedTurns: 0,
        },
      }
    }

    // 需要压缩：分组消息
    const groups = this.groupMessages(nonSystemMessages)
    const keepTurns = Math.min(cfg.keepRecentTurns, groups.length)

    // 保留最近 N 轮
    const recentGroups = groups.slice(-keepTurns)
    const olderGroups = groups.slice(0, -keepTurns)

    // 构建保留的消息索引
    const keptIndices = new Set<number>()
    for (const group of recentGroups) {
      keptIndices.add(group.userIndex)
      if (group.assistantIndex !== null) keptIndices.add(group.assistantIndex)
      for (const idx of group.toolIndices) keptIndices.add(idx)
    }

    // 生成压缩摘要（如果有旧消息需要压缩且没有现有摘要）
    if (olderGroups.length > 0 && !this.summary) {
      this.summary = this.generateQuickSummary(nonSystemMessages, olderGroups)
    }

    // 构建最终消息列表
    const finalMessages: OpenAIMessage[] = []

    // 添加 system 消息（带摘要）
    if (systemMsg) {
      const systemContent = typeof systemMsg.content === 'string' ? systemMsg.content : ''
      const enhancedSystem = this.summary
        ? `${systemContent}\n\n## Previous Conversation Summary\n${this.summary}\n\n---\nContinue based on the above context.`
        : systemContent

      finalMessages.push({ ...systemMsg, content: enhancedSystem })
    }

    // 添加保留的消息（截断工具结果）
    for (let i = 0; i < nonSystemMessages.length; i++) {
      if (!keptIndices.has(i)) continue

      const msg = nonSystemMessages[i]
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        const toolName = (msg as any).name || ''
        finalMessages.push({
          ...msg,
          content: truncateToolResult(msg.content, toolName, cfg),
        })
      } else {
        finalMessages.push(msg)
      }
    }

    const finalTokens = finalMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)

    logger.agent.info(
      `[ContextManager] Optimized: ${originalTokens} -> ${finalTokens} tokens ` +
      `(saved ${Math.round((1 - finalTokens / originalTokens) * 100)}%), ` +
      `kept ${keepTurns} turns, compacted ${olderGroups.length} turns`
    )

    return {
      messages: finalMessages,
      summary: this.summary,
      stats: {
        originalTokens,
        finalTokens,
        savedPercent: Math.round((1 - finalTokens / originalTokens) * 100),
        keptTurns: keepTurns,
        compactedTurns: olderGroups.length,
      },
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config: Partial<ContextConfig>): ContextConfig {
    const agentConfig = getAgentConfig()
    return {
      ...DEFAULT_CONTEXT_CONFIG,
      maxTokens: agentConfig.contextCompressThreshold * 4,
      keepRecentTurns: agentConfig.keepRecentTurns,
      maxToolResultChars: agentConfig.maxToolResultChars,
      ...config,
    }
  }

  /**
   * 将消息分组为对话轮次
   */
  private groupMessages(messages: OpenAIMessage[]): MessageGroup[] {
    const groups: MessageGroup[] = []
    let currentGroup: MessageGroup | null = null

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role === 'system') continue

      if (msg.role === 'user') {
        if (currentGroup) groups.push(currentGroup)
        currentGroup = {
          userIndex: i,
          assistantIndex: null,
          toolIndices: [],
          tokens: estimateMessageTokens(msg),
        }
      } else if (msg.role === 'assistant' && currentGroup) {
        currentGroup.assistantIndex = i
        currentGroup.tokens += estimateMessageTokens(msg)
      } else if (msg.role === 'tool' && currentGroup) {
        currentGroup.toolIndices.push(i)
        currentGroup.tokens += estimateMessageTokens(msg)
      }
    }

    if (currentGroup) groups.push(currentGroup)
    return groups
  }

  /**
   * 截断所有工具结果
   */
  private truncateAllToolResults(
    messages: OpenAIMessage[],
    config: ContextConfig
  ): OpenAIMessage[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        const toolName = (msg as any).name || ''
        return { ...msg, content: truncateToolResult(msg.content, toolName, config) }
      }
      return msg
    })
  }

  /**
   * 快速生成摘要（不调用 LLM）
   */
  private generateQuickSummary(
    messages: OpenAIMessage[],
    groups: MessageGroup[]
  ): string {
    const userRequests: string[] = []
    const fileOperations: string[] = []
    const toolsUsed = new Set<string>()
    const errors: string[] = []

    for (const group of groups) {
      // 提取用户请求
      const userMsg = messages[group.userIndex]
      if (userMsg && typeof userMsg.content === 'string') {
        const truncated = userMsg.content.length > 150
          ? userMsg.content.slice(0, 150) + '...'
          : userMsg.content
        userRequests.push(truncated)
      }

      // 提取工具调用
      if (group.assistantIndex !== null) {
        const assistantMsg = messages[group.assistantIndex]
        if (assistantMsg?.tool_calls) {
          for (const tc of assistantMsg.tool_calls) {
            toolsUsed.add(tc.function.name)

            if (isWriteTool(tc.function.name)) {
              try {
                const args = JSON.parse(tc.function.arguments)
                if (args.path) fileOperations.push(`${tc.function.name}: ${args.path}`)
              } catch { /* ignore */ }
            }
          }
        }
      }

      // 提取错误
      for (const toolIdx of group.toolIndices) {
        const toolMsg = messages[toolIdx]
        if (toolMsg && typeof toolMsg.content === 'string') {
          if (/error|failed|denied/i.test(toolMsg.content.slice(0, 200))) {
            errors.push(toolMsg.content.slice(0, 100))
          }
        }
      }
    }

    const parts: string[] = []

    if (userRequests.length > 0) {
      parts.push(`**User Requests (${userRequests.length}):**\n${userRequests.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')}`)
    }

    if (fileOperations.length > 0) {
      const uniqueOps = [...new Set(fileOperations)].slice(0, 15)
      parts.push(`**File Operations:**\n${uniqueOps.join('\n')}`)
    }

    if (toolsUsed.size > 0) {
      parts.push(`**Tools Used:** ${[...toolsUsed].join(', ')}`)
    }

    if (errors.length > 0) {
      parts.push(`**Errors Encountered:** ${errors.length} error(s)`)
    }

    return parts.join('\n\n') || 'Previous conversation context (details compacted)'
  }
}

// 单例导出
export const contextManager = new ContextManager()
