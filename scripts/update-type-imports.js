/**
 * 更新类型导入脚本
 * 
 * 1. 更新所有文件的导入，使用 @shared/types
 * 2. 清理重复的类型定义
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// 需要更新的导入映射
const IMPORT_UPDATES = [
    // main/services/llm/types.ts - 改为从 shared 导入
    {
        file: 'src/main/services/llm/types.ts',
        action: 'rewrite',
        content: `/**
 * LLM 类型定义
 * 从共享类型重新导出，保持向后兼容
 */

// 从共享类型导出
export type {
    ProviderType,
    LLMConfig,
    TextContent,
    ImageContent,
    MessageContent,
    LLMMessage,
    ToolDefinition,
    ToolCall,
    LLMToolCall,
    LLMResult,
    LLMError,
    ToolExecutionResult,
    ToolExecutionContext,
} from '@/shared/types'

export { LLMErrorCode } from '@/shared/types'

// Provider 接口（仅主进程使用）
import type { LLMAdapterConfig } from '@/shared/config/providers'

export interface StreamChunk {
    type: 'text' | 'tool_call' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'reasoning' | 'error'
    content?: string
    toolCall?: import('@/shared/types').LLMToolCall
    toolCallDelta?: {
        id?: string
        name?: string
        args?: string
    }
    error?: string
}

export interface ChatParams {
    model: string
    messages: import('@/shared/types').LLMMessage[]
    tools?: import('@/shared/types').ToolDefinition[]
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    topP?: number
    signal?: AbortSignal
    adapterConfig?: LLMAdapterConfig
    onStream: (chunk: StreamChunk) => void
    onToolCall: (toolCall: import('@/shared/types').LLMToolCall) => void
    onComplete: (result: ChatResult) => void
    onError: (error: import('@/shared/types').LLMError) => void
}

export interface ChatResult {
    content: string
    reasoning?: string
    toolCalls?: import('@/shared/types').LLMToolCall[]
    usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
}

export class LLMErrorClass extends Error {
    constructor(
        message: string,
        public code: import('@/shared/types').LLMErrorCode,
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
    create(config: import('@/shared/types').LLMConfig): LLMProvider
}
`
    },
    
    // renderer/agent/tools/types.ts - 从 shared 导入
    {
        file: 'src/renderer/agent/tools/types.ts',
        action: 'rewrite',
        content: `/**
 * 工具系统类型定义
 * 从共享类型重新导出
 */

// 从共享类型导出
export type {
    ToolApprovalType,
    ToolStatus,
    ToolResultType,
    ToolCall,
    ToolDefinition,
    ToolExecutionResult,
    ToolExecutionContext,
    ToolExecutor,
    ValidationResult,
} from '@/shared/types'

// 从 agentConfig 导出元数据类型
export type { ToolCategory, ToolMetadata } from '@/shared/config/agentConfig'
`
    },
    
    // renderer/store/slices/chatSlice.ts - 移除重复定义，使用导入
    {
        file: 'src/renderer/store/slices/chatSlice.ts',
        action: 'update-imports',
        removeTypes: ['ToolCall', 'ToolStatus'],
        addImport: "import type { ToolCall, ToolStatus, ToolApprovalType, Checkpoint } from '@/shared/types'"
    },
]

// 递归扫描目录
function scanDir(dir, callback) {
    if (!fs.existsSync(dir)) return
    
    const items = fs.readdirSync(dir)
    for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
            if (!['node_modules', '.git', 'dist'].includes(item)) {
                scanDir(fullPath, callback)
            }
        } else if (stat.isFile() && /\.(ts|tsx)$/.test(item)) {
            callback(fullPath)
        }
    }
}

// 更新文件中的导入
function updateImportsInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf-8')
    let modified = false
    
    for (const [from, to] of replacements) {
        const newContent = content.replace(from, to)
        if (newContent !== content) {
            content = newContent
            modified = true
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8')
        return true
    }
    return false
}

function main() {
    console.log('🔧 Updating type imports...\n')
    
    // 1. 处理需要重写的文件
    for (const update of IMPORT_UPDATES) {
        const fullPath = path.join(ROOT, update.file)
        
        if (update.action === 'rewrite') {
            fs.writeFileSync(fullPath, update.content, 'utf-8')
            console.log(`✅ Rewrote: ${update.file}`)
        }
    }
    
    // 2. 全局替换导入路径
    const globalReplacements = [
        // 从 renderer/agent/core/types 导入 -> @renderer/agent/types
        [/from ['"]@renderer\/agent\/core\/types['"]/g, "from '@renderer/agent/types'"],
        [/from ['"]@\/renderer\/agent\/core\/types['"]/g, "from '@/renderer/agent/types'"],
        [/from ['"]\.\.\/core\/types['"]/g, "from '../types'"],
        [/from ['"]\.\/core\/types['"]/g, "from './types'"],
        
        // 从 renderer/agent/tools/types 导入工具类型 -> 保持不变（已更新为从 shared 导出）
    ]
    
    console.log('\n📝 Updating global imports...')
    let updatedCount = 0
    
    scanDir(path.join(ROOT, 'src'), (filePath) => {
        if (updateImportsInFile(filePath, globalReplacements)) {
            console.log(`  ✅ ${path.relative(ROOT, filePath)}`)
            updatedCount++
        }
    })
    
    console.log(`\n✨ Updated ${updatedCount} files`)
    console.log('\n✅ Done! Run "npx tsc --noEmit" to verify.')
}

main()
