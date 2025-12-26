/**
 * Custom Provider 预设模板
 * 
 * 提供常用的兼容模式预设配置，方便用户快速添加新厂商
 * 
 * 注意：
 * 1. 所有响应字段路径都是相对于 choices[0] 的
 * 2. bodyTemplate 只包含结构性配置，核心字段和 LLM 参数由系统自动填充
 */

import type {
    PresetTemplate,
    CustomProviderConfig,
} from './customProvider'
import type { LLMAdapterConfig } from '@/shared/config/providers'

// ============================================
// LLMAdapterConfig 预设（用于快速配置）
// ============================================

/** OpenAI 兼容适配器配置 */
export const OPENAI_ADAPTER_PRESET: Omit<LLMAdapterConfig, 'id' | 'name'> = {
    isBuiltin: false,
    request: {
        endpoint: '/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // bodyTemplate 只放结构性配置，核心字段由系统自动填充
        bodyTemplate: {
            stream: true,
        },
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
    },
}

/** DeepSeek 适配器配置（支持 reasoning） */
export const DEEPSEEK_ADAPTER_PRESET: Omit<LLMAdapterConfig, 'id' | 'name'> = {
    ...OPENAI_ADAPTER_PRESET,
    response: {
        ...OPENAI_ADAPTER_PRESET.response,
        reasoningField: 'delta.reasoning_content',
    },
}

/** 智谱 GLM 适配器配置 */
export const ZHIPU_ADAPTER_PRESET: Omit<LLMAdapterConfig, 'id' | 'name'> = {
    ...OPENAI_ADAPTER_PRESET,
    request: {
        ...OPENAI_ADAPTER_PRESET.request,
        bodyTemplate: {
            stream: true,
            tool_choice: 'auto',
        },
    },
    response: {
        ...OPENAI_ADAPTER_PRESET.response,
        reasoningField: 'delta.reasoning_content',
        argsIsObject: false, // 智谱返回的参数是 JSON 字符串
    },
}

/** Anthropic 适配器配置 (支持 Extended Thinking) */
export const ANTHROPIC_ADAPTER_PRESET: Omit<LLMAdapterConfig, 'id' | 'name'> = {
    isBuiltin: false,
    request: {
        endpoint: '/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        },
        // 启用 Extended Thinking 示例:
        // bodyTemplate: {
        //     stream: true,
        //     thinking: { type: "enabled", budget_tokens: 10000 }
        // }
        bodyTemplate: {
            stream: true,
        },
    },
    response: {
        contentField: 'delta.text',
        reasoningField: 'thinking',
        toolCallField: 'content_block',
        toolNamePath: 'name',
        toolArgsPath: 'input',
        toolIdPath: 'id',
        argsIsObject: true,
        finishReasonField: 'stop_reason',
        doneMarker: 'message_stop',
    },
}

/** Anthropic Extended Thinking 适配器配置 */
export const ANTHROPIC_THINKING_ADAPTER_PRESET: Omit<LLMAdapterConfig, 'id' | 'name'> = {
    ...ANTHROPIC_ADAPTER_PRESET,
    request: {
        ...ANTHROPIC_ADAPTER_PRESET.request,
        bodyTemplate: {
            stream: true,
            thinking: {
                type: 'enabled',
                budget_tokens: 10000,
            },
        },
    },
}

// ============================================
// 预设模板列表
// ============================================

export const PRESET_TEMPLATES: PresetTemplate[] = [
    {
        id: 'openai-compatible',
        name: 'OpenAI 兼容',
        description: '适用于 DeepSeek, Groq, Qwen, Ollama, Together AI 等 OpenAI 兼容 API',
        config: {
            mode: 'openai',
            features: {
                streaming: true,
                tools: true,
                vision: false,
                reasoning: false,
            },
            defaults: {
                temperature: 0.7,
                maxTokens: 8192,
                timeout: 120000,
            },
        },
        /** 对应的 LLMAdapterConfig 预设 */
        adapterPreset: OPENAI_ADAPTER_PRESET,
    },
    {
        id: 'deepseek-compatible',
        name: 'DeepSeek 兼容',
        description: '适用于 DeepSeek 等支持推理的 API',
        config: {
            mode: 'openai',
            features: {
                streaming: true,
                tools: true,
                vision: false,
                reasoning: true,
            },
            defaults: {
                temperature: 0.7,
                maxTokens: 8192,
                timeout: 120000,
            },
        },
        adapterPreset: DEEPSEEK_ADAPTER_PRESET,
    },
    {
        id: 'anthropic-compatible',
        name: 'Anthropic 兼容',
        description: '适用于 AWS Bedrock Claude 等 Anthropic 兼容 API',
        config: {
            mode: 'anthropic',
            features: {
                streaming: true,
                tools: true,
                vision: true,
                reasoning: false,
            },
            defaults: {
                temperature: 0.7,
                maxTokens: 8192,
                timeout: 120000,
            },
        },
        adapterPreset: ANTHROPIC_ADAPTER_PRESET,
    },
    {
        id: 'anthropic-thinking',
        name: 'Anthropic Extended Thinking',
        description: '启用 Claude Extended Thinking 模式，支持深度推理',
        config: {
            mode: 'anthropic',
            features: {
                streaming: true,
                tools: true,
                vision: true,
                reasoning: true,
            },
            defaults: {
                temperature: 1,  // Thinking 模式建议 temperature=1
                maxTokens: 16000,
                timeout: 180000,
            },
        },
        adapterPreset: ANTHROPIC_THINKING_ADAPTER_PRESET,
    },
    {
        id: 'custom-blank',
        name: '完全自定义',
        description: '从零开始配置请求体、响应解析和认证方式',
        config: {
            mode: 'custom',
            features: {
                streaming: true,
                tools: true,
            },
            defaults: {
                maxTokens: 8192,
                timeout: 120000,
            },
        },
        adapterPreset: OPENAI_ADAPTER_PRESET,
    },
]

// ============================================
// 常用厂商快速配置
// ============================================

/** 常用厂商预设 */
export const VENDOR_PRESETS: Record<string, Partial<CustomProviderConfig>> = {
    deepseek: {
        name: 'DeepSeek',
        description: 'DeepSeek V3, R1 等模型',
        baseUrl: 'https://api.deepseek.com',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        defaultModel: 'deepseek-chat',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
            vision: false,
            reasoning: true,
        },
    },
    groq: {
        name: 'Groq',
        description: '超快推理，Llama, Mixtral 等',
        baseUrl: 'https://api.groq.com/openai/v1',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        defaultModel: 'llama-3.3-70b-versatile',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
            vision: false,
        },
    },
    zhipu: {
        name: '智谱 GLM',
        description: 'GLM-4, GLM-4.5 系列',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
        defaultModel: 'glm-4-plus',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
            vision: true,
            reasoning: true,
        },
    },
    qwen: {
        name: '阿里 Qwen',
        description: 'Qwen 系列 (通义千问)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
        defaultModel: 'qwen-plus',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
            vision: true,
        },
    },
    ollama: {
        name: 'Ollama',
        description: '本地运行开源模型',
        baseUrl: 'http://localhost:11434/v1',
        models: ['llama3.2', 'codellama', 'qwen2.5-coder'],
        defaultModel: 'llama3.2',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
            vision: false,
        },
        defaults: {
            timeout: 300000, // 本地模型可能较慢
        },
    },
    siliconflow: {
        name: '硅基流动',
        description: '硅基流动 API',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'],
        defaultModel: 'deepseek-ai/DeepSeek-V3',
        mode: 'openai',
        features: {
            streaming: true,
            tools: true,
        },
    },
}

// ============================================
// 辅助函数
// ============================================

/**
 * 从预设模板创建新的 CustomProviderConfig
 */
export function createFromPreset(
    presetId: string,
    overrides: Partial<CustomProviderConfig>
): CustomProviderConfig {
    const preset = PRESET_TEMPLATES.find(p => p.id === presetId)
    if (!preset) {
        throw new Error(`Unknown preset: ${presetId}`)
    }

    const now = Date.now()
    return {
        id: overrides.id || `custom-${now}`,
        name: overrides.name || 'New Provider',
        baseUrl: overrides.baseUrl || '',
        models: overrides.models || [],
        mode: 'openai',
        ...preset.config,
        ...overrides,
        createdAt: now,
        updatedAt: now,
    } as CustomProviderConfig
}

/**
 * 从厂商预设创建新的 CustomProviderConfig
 */
export function createFromVendorPreset(
    vendorId: string
): CustomProviderConfig {
    const preset = VENDOR_PRESETS[vendorId]
    if (!preset) {
        throw new Error(`Unknown vendor: ${vendorId}`)
    }

    const now = Date.now()
    return {
        id: `${vendorId}-${now}`,
        ...preset,
        name: preset.name || vendorId,
        baseUrl: preset.baseUrl || '',
        models: preset.models || [],
        mode: preset.mode || 'openai',
        createdAt: now,
        updatedAt: now,
    } as CustomProviderConfig
}

/**
 * 验证 CustomProviderConfig 完整性
 */
export function validateCustomProviderConfig(
    config: Partial<CustomProviderConfig>
): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.id) errors.push('缺少 ID')
    if (!config.name) errors.push('缺少名称')
    if (!config.baseUrl) errors.push('缺少 API URL')
    if (!config.models?.length) errors.push('至少需要一个模型')
    if (!config.mode) errors.push('缺少模式选择')

    if (config.mode === 'custom' && !config.customConfig) {
        errors.push('自定义模式需要提供 customConfig')
    }

    if (config.mode === 'custom' && config.customConfig) {
        if (!config.customConfig.request?.endpoint) {
            errors.push('缺少请求端点')
        }
        if (!config.customConfig.response?.sseConfig?.doneMarker) {
            errors.push('缺少 SSE 结束标记')
        }
        if (!config.customConfig.auth?.type) {
            errors.push('缺少认证类型')
        }
    }

    return { valid: errors.length === 0, errors }
}
