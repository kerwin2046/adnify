/**
 * 流式响应恢复服务
 * 处理流中断后的恢复机制
 */

import { logger } from '@utils/Logger'
import { useAgentStore } from '../store/AgentStore'
import { OpenAIMessage } from '../llm/MessageConverter'
import { LLMToolCall } from '@/renderer/types/electron'

// 恢复点数据
interface RecoveryPoint {
  id: string
  timestamp: number
  // 当前助手消息 ID
  assistantMessageId: string
  // 已接收的内容
  partialContent: string
  // 已完成的工具调用
  completedToolCalls: LLMToolCall[]
  // 待处理的工具调用
  pendingToolCalls: LLMToolCall[]
  // LLM 消息历史（用于恢复请求）
  llmMessages: OpenAIMessage[]
  // 循环计数
  loopCount: number
  // 错误信息
  error?: string
}

// 恢复配置
const RECOVERY_CONFIG = {
  // 最大保存的恢复点数量
  maxRecoveryPoints: 5,
  // 恢复点过期时间（毫秒）
  expirationMs: 30 * 60 * 1000, // 30 分钟
  // 自动保存间隔（毫秒）
  autoSaveIntervalMs: 5000,
  // 最大重试次数
  maxRetries: 3,
}

class StreamRecoveryServiceClass {
  private recoveryPoints: Map<string, RecoveryPoint> = new Map()
  private currentRecoveryId: string | null = null
  private autoSaveTimer: NodeJS.Timeout | null = null
  private retryCount = 0

  /**
   * 开始新的流式会话
   */
  startSession(assistantMessageId: string, llmMessages: OpenAIMessage[]): string {
    // 清除之前的恢复点（新会话开始时不应该有旧的恢复点）
    if (this.currentRecoveryId) {
      this.recoveryPoints.delete(this.currentRecoveryId)
    }
    
    const recoveryId = `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const recoveryPoint: RecoveryPoint = {
      id: recoveryId,
      timestamp: Date.now(),
      assistantMessageId,
      partialContent: '',
      completedToolCalls: [],
      pendingToolCalls: [],
      llmMessages: [...llmMessages],
      loopCount: 0,
    }

    this.recoveryPoints.set(recoveryId, recoveryPoint)
    this.currentRecoveryId = recoveryId
    this.retryCount = 0

    // 清理过期的恢复点
    this.cleanupExpiredPoints()

    // 启动自动保存
    this.startAutoSave()

    logger.agent.debug(`[StreamRecovery] Session started: ${recoveryId}`)
    return recoveryId
  }

  /**
   * 更新恢复点
   */
  updateRecoveryPoint(updates: Partial<Omit<RecoveryPoint, 'id' | 'timestamp'>>): void {
    if (!this.currentRecoveryId) return

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return

    Object.assign(point, updates, { timestamp: Date.now() })
  }

  /**
   * 追加内容到恢复点
   */
  appendContent(content: string): void {
    if (!this.currentRecoveryId) return

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return

    point.partialContent += content
    point.timestamp = Date.now()
  }

  /**
   * 添加完成的工具调用
   */
  addCompletedToolCall(toolCall: LLMToolCall): void {
    if (!this.currentRecoveryId) return

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return

    // 从待处理移到已完成
    point.pendingToolCalls = point.pendingToolCalls.filter(tc => tc.id !== toolCall.id)
    point.completedToolCalls.push(toolCall)
    point.timestamp = Date.now()
  }

  /**
   * 添加待处理的工具调用
   */
  addPendingToolCalls(toolCalls: LLMToolCall[]): void {
    if (!this.currentRecoveryId) return

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return

    point.pendingToolCalls = [...toolCalls]
    point.timestamp = Date.now()
  }

  /**
   * 记录错误
   */
  recordError(error: string): void {
    if (!this.currentRecoveryId) return

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return

    point.error = error
    point.timestamp = Date.now()
  }

  /**
   * 检查是否可以恢复
   */
  canRecover(): boolean {
    if (!this.currentRecoveryId) return false
    if (this.retryCount >= RECOVERY_CONFIG.maxRetries) return false

    const point = this.recoveryPoints.get(this.currentRecoveryId)
    if (!point) return false

    // 检查是否过期
    if (Date.now() - point.timestamp > RECOVERY_CONFIG.expirationMs) {
      return false
    }

    return true
  }

  /**
   * 获取恢复数据
   */
  getRecoveryData(): RecoveryPoint | null {
    if (!this.currentRecoveryId) return null
    return this.recoveryPoints.get(this.currentRecoveryId) || null
  }

  /**
   * 准备恢复请求
   * 返回用于继续对话的消息
   */
  prepareRecoveryMessages(): OpenAIMessage[] | null {
    const point = this.getRecoveryData()
    if (!point) return null

    const messages = [...point.llmMessages]

    // 如果有部分内容，添加为助手消息
    if (point.partialContent) {
      messages.push({
        role: 'assistant',
        content: point.partialContent,
        tool_calls: point.completedToolCalls.length > 0
          ? point.completedToolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            }))
          : undefined,
      })
    }

    // 添加恢复提示
    messages.push({
      role: 'user',
      content: '[System] The previous response was interrupted. Please continue from where you left off.',
    })

    this.retryCount++
    logger.agent.info(`[StreamRecovery] Preparing recovery (attempt ${this.retryCount}/${RECOVERY_CONFIG.maxRetries})`)

    return messages
  }

  /**
   * 恢复 UI 状态
   */
  restoreUIState(): void {
    const point = this.getRecoveryData()
    if (!point) return

    const store = useAgentStore.getState()

    // 恢复助手消息内容
    if (point.partialContent && point.assistantMessageId) {
      store.updateMessage(point.assistantMessageId, {
        content: point.partialContent,
      } as any)
    }

    // 恢复工具调用状态
    for (const tc of point.completedToolCalls) {
      store.updateToolCall(point.assistantMessageId, tc.id, {
        status: 'success',
      })
    }

    for (const tc of point.pendingToolCalls) {
      store.updateToolCall(point.assistantMessageId, tc.id, {
        status: 'error',
        error: 'Interrupted - pending recovery',
      })
    }
  }

  /**
   * 结束会话
   */
  endSession(success: boolean = true): void {
    this.stopAutoSave()

    if (success && this.currentRecoveryId) {
      // 成功完成，删除恢复点
      this.recoveryPoints.delete(this.currentRecoveryId)
      logger.agent.debug(`[StreamRecovery] Session completed successfully: ${this.currentRecoveryId}`)
    }

    this.currentRecoveryId = null
    this.retryCount = 0
  }

  /**
   * 获取所有可恢复的会话
   */
  getRecoverableSessions(): RecoveryPoint[] {
    const now = Date.now()
    const sessions: RecoveryPoint[] = []

    for (const [_id, point] of this.recoveryPoints) {
      if (now - point.timestamp < RECOVERY_CONFIG.expirationMs) {
        sessions.push(point)
      }
    }

    return sessions.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 从指定恢复点恢复
   */
  recoverFromPoint(recoveryId: string): boolean {
    const point = this.recoveryPoints.get(recoveryId)
    if (!point) return false

    this.currentRecoveryId = recoveryId
    this.retryCount = 0
    this.restoreUIState()

    return true
  }

  /**
   * 清除所有恢复点
   */
  clearAll(): void {
    this.stopAutoSave()
    this.recoveryPoints.clear()
    this.currentRecoveryId = null
    this.retryCount = 0
  }

  // ===== 私有方法 =====

  private startAutoSave(): void {
    this.stopAutoSave()
    this.autoSaveTimer = setInterval(() => {
      this.saveToStorage()
    }, RECOVERY_CONFIG.autoSaveIntervalMs)
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  private cleanupExpiredPoints(): void {
    const now = Date.now()
    const expiredIds: string[] = []

    for (const [id, point] of this.recoveryPoints) {
      if (now - point.timestamp > RECOVERY_CONFIG.expirationMs) {
        expiredIds.push(id)
      }
    }

    for (const id of expiredIds) {
      this.recoveryPoints.delete(id)
    }

    // 保持最大数量限制
    if (this.recoveryPoints.size > RECOVERY_CONFIG.maxRecoveryPoints) {
      const sorted = Array.from(this.recoveryPoints.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
      
      const toRemove = sorted.slice(RECOVERY_CONFIG.maxRecoveryPoints)
      for (const [id] of toRemove) {
        this.recoveryPoints.delete(id)
      }
    }
  }

  private saveToStorage(): void {
    // 可选：保存到 localStorage 或 IndexedDB
    // 这里简化处理，只保存在内存中
    if (this.currentRecoveryId) {
      const point = this.recoveryPoints.get(this.currentRecoveryId)
      if (point) {
        try {
          sessionStorage.setItem(
            `stream-recovery-${this.currentRecoveryId}`,
            JSON.stringify({
              ...point,
              // 不保存完整的 llmMessages，太大
              llmMessages: point.llmMessages.slice(-10),
            })
          )
        } catch (e) {
          // 忽略存储错误
        }
      }
    }
  }

  /**
   * 从存储恢复
   */
  restoreFromStorage(): void {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('stream-recovery-')) {
          const data = sessionStorage.getItem(key)
          if (data) {
            const point = JSON.parse(data) as RecoveryPoint
            // 检查是否过期
            if (Date.now() - point.timestamp < RECOVERY_CONFIG.expirationMs) {
              this.recoveryPoints.set(point.id, point)
            } else {
              sessionStorage.removeItem(key)
            }
          }
        }
      }
    } catch (e) {
      logger.agent.warn('[StreamRecovery] Failed to restore from storage:', e)
    }
  }
}

export const streamRecoveryService = new StreamRecoveryServiceClass()
