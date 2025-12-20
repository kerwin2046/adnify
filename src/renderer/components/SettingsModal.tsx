/**
 * 增强版设置模态框
 * 支持多 Provider、自定义模型、编辑器设置等
 */

import React, { useState, useEffect } from 'react'
import {
  Cpu, Check, Eye, EyeOff,
  AlertTriangle, Settings2, Code, Keyboard, Plus, Trash, HardDrive,
  Monitor, Shield, Terminal, Sparkles, Layout, Type, Database
} from 'lucide-react'
import { useStore, LLMConfig, AutoApproveSettings } from '../store'
import { t, Language } from '../i18n'
import { BUILTIN_PROVIDERS, BuiltinProviderName, ProviderModelConfig } from '../types/provider'
import { getEditorConfig, saveEditorConfig, EditorConfig } from '../config/editorConfig'
import { themes } from './ThemeManager'
import { toast } from './ToastProvider'
import { getPromptTemplates } from '../agent/promptTemplates'
import { completionService } from '../services/completionService'
import KeybindingPanel from './KeybindingPanel'
import { Button, Input, Modal, Select, Switch } from './ui'

type SettingsTab = 'provider' | 'editor' | 'agent' | 'keybindings' | 'indexing' | 'security' | 'system'

const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
]

export default function SettingsModal() {
  const {
    llmConfig, setLLMConfig, setShowSettings, language, setLanguage,
    autoApprove, setAutoApprove, providerConfigs, setProviderConfig,
    promptTemplateId, setPromptTemplateId, agentConfig, setAgentConfig
  } = useStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider')
  const [showApiKey, setShowApiKey] = useState(false)
  const [localConfig, setLocalConfig] = useState(llmConfig)
  const [localLanguage, setLocalLanguage] = useState(language)
  const [localAutoApprove, setLocalAutoApprove] = useState(autoApprove)
  const [localPromptTemplateId, setLocalPromptTemplateId] = useState(promptTemplateId)
  const [localAgentConfig, setLocalAgentConfig] = useState(agentConfig)
  const [saved, setSaved] = useState(false)


  // 编辑器设置 - 使用集中配置
  const [editorConfig] = useState<EditorConfig>(getEditorConfig())

  // 兼容旧的 editorSettings 格式
  const [editorSettings, setEditorSettings] = useState({
    fontSize: editorConfig.fontSize,
    tabSize: editorConfig.tabSize,
    wordWrap: editorConfig.wordWrap,
    lineNumbers: 'on' as 'on' | 'off' | 'relative',
    minimap: editorConfig.minimap,
    bracketPairColorization: true,
    formatOnSave: true,
    autoSave: 'off' as 'off' | 'afterDelay' | 'onFocusChange',
    theme: 'vs-dark',
    // AI 代码补全设置
    completionEnabled: editorConfig.ai.completionEnabled,
    completionDebounceMs: editorConfig.performance.completionDebounceMs,
    completionMaxTokens: editorConfig.ai.completionMaxTokens,
  })

  // AI 指令
  const [aiInstructions, setAiInstructions] = useState('')

  useEffect(() => {
    setLocalConfig(llmConfig)
    setLocalLanguage(language)
    setLocalAutoApprove(autoApprove)
    setLocalPromptTemplateId(promptTemplateId)
    // 加载设置
    // 注意：不再加载 editorSettings，完全依赖 editorConfig
    window.electronAPI.getSetting('aiInstructions').then(s => {
      if (s) setAiInstructions(s as string)
    })
    window.electronAPI.getSetting('providerConfigs').then(s => {
      if (s) {
        Object.entries(s as Record<string, ProviderModelConfig>).forEach(([id, config]) => {
          setProviderConfig(id, config)
        })
      }
    })
  }, [llmConfig, language, autoApprove, promptTemplateId]) // 注意：这里不依赖 setProviderConfig 以避免循环，虽然它通常是稳定的

  const handleSave = async () => {
    setLLMConfig(localConfig)
    setLanguage(localLanguage)
    setAutoApprove(localAutoApprove)
    setPromptTemplateId(localPromptTemplateId)
    await window.electronAPI.setSetting('llmConfig', localConfig)
    await window.electronAPI.setSetting('language', localLanguage)
    await window.electronAPI.setSetting('autoApprove', localAutoApprove)
    await window.electronAPI.setSetting('promptTemplateId', localPromptTemplateId)
    await window.electronAPI.setSetting('editorSettings', editorSettings)
    await window.electronAPI.setSetting('aiInstructions', aiInstructions)
    // 保存 Agent 配置
    setAgentConfig(localAgentConfig)
    await window.electronAPI.setSetting('agentConfig', localAgentConfig)
    // 保存 providerConfigs (它在 Store 中已经是新的了，因为我们直接修改了 store)
    // 但实际上我们在 ProviderSettings 组件中修改了 store 吗？
    // 是的，我们将把 addModel/removeModel 传递给子组件，它们会直接修改 Store。
    // 所以这里我们需要把 Store 中的 providerConfigs 保存到后端。
    await window.electronAPI.setSetting('providerConfigs', providerConfigs)

    // 保存编辑器配置（localStorage + 文件双重存储）
    saveEditorConfig({
      fontSize: editorSettings.fontSize,
      tabSize: editorSettings.tabSize,
      wordWrap: editorSettings.wordWrap,
      minimap: editorSettings.minimap,
      performance: {
        ...editorConfig.performance,
        completionDebounceMs: editorSettings.completionDebounceMs,
      },
      ai: {
        ...editorConfig.ai,
        completionEnabled: editorSettings.completionEnabled,
        completionMaxTokens: editorSettings.completionMaxTokens,
      },
    })

    // 立即应用补全设置
    completionService.configure({
      enabled: editorSettings.completionEnabled,
      debounceMs: editorSettings.completionDebounceMs,
      maxTokens: editorSettings.completionMaxTokens,
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 计算当前的 PROVIDERS 列表
  const currentProviders = [
    ...Object.values(BUILTIN_PROVIDERS).map(p => ({
      id: p.name,
      name: p.displayName,
      models: [...p.defaultModels, ...(providerConfigs[p.name]?.customModels || [])]
    })),
    {
      id: 'custom',
      name: 'Custom',
      models: providerConfigs['custom']?.customModels || []
    }
  ]

  const selectedProvider = currentProviders.find(p => p.id === localConfig.provider)

  const tabs = [
    { id: 'provider' as const, label: localLanguage === 'zh' ? 'AI 模型' : 'AI Models', icon: Cpu, description: 'Configure LLM providers and models' },
    { id: 'editor' as const, label: localLanguage === 'zh' ? '编辑器' : 'Editor', icon: Code, description: 'Customize editor appearance and behavior' },
    { id: 'agent' as const, label: localLanguage === 'zh' ? 'Agent' : 'Agent', icon: Sparkles, description: 'Set up AI agent capabilities' },
    { id: 'keybindings' as const, label: localLanguage === 'zh' ? '快捷键' : 'Keybindings', icon: Keyboard, description: 'View and manage keyboard shortcuts' },
    { id: 'indexing' as const, label: localLanguage === 'zh' ? '索引' : 'Indexing', icon: Database, description: 'Configure codebase indexing' },
    { id: 'security' as const, label: localLanguage === 'zh' ? '安全' : 'Security', icon: Shield, description: 'Manage permissions and security settings' },
    { id: 'system' as const, label: localLanguage === 'zh' ? '系统' : 'System', icon: HardDrive, description: 'System preferences and storage' },
  ]

  return (
    <Modal isOpen={true} onClose={() => setShowSettings(false)} title="" size="4xl">
      <div className="flex h-[750px] -m-6 bg-background rounded-xl overflow-hidden border border-white/5 shadow-2xl">
        {/* Sidebar */}
        <div className="w-64 bg-surface/50 backdrop-blur-md border-r border-white/5 flex flex-col">
          {/* Header */}
          <div className="px-6 py-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              {localLanguage === 'zh' ? '设置' : 'Settings'}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Configure your environment
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${activeTab === tab.id
                  ? 'bg-accent/10 text-accent shadow-[0_0_20px_rgba(var(--accent),0.1)] border border-accent/20'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary border border-transparent'
                  }`}
              >
                <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
                <div className="flex flex-col items-start">
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer: Language */}
          <div className="p-4 border-t border-white/5 bg-surface/30">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Monitor className="w-3.5 h-3.5 text-text-muted" />
              <label className="text-xs text-text-muted font-medium">
                {localLanguage === 'zh' ? '界面语言' : 'Interface Language'}
              </label>
            </div>
            <Select
              value={localLanguage}
              onChange={(value) => setLocalLanguage(value as Language)}
              options={LANGUAGES.map(lang => ({ value: lang.id, label: lang.name }))}
              className="w-full"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-background/50 relative">
          {/* Content Header */}
          <div className="px-8 py-6 border-b border-white/5 bg-surface/20 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {React.createElement(tabs.find(t => t.id === activeTab)?.icon || Settings2, {
                className: "w-6 h-6 text-accent"
              })}
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {tabs.find(t => t.id === activeTab)?.description}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              {activeTab === 'provider' && (
                <ProviderSettings
                  localConfig={localConfig}
                  setLocalConfig={setLocalConfig}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  selectedProvider={selectedProvider}
                  providers={currentProviders}
                  language={localLanguage}
                />
              )}

              {activeTab === 'editor' && (
                <EditorSettings
                  settings={editorSettings}
                  setSettings={setEditorSettings}
                  language={localLanguage}
                />
              )}

              {activeTab === 'agent' && (
                <AgentSettings
                  autoApprove={localAutoApprove}
                  setAutoApprove={setLocalAutoApprove}
                  aiInstructions={aiInstructions}
                  setAiInstructions={setAiInstructions}
                  promptTemplateId={localPromptTemplateId}
                  setPromptTemplateId={setLocalPromptTemplateId}
                  llmConfig={localConfig}
                  setLLMConfig={setLocalConfig}
                  agentConfig={localAgentConfig}
                  setAgentConfig={setLocalAgentConfig}
                  language={localLanguage}
                />
              )}

              {activeTab === 'keybindings' && (
                <KeybindingPanel />
              )}

              {activeTab === 'indexing' && (
                <IndexSettings language={localLanguage} />
              )}

              {activeTab === 'security' && (
                <SecuritySettings language={localLanguage} />
              )}

              {activeTab === 'system' && (
                <SystemSettings language={localLanguage} />
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-8 py-5 border-t border-white/5 bg-surface/30 backdrop-blur-md flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSettings(false)} className="hover:bg-white/5">
              {t('cancel', localLanguage)}
            </Button>
            <Button
              variant={saved ? 'success' : 'primary'}
              onClick={handleSave}
              leftIcon={saved ? <Check className="w-4 h-4" /> : undefined}
              className="min-w-[100px] shadow-lg shadow-accent/20"
            >
              {saved ? t('saved', localLanguage) : t('saveSettings', localLanguage)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}


// Provider 设置组件
interface ProviderSettingsProps {
  localConfig: LLMConfig
  setLocalConfig: React.Dispatch<React.SetStateAction<LLMConfig>>
  showApiKey: boolean
  setShowApiKey: (show: boolean) => void
  selectedProvider: { id: string; name: string; models: string[] } | undefined
  providers: { id: string; name: string; models: string[] }[]
  language: Language
}

function ProviderSettings({
  localConfig, setLocalConfig, showApiKey, setShowApiKey, selectedProvider, providers, language
}: ProviderSettingsProps) {
  const { addCustomModel, removeCustomModel, providerConfigs } = useStore()
  const [newModelName, setNewModelName] = useState('')

  const handleAddModel = () => {
    if (newModelName.trim()) {
      addCustomModel(localConfig.provider, newModelName.trim())
      setNewModelName('')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Provider Selector */}
      <section>
        <h4 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          {language === 'zh' ? '选择提供商' : 'Select Provider'}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setLocalConfig({ ...localConfig, provider: p.id as any, model: p.models[0] || '' })}
              className={`
                relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200
                ${localConfig.provider === p.id
                  ? 'border-accent bg-accent/10 text-accent shadow-[0_0_15px_rgba(var(--accent),0.15)]'
                  : 'border-white/10 bg-surface/30 text-text-muted hover:bg-surface hover:border-white/20 hover:text-text-primary'
                }
              `}
            >
              <span className="font-medium text-sm">{p.name}</span>
              {localConfig.provider === p.id && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-6 p-6 bg-surface/30 rounded-xl border border-white/5">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '配置' : 'Configuration'}
        </h4>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            {language === 'zh' ? '模型' : 'Model'}
          </label>
          <div className="flex gap-2">
            <Select
              value={localConfig.model}
              onChange={(value) => setLocalConfig({ ...localConfig, model: value })}
              options={selectedProvider?.models.map(m => ({ value: m, label: m })) || []}
              className="flex-1"
            />
          </div>

          {/* Custom Model Management */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex gap-2 items-center">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder={language === 'zh' ? '添加自定义模型...' : 'Add custom model...'}
                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                className="flex-1 h-9 text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddModel}
                disabled={!newModelName.trim()}
                className="h-9 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {providerConfigs[localConfig.provider]?.customModels?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {providerConfigs[localConfig.provider]?.customModels.map((model: string) => (
                  <div key={model} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface rounded-full border border-white/10 text-xs text-text-secondary group hover:border-accent/30 transition-colors">
                    <span>{model}</span>
                    <button
                      onClick={() => removeCustomModel(localConfig.provider, model)}
                      className="text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder={(BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName] as any)?.apiKeyPlaceholder || 'Enter API Key'}
              rightIcon={
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          {localConfig.provider !== 'custom' && localConfig.provider !== 'ollama' && (
            <div className="flex justify-end">
              <a
                href={(BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName] as any)?.apiKeyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:text-accent-hover hover:underline"
              >
                {language === 'zh' ? '获取 API Key →' : 'Get API Key →'}
              </a>
            </div>
          )}
        </div>

        {/* Advanced Options Toggle */}
        <div className="pt-2">
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors select-none">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              {language === 'zh' ? '高级设置 (端点 & 超时)' : 'Advanced Settings (Endpoint & Timeout)'}
            </summary>
            <div className="mt-4 space-y-4 pl-4 border-l border-white/5">
              <div>
                <label className="text-xs text-text-secondary mb-1.5 block">{language === 'zh' ? '自定义端点' : 'Custom Endpoint'}</label>
                <Input
                  value={localConfig.baseUrl || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
                  placeholder="https://api.example.com/v1"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1.5 block">{language === 'zh' ? '请求超时 (秒)' : 'Request Timeout (seconds)'}</label>
                <Input
                  type="number"
                  value={(localConfig.timeout || 120000) / 1000}
                  onChange={(e) => setLocalConfig({ ...localConfig, timeout: (parseInt(e.target.value) || 120) * 1000 })}
                  min={30}
                  max={600}
                  step={30}
                  className="w-32 text-sm"
                />
              </div>
            </div>
          </details>
        </div>
      </section>
    </div>
  )
}


// 编辑器设置组件
interface EditorSettingsState {
  fontSize: number
  tabSize: number
  wordWrap: 'on' | 'off' | 'wordWrapColumn'
  lineNumbers: 'on' | 'off' | 'relative'
  minimap: boolean
  bracketPairColorization: boolean
  formatOnSave: boolean
  autoSave: 'off' | 'afterDelay' | 'onFocusChange'
  theme: string
  // AI 代码补全设置
  completionEnabled: boolean
  completionDebounceMs: number
  completionMaxTokens: number
}

interface EditorSettingsProps {
  settings: EditorSettingsState
  setSettings: (settings: EditorSettingsState) => void
  language: Language
}

function EditorSettings({ settings, setSettings, language }: EditorSettingsProps) {
  // 获取完整配置用于显示高级选项
  const [advancedConfig, setAdvancedConfig] = useState(getEditorConfig())
  const { currentTheme, setTheme } = useStore()
  const allThemes = Object.keys(themes)

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId as any)
    window.electronAPI.setSetting('currentTheme', themeId)
  }



  return (
    <div className="space-y-8 animate-fade-in">
      {/* Theme Section */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Layout className="w-4 h-4" />
          {language === 'zh' ? '外观' : 'Appearance'}
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {allThemes.map(themeId => {
            const themeVars = themes[themeId as keyof typeof themes]
            return (
              <button
                key={themeId}
                onClick={() => handleThemeChange(themeId)}
                className={`relative p-3 rounded-xl border text-left transition-all duration-200 group overflow-hidden ${currentTheme === themeId
                  ? 'border-accent bg-accent/10 shadow-md'
                  : 'border-white/10 bg-surface/30 hover:border-white/20 hover:bg-surface/50'
                  }`}
              >
                <div className="flex gap-1.5 mb-3">
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-white/10" style={{ backgroundColor: `rgb(${themeVars['--background']})` }} />
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-white/10" style={{ backgroundColor: `rgb(${themeVars['--accent']})` }} />
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-white/10" style={{ backgroundColor: `rgb(${themeVars['--text-primary']})` }} />
                </div>
                <span className="text-xs font-medium capitalize block truncate">{themeId.replace('-', ' ')}</span>
                {currentTheme === themeId && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Typography & Layout */}
      <section className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Type className="w-4 h-4" />
          {language === 'zh' ? '排版与布局' : 'Typography & Layout'}
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '字体大小' : 'Font Size'}</label>
            <Input
              type="number"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
              min={10} max={32}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? 'Tab 大小' : 'Tab Size'}</label>
            <Select
              value={settings.tabSize.toString()}
              onChange={(value) => setSettings({ ...settings, tabSize: parseInt(value) })}
              options={[
                { value: '2', label: '2 Spaces' },
                { value: '4', label: '4 Spaces' },
                { value: '8', label: '8 Spaces' },
              ]}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动换行' : 'Word Wrap'}</label>
            <Select
              value={settings.wordWrap}
              onChange={(value) => setSettings({ ...settings, wordWrap: value as any })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
                { value: 'wordWrapColumn', label: 'Column' },
              ]}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '行号' : 'Line Numbers'}</label>
            <Select
              value={settings.lineNumbers}
              onChange={(value) => setSettings({ ...settings, lineNumbers: value as any })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
                { value: 'relative', label: 'Relative' },
              ]}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Features Switches */}
      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-white/5">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '功能特性' : 'Features'}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Switch
            label={language === 'zh' ? '显示小地图' : 'Show Minimap'}
            checked={settings.minimap}
            onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '括号配对着色' : 'Bracket Pair Colorization'}
            checked={settings.bracketPairColorization}
            onChange={(e) => setSettings({ ...settings, bracketPairColorization: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '保存时格式化' : 'Format on Save'}
            checked={settings.formatOnSave}
            onChange={(e) => setSettings({ ...settings, formatOnSave: e.target.checked })}
          />
        </div>
        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动保存' : 'Auto Save'}</label>
            <Select
              value={settings.autoSave}
              onChange={(value) => setSettings({ ...settings, autoSave: value as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'afterDelay', label: 'After Delay' },
                { value: 'onFocusChange', label: 'On Focus Change' },
              ]}
              className="w-48"
            />
          </div>
        </div>
      </section>

      {/* AI Completion */}
      <section className="space-y-4 p-5 bg-gradient-to-br from-accent/5 to-transparent rounded-xl border border-accent/10">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium text-accent uppercase tracking-wider text-xs">
            <Sparkles className="w-4 h-4" />
            {language === 'zh' ? 'AI 代码补全' : 'AI Code Completion'}
          </h4>
          <Switch
            checked={settings.completionEnabled}
            onChange={(e) => setSettings({ ...settings, completionEnabled: e.target.checked })}
          />
        </div>

        {settings.completionEnabled && (
          <div className="grid grid-cols-2 gap-6 pt-2 animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '触发延迟 (ms)' : 'Trigger Delay (ms)'}</label>
              <Input
                type="number"
                value={settings.completionDebounceMs}
                onChange={(e) => setSettings({ ...settings, completionDebounceMs: parseInt(e.target.value) || 150 })}
                min={50} max={1000} step={50}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '最大 Token 数' : 'Max Tokens'}</label>
              <Input
                type="number"
                value={settings.completionMaxTokens}
                onChange={(e) => setSettings({ ...settings, completionMaxTokens: parseInt(e.target.value) || 256 })}
                min={64} max={1024} step={64}
              />
            </div>
          </div>
        )}
      </section>

      {/* Terminal Settings */}
      <section className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Terminal className="w-4 h-4" />
          {language === 'zh' ? '终端' : 'Terminal'}
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端字体大小' : 'Terminal Font Size'}</label>
            <Input
              type="number"
              value={advancedConfig.terminal.fontSize}
              onChange={(e) => {
                const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, fontSize: parseInt(e.target.value) || 13 } }
                setAdvancedConfig(newConfig)
                saveEditorConfig(newConfig)
              }}
              min={10} max={24}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端行高' : 'Terminal Line Height'}</label>
            <Input
              type="number"
              value={advancedConfig.terminal.lineHeight}
              onChange={(e) => {
                const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, lineHeight: parseFloat(e.target.value) || 1.2 } }
                setAdvancedConfig(newConfig)
                saveEditorConfig(newConfig)
              }}
              min={1} max={2} step={0.1}
            />
          </div>
        </div>
        <div className="pt-2">
          <Switch
            label={language === 'zh' ? '光标闪烁' : 'Cursor Blink'}
            checked={advancedConfig.terminal.cursorBlink}
            onChange={(e) => {
              const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, cursorBlink: e.target.checked } }
              setAdvancedConfig(newConfig)
              saveEditorConfig(newConfig)
            }}
          />
        </div>
      </section>
    </div>
  )
}

// Agent 设置组件
interface AgentSettingsProps {
  autoApprove: AutoApproveSettings
  setAutoApprove: (value: AutoApproveSettings) => void
  aiInstructions: string
  setAiInstructions: (value: string) => void
  promptTemplateId: string
  setPromptTemplateId: (value: string) => void
  llmConfig: LLMConfig
  setLLMConfig: React.Dispatch<React.SetStateAction<LLMConfig>>
  agentConfig: import('../store/slices/settingsSlice').AgentConfig
  setAgentConfig: React.Dispatch<React.SetStateAction<import('../store/slices/settingsSlice').AgentConfig>>
  language: Language
}

function AgentSettings({
  autoApprove, setAutoApprove, aiInstructions, setAiInstructions, promptTemplateId, setPromptTemplateId, llmConfig, setLLMConfig, agentConfig, setAgentConfig, language
}: AgentSettingsProps) {
  const templates = getPromptTemplates()

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-white/5">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '自动化权限' : 'Automation Permissions'}
        </h4>
        <div className="space-y-4">
          <Switch
            label={language === 'zh' ? '自动批准终端命令' : 'Auto-approve terminal commands'}
            checked={autoApprove.terminal}
            onChange={(e) => setAutoApprove({ ...autoApprove, terminal: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '自动批准危险操作 (删除文件等)' : 'Auto-approve dangerous operations'}
            checked={autoApprove.dangerous}
            onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })}
          />
          <p className="text-xs text-text-muted pl-1">
            {language === 'zh'
              ? '开启后，Agent 将无需确认直接执行相应操作。请谨慎使用。'
              : 'When enabled, the Agent will execute operations without confirmation. Use with caution.'}
          </p>
        </div>
      </section>

      {/* Thinking Mode */}
      <section className="space-y-4 p-5 bg-gradient-to-br from-purple-500/5 to-transparent rounded-xl border border-purple-500/10">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium text-purple-400 uppercase tracking-wider text-xs">
            <Sparkles className="w-4 h-4" />
            {language === 'zh' ? 'Thinking 模式' : 'Thinking Mode'}
          </h4>
          <Switch
            checked={llmConfig.thinkingEnabled || false}
            onChange={(e) => setLLMConfig({ ...llmConfig, thinkingEnabled: e.target.checked })}
          />
        </div>
        <p className="text-xs text-text-muted">
          {language === 'zh'
            ? '启用后，AI 将在回答前进行深度思考。适用于复杂问题和代码审查。支持 Claude、DeepSeek R1、Gemini 2.0。'
            : 'When enabled, AI will think deeply before responding. Best for complex problems and code review. Supports Claude, DeepSeek R1, Gemini 2.0.'}
        </p>
        {llmConfig.thinkingEnabled && (
          <div className="pt-2 animate-fade-in">
            <label className="text-sm font-medium text-text-primary block mb-2">
              {language === 'zh' ? 'Thinking Token 预算' : 'Thinking Token Budget'}
            </label>
            <Input
              type="number"
              value={llmConfig.thinkingBudget || 16000}
              onChange={(e) => setLLMConfig({ ...llmConfig, thinkingBudget: parseInt(e.target.value) || 16000 })}
              min={4000}
              max={64000}
              step={4000}
              className="w-40"
            />
            <p className="text-xs text-text-muted mt-1">
              {language === 'zh' ? '建议 8000-32000' : 'Recommended 8000-32000'}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? 'Prompt 模板' : 'Prompt Template'}
        </h4>
        <Select
          value={promptTemplateId}
          onChange={(value) => setPromptTemplateId(value)}
          options={templates.map(t => ({ value: t.id, label: t.name }))}
          className="w-full"
        />
        <p className="text-xs text-text-muted bg-surface/50 p-3 rounded-lg border border-white/5">
          {templates.find(t => t.id === promptTemplateId)?.description}
        </p>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '自定义系统指令' : 'Custom System Instructions'}
        </h4>
        <textarea
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder={language === 'zh'
            ? '在此输入全局系统指令，例如："总是使用中文回答"、"代码风格偏好..."'
            : 'Enter global system instructions here, e.g., "Always answer in English", "Code style preferences..."'}
          className="w-full h-40 bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-none transition-all placeholder:text-text-muted/50"
        />
        <p className="text-xs text-text-muted">
          {language === 'zh'
            ? '这些指令将附加到 System Prompt 中，影响所有 AI 回复'
            : 'These instructions will be appended to the System Prompt and affect all AI responses'}
        </p>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '高级配置' : 'Advanced Configuration'}
        </h4>
        <div className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '最大工具循环' : 'Max Tool Loops'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxToolLoops}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxToolLoops: parseInt(e.target.value) || 25 })}
                min={5}
                max={100}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '单次对话最大工具调用次数 (5-100)' : 'Max tool calls per conversation (5-100)'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '最大历史消息' : 'Max History Messages'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxHistoryMessages}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxHistoryMessages: parseInt(e.target.value) || 50 })}
                min={10}
                max={200}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '保留的历史消息数量 (10-200)' : 'Number of messages to retain (10-200)'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '工具结果字符限制' : 'Tool Result Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxToolResultChars}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxToolResultChars: parseInt(e.target.value) || 50000 })}
                min={10000}
                max={200000}
                step={10000}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '单个工具结果最大字符数' : 'Max chars per tool result'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '上下文字符限制' : 'Context Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxTotalContextChars}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxTotalContextChars: parseInt(e.target.value) || 100000 })}
                min={50000}
                max={500000}
                step={10000}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '总上下文最大字符数' : 'Max total context chars'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// 安全设置组件
function SecuritySettings({ language }: { language: Language }) {
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(getEditorConfig())
  const { securitySettings, setSecuritySettings } = useStore()
  const [newIgnoredDir, setNewIgnoredDir] = useState('')

  const handleAddIgnoredDir = () => {
    if (newIgnoredDir.trim() && !editorConfig.ignoredDirectories.includes(newIgnoredDir.trim())) {
      const newDirs = [...editorConfig.ignoredDirectories, newIgnoredDir.trim()]
      const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
      setEditorConfig(newConfig)
      saveEditorConfig(newConfig)
      setNewIgnoredDir('')
    }
  }

  const handleRemoveIgnoredDir = (dir: string) => {
    const newDirs = editorConfig.ignoredDirectories.filter(d => d !== dir)
    const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
    setEditorConfig(newConfig)
    saveEditorConfig(newConfig)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-yellow-500 mb-1">
            {language === 'zh' ? '安全沙箱 (开发中)' : 'Security Sandbox (WIP)'}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed opacity-80">
            {language === 'zh'
              ? 'Adnify 目前直接在您的系统上运行命令。请确保您只运行受信任的代码。未来版本将引入基于 Docker 的沙箱环境。'
              : 'Adnify currently runs commands directly on your system. Ensure you only run trusted code. Future versions will introduce a Docker-based sandbox.'}
          </p>
        </div>
      </div>

      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-white/5">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '安全选项' : 'Security Options'}
        </h4>
        <div className="space-y-4">
          <Switch
            label={language === 'zh' ? '启用操作确认' : 'Enable permission confirmation'}
            checked={securitySettings.enablePermissionConfirm}
            onChange={(e) => setSecuritySettings({ enablePermissionConfirm: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '启用审计日志' : 'Enable audit log'}
            checked={securitySettings.enableAuditLog}
            onChange={(e) => setSecuritySettings({ enableAuditLog: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '严格工作区模式' : 'Strict workspace mode'}
            checked={securitySettings.strictWorkspaceMode}
            onChange={(e) => setSecuritySettings({ strictWorkspaceMode: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '显示安全警告' : 'Show security warnings'}
            checked={securitySettings.showSecurityWarnings}
            onChange={(e) => setSecuritySettings({ showSecurityWarnings: e.target.checked })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '忽略的目录' : 'Ignored Directories'}
        </h4>
        <p className="text-xs text-text-muted mb-3">
          {language === 'zh'
            ? '这些目录将被文件索引和 AI 分析忽略'
            : 'These directories will be ignored by file indexing and AI analysis'}
        </p>

        <div className="flex gap-2 mb-3">
          <Input
            value={newIgnoredDir}
            onChange={(e) => setNewIgnoredDir(e.target.value)}
            placeholder={language === 'zh' ? '输入目录名称 (例如: node_modules)' : 'Enter directory name (e.g., node_modules)'}
            onKeyDown={(e) => e.key === 'Enter' && handleAddIgnoredDir()}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={handleAddIgnoredDir}
            disabled={!newIgnoredDir.trim()}
            className="px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 p-4 bg-surface/30 rounded-xl border border-white/5 min-h-[100px]">
          {editorConfig.ignoredDirectories.map(dir => (
            <div key={dir} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-lg border border-white/10 text-xs text-text-secondary group hover:border-red-500/30 transition-colors">
              <span className="font-mono">{dir}</span>
              <button
                onClick={() => handleRemoveIgnoredDir(dir)}
                className="text-text-muted hover:text-red-400 transition-colors"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// 索引设置组件
function IndexSettings({ language }: { language: Language }) {
  const { workspacePath } = useStore()
  const [embeddingProvider, setEmbeddingProvider] = useState('jina')
  const [embeddingApiKey, setEmbeddingApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ totalFiles: number; indexedFiles: number; isIndexing: boolean } | null>(null)

  const EMBEDDING_PROVIDERS = [
    { id: 'jina', name: 'Jina AI', description: language === 'zh' ? '免费 100万 tokens/月，专为代码优化' : 'Free 100M tokens/month, optimized for code' },
    { id: 'voyage', name: 'Voyage AI', description: language === 'zh' ? '免费 5000万 tokens，代码专用模型' : 'Free 50M tokens, code-specific model' },
    { id: 'cohere', name: 'Cohere', description: language === 'zh' ? '免费 100次/分钟' : 'Free 100 calls/min' },
    { id: 'huggingface', name: 'HuggingFace', description: language === 'zh' ? '免费，有速率限制' : 'Free with rate limits' },
    { id: 'ollama', name: 'Ollama', description: language === 'zh' ? '本地运行，完全免费' : 'Local, completely free' },
    { id: 'openai', name: 'OpenAI', description: language === 'zh' ? '付费，质量最高' : 'Paid, highest quality' },
  ]

  // 加载保存的配置
  useEffect(() => {
    window.electronAPI.getSetting('embeddingConfig').then(config => {
      if (config) {
        const cfg = config as { provider?: string; apiKey?: string }
        if (cfg.provider) setEmbeddingProvider(cfg.provider)
        if (cfg.apiKey) setEmbeddingApiKey(cfg.apiKey)
      }
    })
  }, [])

  // 检查索引状态
  useEffect(() => {
    if (workspacePath) {
      window.electronAPI.indexStatus?.(workspacePath).then(status => {
        setIndexStatus(status)
      }).catch(() => { })
    }
  }, [workspacePath])

  const handleSaveEmbeddingConfig = async () => {
    await window.electronAPI.setSetting('embeddingConfig', {
      provider: embeddingProvider,
      apiKey: embeddingApiKey,
    })

    // 更新后端配置
    if (workspacePath) {
      await window.electronAPI.indexUpdateEmbeddingConfig?.(workspacePath, {
        provider: embeddingProvider as 'jina' | 'voyage' | 'openai' | 'cohere' | 'huggingface' | 'ollama',
        apiKey: embeddingApiKey,
      })
    }

    toast.success(language === 'zh' ? '索引配置已保存' : 'Indexing configuration saved')
  }

  const handleStartIndexing = async () => {
    if (!workspacePath) {
      toast.error(language === 'zh' ? '请先打开一个工作区' : 'Please open a workspace first')
      return
    }

    setIsIndexing(true)
    try {
      // 先保存配置
      await handleSaveEmbeddingConfig()

      // 开始索引
      await window.electronAPI.indexStart(workspacePath)
      toast.success(language === 'zh' ? '索引已开始，后台运行中...' : 'Indexing started, running in background...')
    } catch (error) {
      console.error('[IndexSettings] Start indexing failed:', error)
      toast.error(language === 'zh' ? '启动索引失败' : 'Failed to start indexing')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleClearIndex = async () => {
    if (!workspacePath) return

    try {
      await window.electronAPI.indexClear?.(workspacePath)
      toast.success(language === 'zh' ? '索引已清除' : 'Index cleared')
      setIndexStatus(null)
    } catch (error) {
      toast.error(language === 'zh' ? '清除索引失败' : 'Failed to clear index')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? 'Embedding 提供商' : 'Embedding Provider'}
        </h4>
        <div className="space-y-4">
          <div className="p-5 bg-surface/30 rounded-xl border border-white/5 space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '选择提供商' : 'Select Provider'}
              </label>
              <Select
                value={embeddingProvider}
                onChange={(value) => setEmbeddingProvider(value)}
                options={EMBEDDING_PROVIDERS.map(p => ({ value: p.id, label: `${p.name} - ${p.description}` }))}
              />
            </div>

            {embeddingProvider !== 'ollama' && (
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">
                  API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={embeddingApiKey}
                    onChange={(e) => setEmbeddingApiKey(e.target.value)}
                    placeholder={language === 'zh' ? '输入 API Key' : 'Enter API Key'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button variant="secondary" size="sm" onClick={handleSaveEmbeddingConfig}>
              {language === 'zh' ? '保存配置' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '代码库索引' : 'Codebase Index'}
        </h4>
        <div className="space-y-4">
          {indexStatus && (
            <div className="p-4 bg-surface/30 rounded-xl border border-white/5">
              <div className="text-sm text-text-primary">
                {language === 'zh' ? '索引状态' : 'Index Status'}: {indexStatus.isIndexing
                  ? (language === 'zh' ? '索引中...' : 'Indexing...')
                  : (language === 'zh' ? '就绪' : 'Ready')}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '已索引文件' : 'Indexed files'}: {indexStatus.indexedFiles} / {indexStatus.totalFiles}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleStartIndexing}
              disabled={isIndexing || !workspacePath}
              leftIcon={<Database className="w-4 h-4" />}
            >
              {isIndexing
                ? (language === 'zh' ? '索引中...' : 'Indexing...')
                : (language === 'zh' ? '开始索引' : 'Start Indexing')}
            </Button>

            <Button variant="secondary" onClick={handleClearIndex} disabled={!workspacePath}>
              {language === 'zh' ? '清除索引' : 'Clear Index'}
            </Button>
          </div>

          {!workspacePath && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="w-4 h-4" />
              {language === 'zh' ? '请先打开一个工作区才能进行索引' : 'Please open a workspace first to start indexing'}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// 系统设置组件
function SystemSettings({ language }: { language: Language }) {
  const [isClearing, setIsClearing] = useState(false)

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      const keysToRemove = [
        'adnify-editor-config',
        'adnify-workspace',
        'adnify-sessions',
        'adnify-threads',
      ]
      keysToRemove.forEach(key => localStorage.removeItem(key))

      try {
        // @ts-ignore
        await (window.electronAPI as any).clearIndex?.()
      } catch { }

      await window.electronAPI.setSetting('editorConfig', undefined)
      toast.success(language === 'zh' ? '缓存已清除' : 'Cache cleared')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error(language === 'zh' ? '清除缓存失败' : 'Failed to clear cache')
    } finally {
      setIsClearing(false)
    }
  }

  const handleReset = async () => {
    if (confirm(language === 'zh' ? '确定要重置所有设置吗？这将丢失所有自定义配置。' : 'Are you sure you want to reset all settings? This will lose all custom configurations.')) {
      await window.electronAPI.setSetting('llmConfig', undefined)
      await window.electronAPI.setSetting('editorSettings', undefined)
      await window.electronAPI.setSetting('editorConfig', undefined)
      await window.electronAPI.setSetting('autoApprove', undefined)
      await window.electronAPI.setSetting('providerConfigs', undefined)
      await window.electronAPI.setSetting('promptTemplateId', undefined)
      await window.electronAPI.setSetting('aiInstructions', undefined)
      await window.electronAPI.setSetting('currentTheme', undefined)
      localStorage.clear()
      window.location.reload()
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '存储与缓存' : 'Storage & Cache'}
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-5 bg-surface/30 rounded-xl border border-white/5">
            <div>
              <div className="text-sm font-medium text-text-primary">{language === 'zh' ? '清除缓存' : 'Clear Cache'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '清除编辑器缓存、索引数据和临时文件' : 'Clear editor cache, index data, and temporary files'}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? (language === 'zh' ? '清除中...' : 'Clearing...') : (language === 'zh' ? '清除' : 'Clear')}
            </Button>
          </div>

          <div className="flex items-center justify-between p-5 bg-red-500/5 rounded-xl border border-red-500/10">
            <div>
              <div className="text-sm font-medium text-red-400">{language === 'zh' ? '重置所有设置' : 'Reset All Settings'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '恢复出厂设置，不可撤销' : 'Restore factory settings, irreversible'}</div>
            </div>
            <Button variant="danger" size="sm" onClick={handleReset}>
              {language === 'zh' ? '重置' : 'Reset'}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '关于' : 'About'}
        </h4>
        <div className="p-8 bg-surface/30 rounded-xl border border-white/5 text-center">
          <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-6 h-6 text-accent" />
          </div>
          <div className="text-xl font-bold text-text-primary mb-1">Adnify</div>
          <div className="text-xs text-text-muted font-mono mb-6">v0.1.0-alpha</div>
          <div className="text-xs text-text-secondary">
            Built with Electron, React, Monaco Editor & Tailwind CSS
          </div>
        </div>
      </section>
    </div>
  )
}
