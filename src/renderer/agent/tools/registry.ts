/**
 * 工具注册表
 * 统一管理工具的注册、验证和执行
 */

import { z } from 'zod'
import { logger } from '@utils/Logger'
import {
    TOOL_SCHEMAS,
    TOOL_DEFINITIONS,
    TOOL_CONFIGS,
    type ToolCategory,
} from '@/shared/config/tools'
import type {
    ToolDefinition,
    ToolExecutionResult,
    ToolExecutionContext,
    ToolExecutor,
    ValidationResult,
    ToolApprovalType,
} from '@/shared/types'

// ===== 内部类型 =====

interface RegisteredTool {
    name: string
    definition: ToolDefinition
    schema: z.ZodSchema
    executor: ToolExecutor
    category: ToolCategory
    approvalType: ToolApprovalType
    parallel: boolean
    enabled: boolean
}

// ===== 工具注册表 =====

class ToolRegistry {
    private tools = new Map<string, RegisteredTool>()
    private initialized = false

    /**
     * 注册工具
     */
    register(
        name: string,
        executor: ToolExecutor,
        options?: { override?: boolean }
    ): boolean {
        if (this.tools.has(name) && !options?.override) {
            return false
        }

        const definition = TOOL_DEFINITIONS[name]
        const schema = TOOL_SCHEMAS[name]
        const config = TOOL_CONFIGS[name]

        if (!definition || !schema) {
            logger.agent.warn(`[ToolRegistry] Missing definition or schema for: ${name}`)
            return false
        }

        this.tools.set(name, {
            name,
            definition,
            schema,
            executor,
            category: config?.category || 'read',
            approvalType: config?.approvalType || 'none',
            parallel: config?.parallel ?? false,
            enabled: true,
        })

        return true
    }

    /**
     * 批量注册工具
     */
    registerAll(executors: Record<string, ToolExecutor>): void {
        for (const [name, executor] of Object.entries(executors)) {
            this.register(name, executor, { override: true })
        }
        this.initialized = true
        logger.agent.info(`[ToolRegistry] Registered ${this.tools.size} tools`)
    }

    /**
     * 检查是否已初始化
     */
    isInitialized(): boolean {
        return this.initialized
    }

    /**
     * 获取工具
     */
    get(name: string): RegisteredTool | undefined {
        return this.tools.get(name)
    }

    /**
     * 检查工具是否存在
     */
    has(name: string): boolean {
        return this.tools.has(name)
    }

    /**
     * 获取工具定义列表（发送给 LLM）
     */
    getDefinitions(includePlan: boolean = false): ToolDefinition[] {
        const planTools = ['create_plan', 'update_plan']
        return Array.from(this.tools.values())
            .filter(tool => tool.enabled && (includePlan || !planTools.includes(tool.name)))
            .map(tool => tool.definition)
    }

    /**
     * 获取可并行执行的工具
     */
    getParallelTools(): string[] {
        return Array.from(this.tools.values())
            .filter(tool => tool.parallel && tool.enabled)
            .map(tool => tool.name)
    }

    /**
     * 获取工具审批类型
     */
    getApprovalType(name: string): ToolApprovalType {
        return this.tools.get(name)?.approvalType || 'none'
    }

    /**
     * 验证工具参数
     */
    validate<T = unknown>(name: string, args: unknown): ValidationResult<T> {
        const tool = this.tools.get(name)
        if (!tool) {
            return { success: false, error: `Unknown tool: ${name}` }
        }

        const result = tool.schema.safeParse(args)
        if (result.success) {
            return { success: true, data: result.data as T }
        }

        const errors = result.error.issues
            .map(issue => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')

        return { success: false, error: `Invalid parameters: ${errors}` }
    }

    /**
     * 执行工具
     */
    async execute(
        name: string,
        args: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolExecutionResult> {
        const tool = this.tools.get(name)
        if (!tool) {
            return { success: false, result: '', error: `Unknown tool: ${name}` }
        }

        if (!tool.enabled) {
            return { success: false, result: '', error: `Tool "${name}" is disabled` }
        }

        // 验证参数
        const validation = this.validate(name, args)
        if (!validation.success) {
            return {
                success: false,
                result: '',
                error: this.formatValidationError(name, validation.error!),
            }
        }

        // 执行
        try {
            return await tool.executor(validation.data as Record<string, unknown>, context)
        } catch (error: any) {
            return { success: false, result: '', error: `Execution error: ${error.message}` }
        }
    }

    /**
     * 格式化验证错误
     */
    formatValidationError(toolName: string, error: string): string {
        return `❌ Tool '${toolName}' validation failed.\n\n**Error**: ${error}\n\n**Fix**: Check required fields and parameter types.`
    }

    /**
     * 启用/禁用工具
     */
    setEnabled(name: string, enabled: boolean): boolean {
        const tool = this.tools.get(name)
        if (!tool) return false
        tool.enabled = enabled
        return true
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const tools = Array.from(this.tools.values())
        return {
            total: tools.length,
            enabled: tools.filter(t => t.enabled).length,
            byCategory: tools.reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + 1
                return acc
            }, {} as Record<string, number>),
        }
    }
}

// 导出单例
export const toolRegistry = new ToolRegistry()
