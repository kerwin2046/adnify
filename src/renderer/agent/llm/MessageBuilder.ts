/**
 * 消息构建服务
 * 
 * 职责：构建发送给 LLM 的消息列表
 * 使用 ContextManager 进行上下文优化
 */

import { logger } from '@utils/Logger'
import { useAgentStore } from '../store/AgentStore'
import { buildOpenAIMessages, validateOpenAIMessages, OpenAIMessage } from './MessageConverter'
import { MessageContent } from '../types'
import { contextManager } from '../context'
import { contextCompactionService } from '../services/ContextCompactionService'
import { getAgentConfig } from '../utils/AgentConfig'

// 从 ContextBuilder 导入已有的函数
export { buildContextContent, buildUserContent, calculateContextStats } from './ContextBuilder'

/**
 * 构建发送给 LLM 的消息列表
 */
export async function buildLLMMessages(
  currentMessage: MessageContent,
  contextContent: string,
  systemPrompt: string
): Promise<OpenAIMessage[]> {
  const store = useAgentStore.getState()
  const historyMessages = store.getMessages()
  const config = getAgentConfig()

  const { buildUserContent } = await import('./ContextBuilder')

  // 过滤掉 checkpoint 消息
  type NonCheckpointMessage = Exclude<typeof historyMessages[number], { role: 'checkpoint' }>
  const filteredMessages: NonCheckpointMessage[] = historyMessages.filter(
    (m): m is NonCheckpointMessage => m.role !== 'checkpoint'
  )

  // 排除最后一条用户消息（会在后面重新添加带上下文的版本）
  const lastMsg = filteredMessages[filteredMessages.length - 1]
  const messagesToConvert = lastMsg?.role === 'user' 
    ? filteredMessages.slice(0, -1) 
    : filteredMessages

  // 转换为 OpenAI 格式
  const openaiMessages = buildOpenAIMessages(messagesToConvert as any, systemPrompt)

  // 同步摘要状态
  const existingSummary = store.contextSummary || contextCompactionService.getSummary()
  if (existingSummary) {
    contextManager.setSummary(existingSummary)
  }

  // 应用上下文优化
  const { messages: optimizedMessages, summary, stats } = contextManager.optimize(openaiMessages)

  // 保存新的摘要
  if (summary && summary !== existingSummary) {
    store.setContextSummary(summary)
  }

  // 如果压缩了较多轮次，异步请求 LLM 生成更好的摘要
  if (stats.compactedTurns >= 5 && !existingSummary) {
    const messagesToCompact = filteredMessages.slice(0, -config.keepRecentTurns * 2)
    if (messagesToCompact.length > 0) {
      contextCompactionService.requestCompaction(messagesToCompact as any)
        .then(llmSummary => {
          if (llmSummary && llmSummary.length > 100) {
            store.setContextSummary(llmSummary)
            contextManager.setSummary(llmSummary)
            logger.agent.info('[MessageBuilder] LLM summary generated')
          }
        })
        .catch(err => logger.agent.warn('[MessageBuilder] Failed to generate LLM summary:', err))
    }
  }

  logger.agent.info(
    `[MessageBuilder] Context: ${stats.originalTokens} -> ${stats.finalTokens} tokens ` +
    `(saved ${stats.savedPercent}%), kept ${stats.keptTurns} turns`
  )

  // 添加当前用户消息
  const userContent = buildUserContent(currentMessage, contextContent)
  optimizedMessages.push({ role: 'user', content: userContent as any })

  // 验证消息格式
  const validation = validateOpenAIMessages(optimizedMessages)
  if (!validation.valid) {
    logger.agent.warn('[MessageBuilder] Validation warning:', validation.error)
  }

  return optimizedMessages
}


