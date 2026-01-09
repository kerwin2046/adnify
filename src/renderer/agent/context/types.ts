/**
 * 上下文管理类型定义
 */

import type { OpenAIMessage } from '../llm/MessageConverter'
import { getReadOnlyTools, getWriteTools } from '@/shared/config/tools'

/** 上下文配置 */
export interface ContextConfig {
  /** 最大 Token 数 */
  maxTokens: number
  /** 保留最近 N 轮对话 */
  keepRecentTurns: number
  /** 工具结果最大字符数 */
  maxToolResultChars: number
  /** 重要工具列表（结果保留更多） */
  importantTools: string[]
  /** 只读工具列表（结果可大幅截断） */
  readOnlyTools: string[]
}

/** 上下文统计 */
export interface ContextStats {
  originalTokens: number
  finalTokens: number
  savedPercent: number
  keptTurns: number
  compactedTurns: number
}

/** 优化后的上下文 */
export interface OptimizedContext {
  messages: OpenAIMessage[]
  summary: string | null
  stats: ContextStats
}

/** 消息分组（一轮对话） */
export interface MessageGroup {
  userIndex: number
  assistantIndex: number | null
  toolIndices: number[]
  tokens: number
}

/** 默认配置（从配置中心获取工具列表） */
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxTokens: 100000,
  keepRecentTurns: 5,
  maxToolResultChars: 8000,
  importantTools: getWriteTools(),
  readOnlyTools: getReadOnlyTools(),
}
