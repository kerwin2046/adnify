/**
 * Store slices 导出
 */

export { createFileSlice } from './fileSlice'
export type { FileSlice, OpenFile, FileItem } from './fileSlice'

export { createChatSlice } from './chatSlice'
export type { ChatSlice, Message, ToolCall, ContextStats } from './chatSlice'

export { createSettingsSlice } from './settingsSlice'
export type { SettingsSlice, ProviderType, LLMConfig, AutoApproveSettings } from './settingsSlice'

export { createUISlice } from './uiSlice'
export type { UISlice, SidePanel, DiffView } from './uiSlice'
