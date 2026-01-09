/**
 * 上下文管理模块
 * 
 * 统一的上下文管理架构：
 * - ContextManager: 核心管理器，协调所有上下文操作
 * - TokenEstimator: Token 估算
 * - MessageTruncator: 消息截断策略
 * - SummaryGenerator: 摘要生成（LLM）
 */

export { ContextManager, contextManager } from './ContextManager'
export { estimateTokens, estimateMessageTokens } from './TokenEstimator'
export { truncateToolResult, truncateMessage } from './MessageTruncator'
export type { ContextConfig, ContextStats, OptimizedContext } from './types'
