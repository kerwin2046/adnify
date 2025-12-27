/**
 * 工具统一配置
 * 
 * 单一数据源：所有工具的定义、schema、元数据都从这里生成
 * 添加新工具只需在 TOOL_CONFIGS 中添加一项
 */

import { z } from 'zod'
import type { ToolApprovalType } from '@/shared/types/llm'

// ============================================
// 类型定义
// ============================================

export type ToolCategory = 'read' | 'write' | 'terminal' | 'search' | 'lsp' | 'network' | 'plan'

export interface ToolPropertyDef {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description: string
    required?: boolean
    default?: unknown
    enum?: string[]
    items?: ToolPropertyDef
    properties?: Record<string, ToolPropertyDef>
}

export interface ToolConfig {
    name: string
    displayName: string
    description: string
    category: ToolCategory
    approvalType: ToolApprovalType
    parallel: boolean
    requiresWorkspace: boolean
    enabled: boolean
    parameters: Record<string, ToolPropertyDef>
    /** 自定义 Zod schema（可选，用于复杂验证） */
    customSchema?: z.ZodSchema
    /** 自定义验证函数 */
    validate?: (data: Record<string, unknown>) => { valid: boolean; error?: string }
}

// ============================================
// 工具配置
// ============================================

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
    // ===== 读取类工具 =====
    read_file: {
        name: 'read_file',
        displayName: 'Read File',
        description: 'Read file contents with optional line range.',
        category: 'read',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            start_line: { type: 'number', description: 'Starting line (1-indexed)' },
            end_line: { type: 'number', description: 'Ending line' },
        },
        validate: (data) => {
            if (data.start_line && data.end_line && (data.start_line as number) > (data.end_line as number)) {
                return { valid: false, error: 'start_line must be <= end_line' }
            }
            return { valid: true }
        },
    },

    list_directory: {
        name: 'list_directory',
        displayName: 'List Directory',
        description: 'List files and folders in a directory.',
        category: 'read',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'Directory path', required: true },
        },
    },

    get_dir_tree: {
        name: 'get_dir_tree',
        displayName: 'Directory Tree',
        description: 'Get recursive directory tree structure.',
        category: 'read',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'Root directory path', required: true },
            max_depth: { type: 'number', description: 'Maximum depth (default: 3)', default: 3 },
        },
    },

    search_files: {
        name: 'search_files',
        displayName: 'Search Files',
        description: 'Search for text pattern in files.',
        category: 'search',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'Directory to search', required: true },
            pattern: { type: 'string', description: 'Search pattern', required: true },
            is_regex: { type: 'boolean', description: 'Use regex', default: false },
            file_pattern: { type: 'string', description: 'File filter (e.g., "*.ts")' },
        },
    },

    search_in_file: {
        name: 'search_in_file',
        displayName: 'Search in File',
        description: 'Search for pattern within a specific file.',
        category: 'search',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path to search in', required: true },
            pattern: { type: 'string', description: 'Search pattern', required: true },
            is_regex: { type: 'boolean', description: 'Use regex pattern', default: false },
        },
    },

    read_multiple_files: {
        name: 'read_multiple_files',
        displayName: 'Read Multiple Files',
        description: 'Read multiple files at once.',
        category: 'read',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            paths: { type: 'array', description: 'Array of file paths to read', required: true, items: { type: 'string', description: 'File path' } },
        },
    },

    // ===== 编辑类工具 =====
    edit_file: {
        name: 'edit_file',
        displayName: 'Edit File',
        description: 'Edit file using SEARCH/REPLACE blocks. Format: <<<<<<< SEARCH\\nold\\n=======\\nnew\\n>>>>>>> REPLACE',
        category: 'write',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            search_replace_blocks: { type: 'string', description: 'SEARCH/REPLACE blocks', required: true },
        },
    },

    write_file: {
        name: 'write_file',
        displayName: 'Write File',
        description: 'Write or overwrite entire file content.',
        category: 'write',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            content: { type: 'string', description: 'File content', required: true },
        },
    },

    replace_file_content: {
        name: 'replace_file_content',
        displayName: 'Replace Content',
        description: 'Replace a specific range of lines in a file.',
        category: 'write',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            start_line: { type: 'number', description: 'Start line (1-indexed)', required: true },
            end_line: { type: 'number', description: 'End line (inclusive)', required: true },
            content: { type: 'string', description: 'New content', required: true },
        },
        validate: (data) => {
            if ((data.start_line as number) > (data.end_line as number)) {
                return { valid: false, error: 'start_line must be <= end_line' }
            }
            return { valid: true }
        },
    },

    create_file_or_folder: {
        name: 'create_file_or_folder',
        displayName: 'Create',
        description: 'Create a new file or folder. Path ending with / creates folder.',
        category: 'write',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'Path (end with / for folder)', required: true },
            content: { type: 'string', description: 'Initial content for files' },
        },
    },

    delete_file_or_folder: {
        name: 'delete_file_or_folder',
        displayName: 'Delete',
        description: 'Delete a file or folder.',
        category: 'write',
        approvalType: 'dangerous',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'Path to delete', required: true },
            recursive: { type: 'boolean', description: 'Delete recursively', default: false },
        },
    },

    // ===== 终端工具 =====
    run_command: {
        name: 'run_command',
        displayName: 'Run Command',
        description: 'Execute a shell command.',
        category: 'terminal',
        approvalType: 'terminal',
        parallel: false,
        requiresWorkspace: false,
        enabled: true,
        parameters: {
            command: { type: 'string', description: 'Shell command', required: true },
            cwd: { type: 'string', description: 'Working directory' },
            timeout: { type: 'number', description: 'Timeout in seconds (default: 30)', default: 30 },
        },
    },

    get_lint_errors: {
        name: 'get_lint_errors',
        displayName: 'Lint Errors',
        description: 'Get lint/compile errors for a file.',
        category: 'lsp',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
        },
    },

    // ===== 搜索工具 =====
    codebase_search: {
        name: 'codebase_search',
        displayName: 'Semantic Search',
        description: 'Semantic search across the codebase using AI embeddings.',
        category: 'search',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            query: { type: 'string', description: 'Natural language search query', required: true },
            top_k: { type: 'number', description: 'Number of results (default: 10)', default: 10 },
        },
    },

    // ===== LSP 工具 =====
    find_references: {
        name: 'find_references',
        displayName: 'Find References',
        description: 'Find all references to a symbol.',
        category: 'lsp',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            column: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
    },

    go_to_definition: {
        name: 'go_to_definition',
        displayName: 'Go to Definition',
        description: 'Get the definition location of a symbol.',
        category: 'lsp',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            column: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
    },

    get_hover_info: {
        name: 'get_hover_info',
        displayName: 'Hover Info',
        description: 'Get type information and documentation for a symbol.',
        category: 'lsp',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
            line: { type: 'number', description: 'Line number (1-indexed)', required: true },
            column: { type: 'number', description: 'Column number (1-indexed)', required: true },
        },
    },

    get_document_symbols: {
        name: 'get_document_symbols',
        displayName: 'Document Symbols',
        description: 'Get all symbols in a file.',
        category: 'lsp',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            path: { type: 'string', description: 'File path', required: true },
        },
    },

    // ===== 网络工具 =====
    web_search: {
        name: 'web_search',
        displayName: 'Web Search',
        description: 'Search the web for information.',
        category: 'network',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: false,
        enabled: true,
        parameters: {
            query: { type: 'string', description: 'Search query', required: true },
            max_results: { type: 'number', description: 'Maximum results (default: 5)', default: 5 },
        },
    },

    read_url: {
        name: 'read_url',
        displayName: 'Read URL',
        description: 'Fetch and read content from a URL.',
        category: 'network',
        approvalType: 'none',
        parallel: true,
        requiresWorkspace: false,
        enabled: true,
        parameters: {
            url: { type: 'string', description: 'URL to fetch', required: true },
            timeout: { type: 'number', description: 'Timeout in seconds (default: 30)', default: 30 },
        },
    },

    // ===== Plan 工具 =====
    create_plan: {
        name: 'create_plan',
        displayName: 'Create Plan',
        description: 'Create a new execution plan with steps.',
        category: 'plan',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            items: {
                type: 'array',
                description: 'Plan items',
                required: true,
                items: {
                    type: 'object',
                    description: 'Plan item',
                    properties: {
                        title: { type: 'string', description: 'Item title', required: true },
                        description: { type: 'string', description: 'Item description' },
                    },
                },
            },
        },
    },

    update_plan: {
        name: 'update_plan',
        displayName: 'Update Plan',
        description: 'Update the current plan status or items.',
        category: 'plan',
        approvalType: 'none',
        parallel: false,
        requiresWorkspace: true,
        enabled: true,
        parameters: {
            status: { type: 'string', description: 'Plan status', enum: ['active', 'completed', 'failed'] },
            items: { type: 'array', description: 'Updated items' },
            currentStepId: { type: 'string', description: 'Current step ID' },
            title: { type: 'string', description: 'Plan title' },
        },
    },
}


// ============================================
// 生成器函数
// ============================================

import type { ToolDefinition, ToolPropertySchema } from '@/shared/types/llm'

/** 将 ToolPropertyDef 转换为 ToolPropertySchema */
function convertToPropertySchema(prop: ToolPropertyDef): ToolPropertySchema {
    const schema: ToolPropertySchema = {
        type: prop.type,
        description: prop.description,
    }
    if (prop.enum) schema.enum = prop.enum
    if (prop.items) schema.items = convertToPropertySchema(prop.items)
    if (prop.properties) {
        schema.properties = Object.fromEntries(
            Object.entries(prop.properties).map(([k, v]) => [k, convertToPropertySchema(v)])
        )
    }
    return schema
}

/** 生成 LLM 工具定义 */
export function generateToolDefinition(config: ToolConfig): ToolDefinition {
    const properties: Record<string, ToolPropertySchema> = {}
    const required: string[] = []

    for (const [key, prop] of Object.entries(config.parameters)) {
        properties[key] = convertToPropertySchema(prop)
        if (prop.required) {
            required.push(key)
        }
    }

    return {
        name: config.name,
        description: config.description,
        ...(config.approvalType !== 'none' && { approvalType: config.approvalType }),
        parameters: {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        },
    }
}

/** 生成 Zod Schema */
export function generateZodSchema(config: ToolConfig): z.ZodSchema {
    if (config.customSchema) {
        return config.customSchema
    }

    const shape: Record<string, z.ZodTypeAny> = {}

    for (const [key, prop] of Object.entries(config.parameters)) {
        let schema: z.ZodTypeAny

        switch (prop.type) {
            case 'string':
                schema = prop.enum
                    ? z.enum(prop.enum as [string, ...string[]])
                    : z.string().min(1, `${key} is required`)
                break
            case 'number':
                schema = z.number().int()
                break
            case 'boolean':
                schema = z.boolean()
                break
            case 'array':
                schema = z.array(z.any())
                break
            case 'object':
                schema = z.object({}).passthrough()
                break
            default:
                schema = z.any()
        }

        if (!prop.required) {
            schema = schema.optional()
            if (prop.default !== undefined) {
                schema = schema.default(prop.default)
            }
        }

        shape[key] = schema
    }

    let objectSchema = z.object(shape)

    // 添加自定义验证
    if (config.validate) {
        return objectSchema.refine(
            (data) => config.validate!(data).valid,
            (data) => ({ message: config.validate!(data).error || 'Validation failed' })
        )
    }

    return objectSchema
}

// ============================================
// 导出生成的数据
// ============================================

/** 所有工具定义（发送给 LLM） */
export const TOOL_DEFINITIONS = Object.fromEntries(
    Object.entries(TOOL_CONFIGS).map(([name, config]) => [name, generateToolDefinition(config)])
)

/** 所有 Zod Schemas */
export const TOOL_SCHEMAS = Object.fromEntries(
    Object.entries(TOOL_CONFIGS).map(([name, config]) => [name, generateZodSchema(config)])
)

/** 工具显示名称映射 */
export const TOOL_DISPLAY_NAMES = Object.fromEntries(
    Object.entries(TOOL_CONFIGS).map(([name, config]) => [name, config.displayName])
)

// ============================================
// 辅助函数
// ============================================

const PLAN_TOOLS = ['create_plan', 'update_plan']

/** 获取工具定义列表 */
export function getToolDefinitions(includePlan = false) {
    const definitions = Object.values(TOOL_DEFINITIONS)
    return includePlan ? definitions : definitions.filter(d => !PLAN_TOOLS.includes(d.name))
}

/** 获取工具审批类型 */
export function getToolApprovalType(toolName: string): ToolApprovalType {
    return TOOL_CONFIGS[toolName]?.approvalType || 'none'
}

/** 获取工具显示名称 */
export function getToolDisplayName(toolName: string): string {
    return TOOL_CONFIGS[toolName]?.displayName || toolName
}

/** 获取只读工具列表 */
export function getReadOnlyTools(): string[] {
    return Object.entries(TOOL_CONFIGS)
        .filter(([_, config]) => config.parallel && config.category !== 'write')
        .map(([name]) => name)
}

/** 获取写入工具列表 */
export function getWriteTools(): string[] {
    return Object.entries(TOOL_CONFIGS)
        .filter(([_, config]) => config.category === 'write')
        .map(([name]) => name)
}

/** 获取需要审批的工具 */
export function getApprovalRequiredTools(): string[] {
    return Object.entries(TOOL_CONFIGS)
        .filter(([_, config]) => config.approvalType !== 'none')
        .map(([name]) => name)
}

/** 检查工具是否可并行执行 */
export function isParallelTool(toolName: string): boolean {
    return TOOL_CONFIGS[toolName]?.parallel ?? false
}

/** 检查工具是否为写入类工具 */
export function isWriteTool(toolName: string): boolean {
    return TOOL_CONFIGS[toolName]?.category === 'write'
}

/** 获取工具元数据 */
export function getToolMetadata(toolName: string): ToolConfig | undefined {
    return TOOL_CONFIGS[toolName]
}
