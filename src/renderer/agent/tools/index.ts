/**
 * 工具模块
 * 统一导出工具相关功能
 */

// 类型 - 从 shared 重新导出
export type {
    ToolDefinition,
    ToolExecutionResult,
    ToolExecutionContext,
    ToolExecutor,
    ValidationResult,
    ToolStatus,
    ToolResultType,
    ToolCall,
    ToolApprovalType,
} from '@/shared/types'

// 元数据类型 - 从 agentConfig 导出
export type { ToolCategory, ToolMetadata } from '@/shared/config/agentConfig'

// 注册表
export { toolRegistry } from './registry'

// 定义
export { TOOL_DEFINITIONS, TOOL_DISPLAY_NAMES, getToolDefinitions, getToolApprovalType, getToolDisplayName } from './definitions'

// Schema
export { TOOL_SCHEMAS } from './schemas'

// 执行器
export { toolExecutors, initializeTools } from './executors'
