/**
 * Electron API 类型定义
 */

export interface FileItem {
	name: string
	path: string
	isDirectory: boolean
}

export interface LLMStreamChunk {
	type: 'text' | 'reasoning' | 'error'
	content?: string
	error?: string
}

export interface LLMToolCall {
	id: string
	name: string
	arguments: Record<string, unknown>
}

export interface LLMResult {
	content: string
	reasoning?: string
	toolCalls?: LLMToolCall[]
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

export interface LLMError {
	message: string
	code: string
	retryable: boolean
}

export interface SearchFilesOptions {
	isRegex: boolean
	isCaseSensitive: boolean
	isWholeWord: boolean
	exclude?: string
}

export interface SearchFileResult {
	path: string
	line: number
	text: string
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

export interface LLMSendMessageParams {
	config: LLMConfig
	messages: LLMMessage[]
	tools?: ToolDefinition[]
	systemPrompt?: string
}

export interface LLMConfig {
	provider: string
	model: string
	apiKey: string
	baseUrl?: string
}

export interface ElectronAPI {
	// Window controls
	minimize: () => void
	maximize: () => void
	close: () => void

	// File operations
	openFile: () => Promise<{ path: string; content: string } | null>
	openFolder: () => Promise<string | null>
    restoreWorkspace: () => Promise<string | null>
	readDir: (path: string) => Promise<FileItem[]>
	readFile: (path: string) => Promise<string | null>
	writeFile: (path: string, content: string) => Promise<boolean>
	saveFile: (content: string, path?: string) => Promise<string | null>
	fileExists: (path: string) => Promise<boolean>
	mkdir: (path: string) => Promise<boolean>
	deleteFile: (path: string) => Promise<boolean>
	renameFile: (oldPath: string, newPath: string) => Promise<boolean>
	searchFiles: (query: string, rootPath: string, options?: SearchFilesOptions) => Promise<SearchFileResult[]>

	// Settings
	getSetting: (key: string) => Promise<unknown>
	setSetting: (key: string, value: unknown) => Promise<boolean>

	// LLM
	sendMessage: (params: LLMSendMessageParams) => Promise<void>
	abortMessage: () => void
	onLLMStream: (callback: (chunk: LLMStreamChunk) => void) => () => void
	onLLMToolCall: (callback: (toolCall: LLMToolCall) => void) => () => void
	onLLMError: (callback: (error: LLMError) => void) => () => void
	onLLMDone: (callback: (result: LLMResult) => void) => () => void

	// Terminal
    createTerminal: (options?: { cwd?: string }) => Promise<boolean>
    writeTerminal: (data: string) => Promise<void>
    resizeTerminal: (cols: number, rows: number) => Promise<void>
	killTerminal: () => void
    executeCommand: (command: string, cwd?: string) => Promise<{ output: string; errorOutput: string; exitCode: number }>
	onTerminalData: (callback: (data: string) => void) => () => void
}

declare global {
	interface Window {
		electronAPI: ElectronAPI
	}
}

export {}
