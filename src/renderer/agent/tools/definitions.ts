/**
 * 工具定义
 * 发送给 LLM 的工具描述（OpenAI Function Calling 格式）
 */

import type { ToolDefinition, ToolApprovalType } from '@/shared/types'

// ===== 工具定义 =====

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
    // 读取类
    read_file: {
        name: 'read_file',
        description: 'Read file contents with optional line range.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                start_line: { type: 'number', description: 'Starting line (1-indexed)' },
                end_line: { type: 'number', description: 'Ending line' },
            },
            required: ['path'],
        },
    },
    list_directory: {
        name: 'list_directory',
        description: 'List files and folders in a directory.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path' },
            },
            required: ['path'],
        },
    },
    get_dir_tree: {
        name: 'get_dir_tree',
        description: 'Get recursive directory tree structure.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Root directory path' },
                max_depth: { type: 'number', description: 'Maximum depth (default: 3)' },
            },
            required: ['path'],
        },
    },
    search_files: {
        name: 'search_files',
        description: 'Search for text pattern in files.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory to search' },
                pattern: { type: 'string', description: 'Search pattern' },
                is_regex: { type: 'boolean', description: 'Use regex' },
                file_pattern: { type: 'string', description: 'File filter (e.g., "*.ts")' },
            },
            required: ['path', 'pattern'],
        },
    },
    search_in_file: {
        name: 'search_in_file',
        description: 'Search for pattern within a specific file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to search in' },
                pattern: { type: 'string', description: 'Search pattern' },
                is_regex: { type: 'boolean', description: 'Use regex pattern' },
            },
            required: ['path', 'pattern'],
        },
    },
    read_multiple_files: {
        name: 'read_multiple_files',
        description: 'Read multiple files at once.',
        parameters: {
            type: 'object',
            properties: {
                paths: { type: 'array', description: 'Array of file paths to read' },
            },
            required: ['paths'],
        },
    },

    // 编辑类
    edit_file: {
        name: 'edit_file',
        description: 'Edit file using SEARCH/REPLACE blocks. Format: <<<<<<< SEARCH\\nold\\n=======\\nnew\\n>>>>>>> REPLACE',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                search_replace_blocks: { type: 'string', description: 'SEARCH/REPLACE blocks' },
            },
            required: ['path', 'search_replace_blocks'],
        },
    },
    write_file: {
        name: 'write_file',
        description: 'Write or overwrite entire file content.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
        },
    },
    replace_file_content: {
        name: 'replace_file_content',
        description: 'Replace a specific range of lines in a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                start_line: { type: 'number', description: 'Start line (1-indexed)' },
                end_line: { type: 'number', description: 'End line (inclusive)' },
                content: { type: 'string', description: 'New content' },
            },
            required: ['path', 'start_line', 'end_line', 'content'],
        },
    },
    create_file_or_folder: {
        name: 'create_file_or_folder',
        description: 'Create a new file or folder. Path ending with / creates folder.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path (end with / for folder)' },
                content: { type: 'string', description: 'Initial content for files' },
            },
            required: ['path'],
        },
    },
    delete_file_or_folder: {
        name: 'delete_file_or_folder',
        description: 'Delete a file or folder.',
        approvalType: 'dangerous',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to delete' },
                recursive: { type: 'boolean', description: 'Delete recursively' },
            },
            required: ['path'],
        },
    },

    // 终端类
    run_command: {
        name: 'run_command',
        description: 'Execute a shell command.',
        approvalType: 'terminal',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Shell command' },
                cwd: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
            },
            required: ['command'],
        },
    },
    get_lint_errors: {
        name: 'get_lint_errors',
        description: 'Get lint/compile errors for a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
        },
    },

    // 搜索类
    codebase_search: {
        name: 'codebase_search',
        description: 'Semantic search across the codebase using AI embeddings.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language search query' },
                top_k: { type: 'number', description: 'Number of results (default: 10)' },
            },
            required: ['query'],
        },
    },

    // LSP 工具
    find_references: {
        name: 'find_references',
        description: 'Find all references to a symbol.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    go_to_definition: {
        name: 'go_to_definition',
        description: 'Get the definition location of a symbol.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    get_hover_info: {
        name: 'get_hover_info',
        description: 'Get type information and documentation for a symbol.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                line: { type: 'number', description: 'Line number (1-indexed)' },
                column: { type: 'number', description: 'Column number (1-indexed)' },
            },
            required: ['path', 'line', 'column'],
        },
    },
    get_document_symbols: {
        name: 'get_document_symbols',
        description: 'Get all symbols in a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
        },
    },

    // 网络工具
    web_search: {
        name: 'web_search',
        description: 'Search the web for information.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                max_results: { type: 'number', description: 'Maximum results (default: 5)' },
            },
            required: ['query'],
        },
    },
    read_url: {
        name: 'read_url',
        description: 'Fetch and read content from a URL.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to fetch' },
                timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
            },
            required: ['url'],
        },
    },

    // Plan 工具
    create_plan: {
        name: 'create_plan',
        description: 'Create a new execution plan with steps.',
        parameters: {
            type: 'object',
            properties: {
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { title: { type: 'string' }, description: { type: 'string' } },
                        required: ['title']
                    }
                }
            },
            required: ['items']
        }
    },
    update_plan: {
        name: 'update_plan',
        description: 'Update the current plan status or items.',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['active', 'completed', 'failed'] },
                items: { type: 'array' },
                currentStepId: { type: 'string' },
                title: { type: 'string' }
            },
            required: []
        }
    },
}

// ===== 工具显示名称 =====

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
    read_file: 'Read',
    list_directory: 'List',
    get_dir_tree: 'Tree',
    search_files: 'Search',
    search_in_file: 'Search in File',
    edit_file: 'Edit',
    replace_file_content: 'Replace',
    write_file: 'Write',
    create_file_or_folder: 'Create',
    delete_file_or_folder: 'Delete',
    run_command: 'Run',
    get_lint_errors: 'Lint',
    codebase_search: 'Semantic Search',
    find_references: 'References',
    go_to_definition: 'Definition',
    get_hover_info: 'Hover',
    get_document_symbols: 'Symbols',
    read_multiple_files: 'Read Multiple',
    web_search: 'Web Search',
    read_url: 'Read URL',
    create_plan: 'Create Plan',
    update_plan: 'Update Plan',
}

// Plan 工具名称
const PLAN_TOOLS = ['create_plan', 'update_plan']

/**
 * 获取工具定义列表
 */
export function getToolDefinitions(includePlan: boolean = false): ToolDefinition[] {
    const definitions = Object.values(TOOL_DEFINITIONS)
    if (includePlan) return definitions
    return definitions.filter(tool => !PLAN_TOOLS.includes(tool.name))
}

/**
 * 获取工具审批类型
 */
export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
    return TOOL_DEFINITIONS[toolName]?.approvalType
}

/**
 * 获取工具显示名称
 */
export function getToolDisplayName(toolName: string): string {
    return TOOL_DISPLAY_NAMES[toolName] || toolName
}
