/**
 * LLM 类型定义
 * 统一的接口定义，支持多种 Provider
 */

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface LLMConfig {
	provider: ProviderType
	model: string
	apiKey: string
	baseUrl?: string
	// 扩展配置
	maxTokens?: number
	temperature?: number
	timeout?: number
}

export interface LLMMessage {
	role: 'user' | 'assistant' | 'system' | 'tool'
	content: string
	toolCallId?: string
	toolName?: string
}

export interface ToolDefinition {
	name: string
	description: string
	parameters: {
		type: 'object'
		properties: Record<string, {
			type: string
			description: string
			enum?: string[]
		}>
		required?: string[]
	}
}

export interface ToolCall {
	id: string
	name: string
	arguments: Record<string, unknown>
}

export interface StreamChunk {
	type: 'text' | 'tool_call' | 'reasoning' | 'error'
	content?: string
	toolCall?: ToolCall
	error?: string
}

export interface ChatParams {
	model: string
	messages: LLMMessage[]
	tools?: ToolDefinition[]
	systemPrompt?: string
	signal?: AbortSignal
	// 回调函数
	onStream: (chunk: StreamChunk) => void
	onToolCall: (toolCall: ToolCall) => void
	onComplete: (result: ChatResult) => void
	onError: (error: LLMError) => void
}

export interface ChatResult {
	content: string
	reasoning?: string
	toolCalls?: ToolCall[]
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

// 自定义错误类型
export class LLMError extends Error {
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

export enum LLMErrorCode {
	// 网络错误
	NETWORK_ERROR = 'NETWORK_ERROR',
	TIMEOUT = 'TIMEOUT',
	// API 错误
	INVALID_API_KEY = 'INVALID_API_KEY',
	RATE_LIMIT = 'RATE_LIMIT',
	QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
	MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
	CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
	// 请求错误
	INVALID_REQUEST = 'INVALID_REQUEST',
	ABORTED = 'ABORTED',
	// 未知错误
	UNKNOWN = 'UNKNOWN',
}

export interface LLMProvider {
	chat(params: ChatParams): Promise<void>
}

// Provider 工厂接口
export interface ProviderFactory {
	create(config: LLMConfig): LLMProvider
}
