/**
 * 统一的 LLM Provider 配置中心
 * 合并原 provider.ts 和 llmAdapter.ts 的定义
 * 
 * 设计原则：
 * 1. 单一数据源：所有 Provider 信息集中管理
 * 2. 可扩展性：支持自定义 Provider 和适配器
 * 3. 类型安全：完整的 TypeScript 类型定义
 */

// ============================================
// 类型定义
// ============================================

/** 认证类型 */
export type AuthType = 'api-key' | 'oauth' | 'none'

/** 请求配置 */
export interface RequestConfig {
    endpoint: string              // API 路径 (如 '/chat/completions')
    method: 'POST' | 'GET'
    headers: Record<string, string>
    bodyTemplate: Record<string, unknown>
}

/** 响应解析配置 */
export interface ResponseConfig {
    // 流式响应字段路径 (相对于 choices[0] 的路径)
    contentField: string          // 内容字段，如 'delta.content'
    reasoningField?: string       // 思考字段，如 'delta.reasoning_content'
    toolCallField?: string        // 工具调用，如 'delta.tool_calls'
    finishReasonField?: string    // 完成原因，如 'finish_reason'

    // 工具调用解析 (相对于单个 tool_call 对象的路径)
    toolNamePath?: string         // 工具名，如 'function.name'
    toolArgsPath?: string         // 参数，如 'function.arguments'
    toolIdPath?: string           // ID，如 'id'
    argsIsObject?: boolean        // 参数是否已是对象 (true=对象, false=JSON字符串)

    // 结束标记
    doneMarker?: string           // 流结束标记，如 '[DONE]'
}

/** LLM 适配器配置 */
export interface LLMAdapterConfig {
    id: string
    name: string
    description?: string
    request: RequestConfig
    response: ResponseConfig
    isBuiltin?: boolean
}

/** 适配器覆盖配置（用于自定义内置适配器的行为） */
export interface AdapterOverrides {
    request?: {
        endpoint?: string
        bodyTemplate?: Record<string, unknown>
        headers?: Record<string, string>
    }
    response?: {
        contentField?: string
        reasoningField?: string
        toolCallField?: string
        toolNamePath?: string
        toolArgsPath?: string
        toolIdPath?: string
        argsIsObject?: boolean
        doneMarker?: string
    }
    auth?: {
        type: 'bearer' | 'header' | 'query' | 'none'
        headerName?: string
    }
}

/** 功能支持声明 */
export interface ProviderFeatures {
    streaming: boolean
    tools: boolean
    vision: boolean
    reasoning?: boolean
    codeCompletion?: boolean
}

/** 默认参数配置 */
export interface ProviderDefaults {
    temperature?: number
    topP?: number
    maxTokens?: number
    timeout?: number
}

/** 统一的 Provider 配置 */
export interface UnifiedProviderConfig {
    // 基础信息
    id: string
    name: string
    displayName: string
    description: string
    isLocal?: boolean

    // 认证配置
    auth: {
        type: AuthType
        placeholder?: string
        helpUrl?: string
    }

    // 端点配置
    endpoint: {
        default: string
        customizable: boolean
    }

    // 模型配置
    models: {
        default: string[]
        recommended?: string
    }

    // 适配器配置
    adapter: LLMAdapterConfig

    // 功能支持
    features: ProviderFeatures

    // 默认参数
    defaults: ProviderDefaults
}

// ============================================
// 内置适配器预设
// ============================================

const OPENAI_ADAPTER: LLMAdapterConfig = {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI API 标准格式',
    isBuiltin: true,
    request: {
        endpoint: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // bodyTemplate 只放结构性配置，参数由系统自动填充
        bodyTemplate: {
            stream: true,
        }
    },
    response: {
        contentField: 'delta.content',
        toolCallField: 'delta.tool_calls',
        toolNamePath: 'function.name',
        toolArgsPath: 'function.arguments',
        toolIdPath: 'id',
        argsIsObject: false,
        finishReasonField: 'finish_reason',
        doneMarker: '[DONE]',
    }
}

const ANTHROPIC_ADAPTER: LLMAdapterConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude API 格式 (支持 Extended Thinking)',
    isBuiltin: true,
    request: {
        endpoint: '/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        },
        // bodyTemplate 支持 thinking 配置
        // 用户可在 UI 中覆盖此配置启用 Extended Thinking
        // 示例: { thinking: { type: "enabled", budget_tokens: 10000 } }
        bodyTemplate: {
            stream: true,
        }
    },
    response: {
        contentField: 'delta.text',
        reasoningField: 'thinking',  // Claude 的思考字段
        toolCallField: 'content_block',
        toolNamePath: 'name',
        toolArgsPath: 'input',
        toolIdPath: 'id',
        argsIsObject: true,
        finishReasonField: 'stop_reason',
        doneMarker: 'message_stop',
    }
}

const GEMINI_ADAPTER: LLMAdapterConfig = {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini API 格式 (OpenAI 兼容)',
    isBuiltin: true,
    request: {
        endpoint: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        bodyTemplate: {
            stream: true,
        }
    },
    response: {
        contentField: 'delta.content',
        toolCallField: 'delta.tool_calls',
        toolNamePath: 'function.name',
        toolArgsPath: 'function.arguments',
        toolIdPath: 'id',
        argsIsObject: false,
        finishReasonField: 'finish_reason',
        doneMarker: '[DONE]',
    }
}

// ============================================
// 内置 Provider 配置
// ============================================


export const PROVIDERS: Record<string, UnifiedProviderConfig> = {
    openai: {
        id: 'openai',
        name: 'openai',
        displayName: 'OpenAI',
        description: 'GPT-4, GPT-4o, o1 等模型',
        auth: {
            type: 'api-key',
            placeholder: 'sk-proj-...',
            helpUrl: 'https://platform.openai.com/api-keys',
        },
        endpoint: {
            default: 'https://api.openai.com/v1',
            customizable: true,
        },
        models: {
            default: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
            recommended: 'gpt-4o',
        },
        adapter: OPENAI_ADAPTER,
        features: {
            streaming: true,
            tools: true,
            vision: true,
            reasoning: true,
        },
        defaults: {
            temperature: 0.7,
            topP: 1,
            maxTokens: 8192,
            timeout: 120000,
        },
    },

    anthropic: {
        id: 'anthropic',
        name: 'anthropic',
        displayName: 'Anthropic',
        description: 'Claude 3.5, Claude 4 等模型 (支持 Extended Thinking)',
        auth: {
            type: 'api-key',
            placeholder: 'sk-ant-...',
            helpUrl: 'https://console.anthropic.com/settings/keys',
        },
        endpoint: {
            default: 'https://api.anthropic.com',
            customizable: true,
        },
        models: {
            default: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
            recommended: 'claude-sonnet-4-20250514',
        },
        adapter: ANTHROPIC_ADAPTER,
        features: {
            streaming: true,
            tools: true,
            vision: true,
            reasoning: true,  // 支持 Extended Thinking
        },
        defaults: {
            temperature: 0.7,
            topP: 1,
            maxTokens: 8192,
            timeout: 120000,
        },
    },

    gemini: {
        id: 'gemini',
        name: 'gemini',
        displayName: 'Google Gemini',
        description: 'Gemini Pro, Gemini Flash 等模型',
        auth: {
            type: 'api-key',
            placeholder: 'AIzaSy...',
            helpUrl: 'https://aistudio.google.com/apikey',
        },
        endpoint: {
            default: 'https://generativelanguage.googleapis.com/v1beta/openai',
            customizable: false,
        },
        models: {
            default: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
            recommended: 'gemini-2.0-flash-exp',
        },
        adapter: GEMINI_ADAPTER,
        features: {
            streaming: true,
            tools: true,
            vision: true,
        },
        defaults: {
            temperature: 0.7,
            topP: 1,
            maxTokens: 8192,
            timeout: 120000,
        },
    },

    // Custom 占位符 - 用户可自定义配置
    custom: {
        id: 'custom',
        name: 'custom',
        displayName: 'Custom',
        description: '自定义 API 配置',
        auth: {
            type: 'api-key',
            placeholder: 'your-api-key',
        },
        endpoint: {
            default: '',
            customizable: true,
        },
        models: {
            default: [],
            recommended: undefined,
        },
        adapter: OPENAI_ADAPTER, // 默认使用 OpenAI 适配器
        features: {
            streaming: true,
            tools: true,
            vision: false,
        },
        defaults: {
            temperature: 0.7,
            topP: 1,
            maxTokens: 8192,
            timeout: 120000,
        },
    },
}


// ============================================
// 辅助函数
// ============================================

/** 获取所有 Provider ID 列表 */
export function getProviderIds(): string[] {
    return Object.keys(PROVIDERS)
}

/** 获取 Provider 配置 */
export function getProvider(id: string): UnifiedProviderConfig | undefined {
    return PROVIDERS[id]
}

/** 获取 Provider 的端点 URL */
export function getProviderEndpoint(id: string, customUrl?: string): string {
    const provider = PROVIDERS[id]
    if (!provider) return customUrl || ''

    if (customUrl && provider.endpoint.customizable) {
        return customUrl
    }
    return provider.endpoint.default
}

/** 获取 Provider 的默认模型 */
export function getProviderDefaultModel(id: string): string {
    const provider = PROVIDERS[id]
    if (!provider) return ''
    return provider.models.recommended || provider.models.default[0] || ''
}

/** 获取适配器配置 */
export function getAdapterConfig(providerId: string): LLMAdapterConfig {
    const provider = PROVIDERS[providerId]
    return provider?.adapter || OPENAI_ADAPTER
}

/** 获取所有内置适配器 */
export function getBuiltinAdapters(): LLMAdapterConfig[] {
    return [
        OPENAI_ADAPTER,
        ANTHROPIC_ADAPTER,
        GEMINI_ADAPTER,
    ]
}

/** 根据 ID 获取适配器 */
export function getBuiltinAdapter(id: string): LLMAdapterConfig | undefined {
    return getBuiltinAdapters().find(a => a.id === id)
}

/** 创建自定义适配器 */
export function createCustomAdapter(baseId: string, overrides: Partial<LLMAdapterConfig>): LLMAdapterConfig {
    const base = getBuiltinAdapter(baseId) || OPENAI_ADAPTER
    return {
        ...base,
        ...overrides,
        id: overrides.id || `custom-${Date.now()}`,
        isBuiltin: false,
    }
}

// ============================================
// 类型导出（向后兼容）
// ============================================

/** Provider 类型（向后兼容） */
export type ProviderType = keyof typeof PROVIDERS

/** 内置 Provider 名称（向后兼容） */
export type BuiltinProviderName = Exclude<ProviderType, 'custom'>
