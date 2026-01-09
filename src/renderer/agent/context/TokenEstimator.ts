/**
 * Token 估算器
 * 
 * 提供统一的 Token 估算逻辑，避免重复实现
 */

import type { OpenAIMessage } from '../llm/MessageConverter'

/**
 * 估算文本的 Token 数
 * 中文约 1.5 字符/token，英文约 4 字符/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * 估算消息的 Token 数
 */
export function estimateMessageTokens(msg: OpenAIMessage): number {
  let tokens = 4 // 消息结构开销

  if (typeof msg.content === 'string') {
    tokens += estimateTokens(msg.content)
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        tokens += estimateTokens(part.text || '')
      } else {
        tokens += 85 // 图片基础开销
      }
    }
  }

  // tool_calls 开销
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += 10
      tokens += estimateTokens(tc.function.name)
      tokens += estimateTokens(tc.function.arguments)
    }
  }

  return tokens
}

/**
 * 估算消息列表的总 Token 数
 */
export function estimateTotalTokens(messages: OpenAIMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}
