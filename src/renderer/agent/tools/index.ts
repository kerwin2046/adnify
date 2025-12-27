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

// 工具配置 - 从统一配置中心导出
export type { ToolCategory, ToolConfig } from '@/shared/config/tools'
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
    isParallelTool,
    isWriteTool,
} from '@/shared/config/tools'

// 注册表
export { toolRegistry } from './registry'

// 执行器
export { toolExecutors, initializeTools } from './executors'
