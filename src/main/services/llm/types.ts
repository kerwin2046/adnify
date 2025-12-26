/**
 * 主进程 LLM 服务类型
 * 
 * 基础类型从 @/shared/types 导入
 * 这里只定义主进程专用的类型（Provider 实现相关）
 */

// 重新导出共享类型
export type {
    ProviderType,
    LLMConfig,
    LLMMessage,
    LLMToolCall,
    LLMToolCallMessage,
    LLMStreamChunk,
    LLMResult,
    LLMError,
    LLMParameters,
    ToolDefinition,
    ToolPropertySchema,
    TextContent,
    ImageContent,
    MessageContent,
    MessageContentPart,
} from '@/shared/types'

export { LLMErrorCode } from '@/shared/types'

// ============================================
// 主进程专用类型
// ============================================

import type { LLMToolCall, LLMMessage, LLMConfig, ToolDefinition } from '@/shared/types'
import { LLMErrorCode } from '@/shared/types'
import type { LLMAdapterConfig } from '@/shared/config/providers'

/** 流式响应块（主进程内部使用，与 LLMStreamChunk 相同但使用本地 ToolCall） */
export interface StreamChunk {
    type: 'text' | 'tool_call' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'reasoning' | 'error'
    content?: string
    toolCall?: LLMToolCall
    toolCallDelta?: {
        id?: string
        name?: string
        args?: string
    }
    error?: string
}

export interface ChatParams {
    model: string
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    topP?: number
    signal?: AbortSignal
    adapterConfig?: LLMAdapterConfig
    onStream: (chunk: StreamChunk) => void
    onToolCall: (toolCall: LLMToolCall) => void
    onComplete: (result: ChatResult) => void
    onError: (error: LLMErrorClass) => void
}

export interface ChatResult {
    content: string
    reasoning?: string
    toolCalls?: LLMToolCall[]
    usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
}

/** LLM 错误类（可实例化） */
export class LLMErrorClass extends Error {
    constructor(
        message: string,
        public code: LLMErrorCode,
        public status?: number,
        public retryable: boolean = false,
        public details?: unknown
    ) {
        super(message)
        this.name = 'LLMError'
    }
}

export interface LLMProvider {
    chat(params: ChatParams): Promise<void>
}

export interface ProviderFactory {
    create(config: LLMConfig): LLMProvider
}
