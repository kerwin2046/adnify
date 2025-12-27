/**
 * Agent 状态管理
 * 使用 Zustand slice 模式组织代码
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { logger } from '@utils/Logger'
import { agentStorage } from './agentStorage'
import {
    createThreadSlice,
    createMessageSlice,
    createCheckpointSlice,
    createPlanSlice,
    createStreamSlice,
    type ThreadSlice,
    type MessageSlice,
    type CheckpointSlice,
    type PlanSlice,
    type StreamSlice,
} from './slices'
import type { ChatMessage, ContextItem } from '../types'

// ===== Store 类型 =====

export type AgentStore = ThreadSlice & MessageSlice & CheckpointSlice & PlanSlice & StreamSlice

// ===== 流式响应节流优化 =====

class StreamingBuffer {
    private buffer: Map<string, string> = new Map()
    private rafId: number | null = null
    private flushCallback: ((messageId: string, content: string) => void) | null = null

    setFlushCallback(callback: (messageId: string, content: string) => void) {
        this.flushCallback = callback
    }

    append(messageId: string, content: string): void {
        const existing = this.buffer.get(messageId) || ''
        this.buffer.set(messageId, existing + content)
        this.scheduleFlush()
    }

    private scheduleFlush(): void {
        if (this.rafId) return
        this.rafId = requestAnimationFrame(() => {
            this.flush()
            this.rafId = null
        })
    }

    private flush(): void {
        if (!this.flushCallback) return
        this.buffer.forEach((content, messageId) => {
            if (content) {
                this.flushCallback!(messageId, content)
            }
        })
        this.buffer.clear()
    }

    flushNow(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        this.flush()
    }

    clear(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        this.buffer.clear()
    }
}

const streamingBuffer = new StreamingBuffer()

// ===== Store 实现 =====

export const useAgentStore = create<AgentStore>()(
    persist(
        (...args) => {
            // 创建各个 slice
            const threadSlice = createThreadSlice(...args)
            const messageSlice = createMessageSlice(...args)
            const checkpointSlice = createCheckpointSlice(...args)
            const planSlice = createPlanSlice(...args)
            const streamSlice = createStreamSlice(...args)

            // 重写 appendToAssistant 使用 StreamingBuffer
            messageSlice.appendToAssistant = (messageId: string, content: string) => {
                streamingBuffer.append(messageId, content)
            }

            // 重写 finalizeAssistant 先刷新缓冲区
            const originalFinalizeAssistant = messageSlice.finalizeAssistant
            messageSlice.finalizeAssistant = (messageId: string) => {
                streamingBuffer.flushNow()
                originalFinalizeAssistant(messageId)
            }

            return {
                ...threadSlice,
                ...messageSlice,
                ...checkpointSlice,
                ...planSlice,
                ...streamSlice,
            }
        },
        {
            name: 'adnify-agent-store',
            storage: createJSONStorage(() => agentStorage),
            partialize: (state) => ({
                threads: state.threads,
                currentThreadId: state.currentThreadId,
                autoApprove: state.autoApprove,
                plan: state.plan,
            }),
        }
    )
)

// ===== Selectors =====

const EMPTY_MESSAGES: ChatMessage[] = []
const EMPTY_CONTEXT_ITEMS: ContextItem[] = []

export const selectCurrentThread = (state: AgentStore) => {
    if (!state.currentThreadId) return null
    return state.threads[state.currentThreadId] || null
}

export const selectMessages = (state: AgentStore) => {
    if (!state.currentThreadId) return EMPTY_MESSAGES
    const thread = state.threads[state.currentThreadId]
    return thread?.messages || EMPTY_MESSAGES
}

export const selectStreamState = (state: AgentStore) => state.streamState

export const selectContextItems = (state: AgentStore) => {
    if (!state.currentThreadId) return EMPTY_CONTEXT_ITEMS
    const thread = state.threads[state.currentThreadId]
    return thread?.contextItems || EMPTY_CONTEXT_ITEMS
}

export const selectIsStreaming = (state: AgentStore) =>
    state.streamState.phase === 'streaming' || state.streamState.phase === 'tool_running'

export const selectIsAwaitingApproval = (state: AgentStore) =>
    state.streamState.phase === 'tool_pending'

export const selectPendingChanges = (state: AgentStore) => state.pendingChanges

export const selectHasPendingChanges = (state: AgentStore) => state.pendingChanges.length > 0

export const selectMessageCheckpoints = (state: AgentStore) => state.messageCheckpoints

// ===== StreamingBuffer 初始化 =====

streamingBuffer.setFlushCallback((messageId: string, content: string) => {
    const store = useAgentStore.getState()
    store._doAppendToAssistant(messageId, content)
})

// ===== Store 初始化 =====

export async function initializeAgentStore(): Promise<void> {
    try {
        const persistApi = (useAgentStore as any).persist
        if (persistApi) {
            await persistApi.rehydrate()
            logger.agent.info('[AgentStore] Rehydrated from project storage')
        }

        const { initializeTools } = await import('../tools')
        await initializeTools()
        logger.agent.info('[AgentStore] Tools initialized')
    } catch (error) {
        logger.agent.error('[AgentStore] Failed to initialize:', error)
    }
}
