import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Code2, FileJson, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button, Input, Select } from '@components/ui'
import type { AdvancedConfig, LLMAdapterConfig } from '@/shared/config/providers'

interface AdapterOverridesEditorProps {
    overrides?: AdvancedConfig
    onChange: (overrides: AdvancedConfig | undefined) => void
    language: 'en' | 'zh'
    defaultEndpoint?: string
    /** 默认的适配器配置，用于显示 placeholder */
    defaultConfig?: LLMAdapterConfig
}

const AUTH_TYPE_OPTIONS = [
    { value: 'bearer', label: 'Bearer Token (Authorization: Bearer xxx)' },
    { value: 'header', label: 'Custom Header' },
    { value: 'query', label: 'Query Parameter' },
    { value: 'none', label: 'None' },
]

export function AdapterOverridesEditor({
    overrides,
    onChange,
    language,
    defaultEndpoint = '/chat/completions',
    defaultConfig,
}: AdapterOverridesEditorProps) {
    const [showRequest, setShowRequest] = useState(false)
    const [showResponse, setShowResponse] = useState(false)
    const [bodyJsonText, setBodyJsonText] = useState('')
    const [jsonError, setJsonError] = useState<string | null>(null)

    // 获取默认值（用于 placeholder 显示）
    const defaults = {
        endpoint: defaultConfig?.request?.endpoint || defaultEndpoint,
        bodyTemplate: defaultConfig?.request?.bodyTemplate,
        contentField: defaultConfig?.response?.contentField || 'delta.content',
        reasoningField: defaultConfig?.response?.reasoningField || '',
        toolCallField: defaultConfig?.response?.toolCallField || 'delta.tool_calls',
        toolNamePath: defaultConfig?.response?.toolNamePath || 'function.name',
        toolArgsPath: defaultConfig?.response?.toolArgsPath || 'function.arguments',
        doneMarker: defaultConfig?.response?.doneMarker || '[DONE]',
        argsIsObject: defaultConfig?.response?.argsIsObject || false,
    }

    // 追踪上一次的 Provider ID，用于检测 Provider 切换
    const [lastProviderId, setLastProviderId] = useState<string | undefined>(undefined)
    
    // 初始化 JSON 文本
    useEffect(() => {
        const currentProviderId = defaultConfig?.id
        
        // 首次加载或 Provider 切换时，重新初始化
        if (lastProviderId === undefined || currentProviderId !== lastProviderId) {
            setLastProviderId(currentProviderId)
            
            if (overrides?.request?.bodyTemplate) {
                setBodyJsonText(JSON.stringify(overrides.request.bodyTemplate, null, 2))
            } else if (defaultConfig?.request?.bodyTemplate) {
                setBodyJsonText(JSON.stringify(defaultConfig.request.bodyTemplate, null, 2))
            } else {
                setBodyJsonText('{\n  "stream": true\n}')
            }
            setJsonError(null)
        }
    }, [defaultConfig?.id, lastProviderId, overrides?.request?.bodyTemplate])

    const updateRequest = (updates: NonNullable<AdvancedConfig['request']>) => {
        const newOverrides: AdvancedConfig = {
            ...overrides,
            request: {
                ...overrides?.request,
                ...updates
            }
        }
        // 清理空对象
        if (Object.keys(newOverrides.request!).length === 0) delete newOverrides.request
        onChange(newOverrides)
    }

    const updateResponse = (updates: NonNullable<AdvancedConfig['response']>) => {
        const newOverrides: AdvancedConfig = {
            ...overrides,
            response: {
                ...overrides?.response,
                ...updates
            }
        }
        if (Object.keys(newOverrides.response!).length === 0) delete newOverrides.response
        onChange(newOverrides)
    }

    const updateAuth = (updates: Partial<NonNullable<AdvancedConfig['auth']>>) => {
        const newOverrides: AdvancedConfig = {
            ...overrides,
            auth: {
                ...overrides?.auth,
                ...updates
            } as any
        }
        onChange(newOverrides)
    }

    /**
     * 清理请求体模板（移除核心字段和 LLM 参数，这些由系统自动填充）
     */
    const cleanBodyTemplate = (template: Record<string, unknown>): Record<string, unknown> => {
        const result = { ...template }
        
        // 移除系统自动填充的字段
        const autoFilledFields = ['model', 'messages', 'tools', 'max_tokens', 'temperature', 'top_p']
        for (const field of autoFilledFields) {
            delete result[field]
        }
        
        // 移除占位符（兼容旧配置）
        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
                delete result[key]
            }
        }
        
        // 确保 stream 存在
        if (!('stream' in result)) {
            result.stream = true
        }
        
        return result
    }

    const handleBodyJsonChange = (text: string) => {
        setBodyJsonText(text)
        if (!text.trim()) {
            setJsonError(null)
            updateRequest({ bodyTemplate: undefined })
            return
        }
        try {
            let parsed = JSON.parse(text)
            // 清理核心字段和 LLM 参数（由系统自动填充）
            parsed = cleanBodyTemplate(parsed)
            setJsonError(null)
            // 更新显示的文本
            const updatedText = JSON.stringify(parsed, null, 2)
            if (updatedText !== text) {
                setBodyJsonText(updatedText)
            }
            updateRequest({ bodyTemplate: parsed })
        } catch (e: any) {
            setJsonError(e.message)
        }
    }

    const handleReset = () => {
        onChange(undefined)
        // 重置为默认值
        if (defaultConfig?.request?.bodyTemplate) {
            setBodyJsonText(JSON.stringify(defaultConfig.request.bodyTemplate, null, 2))
        } else {
            setBodyJsonText('{\n  "stream": true\n}')
        }
        setJsonError(null)
    }

    const hasOverrides = !!overrides

    return (
        <div className="space-y-3 border border-border-subtle rounded-lg overflow-hidden bg-surface/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface/30 border-b border-border-subtle">
                <span className="text-xs font-medium text-text-secondary">
                    {language === 'zh' ? '高级适配器配置 (覆盖默认值)' : 'Advanced Adapter Config (Overrides)'}
                </span>
                {hasOverrides && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 px-2 text-[10px]">
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {language === 'zh' ? '重置' : 'Reset'}
                    </Button>
                )}
            </div>

            {/* Auth Config */}
            <div className="px-4 pb-2">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-text-secondary">
                            {language === 'zh' ? '认证方式' : 'Authentication Type'}
                        </label>
                        <Select
                            value={overrides?.auth?.type || 'bearer'}
                            onChange={(v) => updateAuth({ type: v as any })}
                            options={AUTH_TYPE_OPTIONS}
                            className="h-8 text-xs"
                        />
                    </div>
                    {overrides?.auth?.type === 'header' && (
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">
                                {language === 'zh' ? 'Header 名称' : 'Header Name'}
                            </label>
                            <Input
                                value={overrides?.auth?.headerName || ''}
                                onChange={(e) => updateAuth({ headerName: e.target.value })}
                                placeholder="X-API-Key"
                                className="h-8 text-xs font-mono"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Request Config */}
            <div className="px-4 pb-2">
                <button
                    onClick={() => setShowRequest(!showRequest)}
                    className="flex items-center gap-2 text-xs font-medium text-text-primary mb-2 hover:text-accent transition-colors"
                >
                    {showRequest ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <Code2 className="w-3.5 h-3.5" />
                    {language === 'zh' ? '请求配置' : 'Request Configuration'}
                    {overrides?.request && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>

                {showRequest && (
                    <div className="space-y-3 pl-2 border-l-2 border-border-subtle ml-1.5">
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">
                                {language === 'zh' ? 'API 端点 (相对路径)' : 'API Endpoint'}
                            </label>
                            <Input
                                value={overrides?.request?.endpoint ?? defaults.endpoint}
                                onChange={(e) => updateRequest({ endpoint: e.target.value || undefined })}
                                placeholder={defaults.endpoint}
                                className="h-8 text-xs font-mono"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">
                                {language === 'zh' ? '请求体模板 (JSON)' : 'Body Template (JSON)'}
                            </label>
                            <div className="relative">
                                <textarea
                                    value={bodyJsonText}
                                    onChange={(e) => handleBodyJsonChange(e.target.value)}
                                    className={`w-full px-3 py-2 text-xs font-mono bg-surface/50 border rounded-md focus:outline-none resize-y min-h-[120px] ${jsonError ? 'border-red-500/50' : 'border-border-subtle focus:border-accent'
                                        }`}
                                    placeholder={defaults.bodyTemplate ? JSON.stringify(defaults.bodyTemplate, null, 2) : '{ ... }'}
                                />
                                {jsonError && (
                                    <div className="absolute bottom-2 left-2 right-2 px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="truncate">{jsonError}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-text-muted space-y-1">
                                <p>{language === 'zh' ? '此模板用于结构性配置，核心字段和 LLM 参数由系统自动填充：' : 'This template is for structural config. Core fields and LLM params are auto-filled:'}</p>
                                <div className="pl-1 space-y-0.5">
                                    <p>{language === 'zh' ? '• 自动填充：model, messages, tools, max_tokens, temperature, top_p' : '• Auto-filled: model, messages, tools, max_tokens, temperature, top_p'}</p>
                                    <p>{language === 'zh' ? '• 可配置：stream, tool_choice, 厂商特定参数等' : '• Configurable: stream, tool_choice, vendor-specific params'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Response Config */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => setShowResponse(!showResponse)}
                    className="flex items-center gap-2 text-xs font-medium text-text-primary mb-2 hover:text-accent transition-colors"
                >
                    {showResponse ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <FileJson className="w-3.5 h-3.5" />
                    {language === 'zh' ? '响应解析' : 'Response Parsing'}
                    {overrides?.response && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>

                {showResponse && (
                    <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-border-subtle ml-1.5">
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Content Field</label>
                            <Input
                                value={overrides?.response?.contentField ?? defaults.contentField}
                                onChange={(e) => updateResponse({ contentField: e.target.value || undefined })}
                                placeholder={defaults.contentField}
                                className="h-8 text-xs font-mono"
                            />
                            <p className="text-[9px] text-text-muted">{language === 'zh' ? '相对于 choices[0] 的路径' : 'Path relative to choices[0]'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Reasoning Field</label>
                            <Input
                                value={overrides?.response?.reasoningField ?? defaults.reasoningField}
                                onChange={(e) => updateResponse({ reasoningField: e.target.value || undefined })}
                                placeholder={defaults.reasoningField || 'delta.reasoning_content'}
                                className="h-8 text-xs font-mono"
                            />
                            <p className="text-[9px] text-text-muted">{language === 'zh' ? '思考/推理字段（可选）' : 'Reasoning field (optional)'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Tool Calls Field</label>
                            <Input
                                value={overrides?.response?.toolCallField ?? defaults.toolCallField}
                                onChange={(e) => updateResponse({ toolCallField: e.target.value || undefined })}
                                placeholder={defaults.toolCallField}
                                className="h-8 text-xs font-mono"
                            />
                            <p className="text-[9px] text-text-muted">{language === 'zh' ? '工具调用数组' : 'Tool calls array'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Done Marker</label>
                            <Input
                                value={overrides?.response?.doneMarker ?? defaults.doneMarker}
                                onChange={(e) => updateResponse({ doneMarker: e.target.value || undefined })}
                                placeholder={defaults.doneMarker}
                                className="h-8 text-xs font-mono"
                            />
                            <p className="text-[9px] text-text-muted">{language === 'zh' ? 'SSE 结束标记' : 'SSE end marker'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Tool Name Path</label>
                            <Input
                                value={overrides?.response?.toolNamePath ?? defaults.toolNamePath}
                                onChange={(e) => updateResponse({ toolNamePath: e.target.value || undefined })}
                                placeholder={defaults.toolNamePath}
                                className="h-8 text-xs font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Tool Args Path</label>
                            <Input
                                value={overrides?.response?.toolArgsPath ?? defaults.toolArgsPath}
                                onChange={(e) => updateResponse({ toolArgsPath: e.target.value || undefined })}
                                placeholder={defaults.toolArgsPath}
                                className="h-8 text-xs font-mono"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="flex items-center gap-2 text-[10px] text-text-secondary">
                                <input
                                    type="checkbox"
                                    checked={overrides?.response?.argsIsObject ?? defaults.argsIsObject}
                                    onChange={(e) => updateResponse({ argsIsObject: e.target.checked })}
                                    className="w-3 h-3"
                                />
                                Args Is Object
                                <span className="text-text-muted">({language === 'zh' ? '参数已是对象而非 JSON 字符串' : 'Args is object, not JSON string'})</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
