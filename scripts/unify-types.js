/**
 * 统一类型定义脚本
 * 
 * 目标：
 * 1. 在 src/shared/types/ 中创建统一的类型定义
 * 2. 更新所有文件的导入，使用统一来源
 * 3. 删除重复的类型定义
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// ============================================
// Step 1: 创建统一的 LLM 类型文件
// ============================================

const LLM_TYPES_CONTENT = `/**
 * LLM 相关类型定义
 * 单一来源 - 所有 LLM 相关类型从此文件导出
 */

import type { LLMAdapterConfig } from '@/shared/config/providers'

// ============================================
// 消息类型
// ============================================

export interface TextContent {
    type: 'text'
    text: string
}

export interface ImageContent {
    type: 'image'
    source: {
        type: 'base64' | 'url'
        media_type: string
        data: string
    }
}

export type MessageContent = string | Array<TextContent | ImageContent>

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: MessageContent
    tool_calls?: LLMToolCallMessage[]
    tool_call_id?: string
    name?: string
    toolCallId?: string
    toolName?: string
    rawParams?: Record<string, unknown>
}

export interface LLMToolCallMessage {
    id: string
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

// ============================================
// 配置类型
// ============================================

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'ollama' | 'custom'

export interface LLMConfig {
    provider: string
    model: string
    apiKey: string
    baseUrl?: string
    timeout?: number
    maxTokens?: number
    temperature?: number
    topP?: number
    adapterId?: string
    adapterConfig?: LLMAdapterConfig
}

export interface LLMParameters {
    temperature: number
    topP: number
    maxTokens: number
    frequencyPenalty?: number
    presencePenalty?: number
}

// ============================================
// 流式响应类型
// ============================================

export interface LLMStreamChunk {
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

// ============================================
// 错误类型
// ============================================

export interface LLMError {
    message: string
    code: string
    retryable: boolean
}

export enum LLMErrorCode {
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    INVALID_API_KEY = 'INVALID_API_KEY',
    RATE_LIMIT = 'RATE_LIMIT',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
    CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
    INVALID_REQUEST = 'INVALID_REQUEST',
    ABORTED = 'ABORTED',
    UNKNOWN = 'UNKNOWN',
}

// ============================================
// 发送参数类型
// ============================================

export interface LLMSendMessageParams {
    config: LLMConfig
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
}

// ============================================
// 工具定义（LLM 使用）
// ============================================

export interface ToolDefinition {
    name: string
    description: string
    approvalType?: ToolApprovalType
    parameters: {
        type: 'object'
        properties: Record<string, {
            type: string
            description?: string
            enum?: string[]
            items?: unknown
        }>
        required?: string[]
    }
}

// ============================================
// 工具调用类型
// ============================================

export type ToolStatus = 'pending' | 'awaiting' | 'running' | 'success' | 'error' | 'rejected'
export type ToolApprovalType = 'none' | 'terminal' | 'dangerous'
export type ToolResultType = 'tool_request' | 'running_now' | 'success' | 'tool_error' | 'rejected'

export interface ToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
    status: ToolStatus
    result?: string
    error?: string
    rawParams?: Record<string, unknown>
}

export interface ToolExecutionResult {
    success: boolean
    result: string
    error?: string
    meta?: {
        filePath?: string
        oldContent?: string
        newContent?: string
        linesAdded?: number
        linesRemoved?: number
        isNewFile?: boolean
    }
}

export interface ToolExecutionContext {
    workspacePath: string | null
    currentAssistantId?: string | null
}

export type ToolExecutor = (
    args: Record<string, unknown>,
    context: ToolExecutionContext
) => Promise<ToolExecutionResult>

export interface ValidationResult<T = unknown> {
    success: boolean
    data?: T
    error?: string
}
`

// ============================================
// Step 2: 更新 shared/types/index.ts
// ============================================

const SHARED_TYPES_INDEX = `/**
 * 共享类型定义
 * 主进程和渲染进程共用的类型
 */

// LLM 相关类型（统一来源）
export * from './llm'

// ==========================================
// 基础类型
// ==========================================

export interface FileItem {
    name: string
    path: string
    isDirectory: boolean
    isRoot?: boolean
    children?: FileItem[]
    lastModified?: number
    size?: number
}

export interface FileSnapshot {
    fsPath: string
    content: string | null
    path?: string
    timestamp?: number
}

// ==========================================
// 搜索相关类型
// ==========================================

export interface SearchFilesOptions {
    isRegex: boolean
    isCaseSensitive: boolean
    isWholeWord: boolean
    include?: string
    exclude?: string
}

export interface SearchFileResult {
    path: string
    line: number
    text: string
}

// ==========================================
// 索引相关类型
// ==========================================

export type EmbeddingProviderType = 'jina' | 'voyage' | 'openai' | 'cohere' | 'huggingface' | 'ollama'

export interface EmbeddingConfig {
    provider?: EmbeddingProviderType
    apiKey?: string
    model?: string
    baseUrl?: string
}

export interface IndexStatus {
    isIndexing: boolean
    totalFiles: number
    indexedFiles: number
    totalChunks: number
    lastIndexedAt?: number
    error?: string
}

export interface IndexSearchResult {
    filePath: string
    relativePath: string
    content: string
    startLine: number
    endLine: number
    score: number
    type: string
    language: string
}

export interface EmbeddingProvider {
    id: string
    name: string
    description: string
    free: boolean
}

// ==========================================
// LSP 相关类型
// ==========================================

export interface LspPosition {
    line: number
    character: number
}

export interface LspRange {
    start: LspPosition
    end: LspPosition
}

export interface LspLocation {
    uri: string
    range: LspRange
}

export interface LspDiagnostic {
    range: LspRange
    severity?: number
    code?: string | number
    source?: string
    message: string
}

export interface LspHover {
    contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>
    range?: LspRange
}

export interface LspCompletionItem {
    label: string
    kind?: number
    detail?: string
    documentation?: string | { kind: string; value: string }
    insertText?: string
    insertTextFormat?: number
}

export interface LspCompletionList {
    isIncomplete: boolean
    items: LspCompletionItem[]
}

export interface LspTextEdit {
    range: LspRange
    newText: string
}

export interface LspWorkspaceEdit {
    changes?: { [uri: string]: LspTextEdit[] }
    documentChanges?: Array<{ textDocument: { uri: string; version?: number }; edits: LspTextEdit[] }>
}

export interface LspSignatureHelp {
    signatures: LspSignatureInformation[]
    activeSignature?: number
    activeParameter?: number
}

export interface LspSignatureInformation {
    label: string
    documentation?: string | { kind: string; value: string }
    parameters?: LspParameterInformation[]
}

export interface LspParameterInformation {
    label: string | [number, number]
    documentation?: string | { kind: string; value: string }
}

export interface LspDocumentSymbol {
    name: string
    detail?: string
    kind: number
    range: LspRange
    selectionRange: LspRange
    children?: LspDocumentSymbol[]
}

export interface LspSymbolInformation {
    name: string
    kind: number
    location: LspLocation
    containerName?: string
}

export interface LspCodeAction {
    title: string
    kind?: string
    diagnostics?: LspDiagnostic[]
    isPreferred?: boolean
    edit?: LspWorkspaceEdit
    command?: { title: string; command: string; arguments?: unknown[] }
}

export interface LspFormattingOptions {
    tabSize?: number
    insertSpaces?: boolean
}

export interface LspDocumentHighlight {
    range: LspRange
    kind?: number
}

export interface LspFoldingRange {
    startLine: number
    startCharacter?: number
    endLine: number
    endCharacter?: number
    kind?: string
}

export interface LspInlayHint {
    position: LspPosition
    label: string | { value: string; tooltip?: string }[]
    kind?: number
    paddingLeft?: boolean
    paddingRight?: boolean
}

export interface LspPrepareRename {
    range: LspRange
    placeholder: string
}
`

// ============================================
// 执行
// ============================================

function writeFile(relativePath, content) {
    const fullPath = path.join(ROOT, relativePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✅ Created: ${relativePath}`)
}

function main() {
    console.log('🔧 Unifying type definitions...\n')
    
    // 1. 创建统一的 LLM 类型文件
    writeFile('src/shared/types/llm.ts', LLM_TYPES_CONTENT)
    
    // 2. 更新 shared/types/index.ts
    writeFile('src/shared/types/index.ts', SHARED_TYPES_INDEX)
    
    console.log('\n✅ Type files created!')
    console.log('\n📝 Next steps:')
    console.log('1. Update imports in other files to use @shared/types')
    console.log('2. Remove duplicate type definitions')
    console.log('3. Run tsc --noEmit to verify')
}

main()
