/**
 * 流状态管理 Slice
 * 负责流式响应状态和自动审批配置
 */

import type { StateCreator } from 'zustand'
import type { StreamState, ToolCall } from '../../types'

// ===== 类型定义 =====

export interface StreamSliceState {
    streamState: StreamState
    autoApprove: {
        edits: boolean
        terminal: boolean
        dangerous: boolean
    }
}

export interface StreamActions {
    setStreamState: (state: Partial<StreamState>) => void
    setStreamPhase: (phase: StreamState['phase'], toolCall?: ToolCall, error?: string) => void
    setAutoApprove: (type: keyof StreamSliceState['autoApprove'], value: boolean) => void
}

export type StreamSlice = StreamSliceState & StreamActions

// ===== Slice 创建器 =====

export const createStreamSlice: StateCreator<
    StreamSlice,
    [],
    [],
    StreamSlice
> = (set) => ({
    // 初始状态
    streamState: { phase: 'idle' },
    autoApprove: {
        edits: false,
        terminal: false,
        dangerous: false,
    },

    // 设置流状态
    setStreamState: (newState) => {
        set(state => ({
            streamState: { ...state.streamState, ...newState },
        }))
    },

    // 设置流阶段
    setStreamPhase: (phase, toolCall, error) => {
        set({ streamState: { phase, currentToolCall: toolCall, error } })
    },

    // 设置自动审批
    setAutoApprove: (type, value) => {
        set(state => ({
            autoApprove: { ...state.autoApprove, [type]: value },
        }))
    },
})
