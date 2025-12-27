/**
 * Agent 配置中心
 * 
 * 将所有硬编码值外部化，支持运行时配置
 * 
 * 配置优先级：
 * 1. 用户配置 (config.json 或 UI 设置)
 * 2. 项目配置 (.adnify/agent.json)
 * 3. 默认配置 (本文件)
 */

// 从 tools.ts 重新导出工具相关类型和函数
export type { ToolCategory, ToolConfig } from './tools'
export {
    TOOL_CONFIGS,
    TOOL_DEFINITIONS,
    TOOL_SCHEMAS,
    TOOL_DISPLAY_NAMES,
    getToolDefinitions,
    getToolApprovalType,
    getToolDisplayName,
    getReadOnlyTools,
    getWriteTools,
    getApprovalRequiredTools,
    isParallelTool,
    isWriteTool,
    getToolMetadata,
} from './tools'

// 从 llm.ts 重新导出 ToolApprovalType
export type { ToolApprovalType } from '@/shared/types/llm'

// ============================================
// 兼容性别名（逐步废弃）
// ============================================

import { TOOL_CONFIGS } from './tools'

/** @deprecated 使用 TOOL_CONFIGS 代替 */
export const DEFAULT_TOOL_METADATA = TOOL_CONFIGS

/** @deprecated 使用 ToolConfig 代替 */
export type ToolMetadata = typeof TOOL_CONFIGS[keyof typeof TOOL_CONFIGS]

// ============================================
// Agent 运行时配置
// ============================================

export interface AgentRuntimeConfig {
    // 循环控制
    maxToolLoops: number
    maxHistoryMessages: number

    // 上下文限制
    maxToolResultChars: number
    maxFileContentChars: number
    maxTotalContextChars: number
    maxSingleFileChars: number

    // 重试配置
    maxRetries: number
    retryDelayMs: number
    retryBackoffMultiplier: number

    // 工具执行
    toolTimeoutMs: number

    // 上下文压缩
    contextCompressThreshold: number
    keepRecentTurns: number

    // 循环检测
    loopDetection: {
        maxHistory: number
        maxExactRepeats: number
        maxSameTargetRepeats: number
    }

    // 目录忽略列表
    ignoredDirectories: string[]
}

export const DEFAULT_AGENT_CONFIG: AgentRuntimeConfig = {
    maxToolLoops: 30,
    maxHistoryMessages: 60,
    maxToolResultChars: 10000,
    maxFileContentChars: 15000,
    maxTotalContextChars: 60000,
    maxSingleFileChars: 6000,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 1.5,
    toolTimeoutMs: 60000,
    contextCompressThreshold: 40000,
    keepRecentTurns: 3,
    loopDetection: {
        maxHistory: 15,
        maxExactRepeats: 2,
        maxSameTargetRepeats: 3,
    },
    ignoredDirectories: [
        'node_modules', '.git', 'dist', 'build', '.next',
        '__pycache__', '.venv', 'venv', '.cache', 'coverage',
        '.nyc_output', 'tmp', 'temp', '.idea', '.vscode',
    ],
}
