/**
 * 插件系统
 * 支持扩展侧边栏、命令面板、编辑器功能
 */

import { LucideIcon } from 'lucide-react'

// 插件元数据
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  icon?: string // Lucide icon name
  main?: string // 入口文件
  contributes?: {
    sidebarViews?: SidebarViewContribution[]
    commands?: CommandContribution[]
    menus?: MenuContribution[]
    keybindings?: KeybindingContribution[]
    themes?: ThemeContribution[]
  }
}

export interface SidebarViewContribution {
  id: string
  name: string
  icon: string
  order?: number
}

export interface CommandContribution {
  id: string
  title: string
  category?: string
}

export interface MenuContribution {
  command: string
  group?: string
  when?: string
}

export interface KeybindingContribution {
  command: string
  key: string
  when?: string
}

export interface ThemeContribution {
  id: string
  label: string
  uiTheme: 'dark' | 'light'
  path: string
}

// 插件 API
export interface PluginAPI {
  // 注册侧边栏视图
  registerSidebarView: (view: SidebarView) => void
  // 注册命令
  registerCommand: (id: string, handler: () => void) => void
  // 执行命令
  executeCommand: (id: string, ...args: unknown[]) => void
  // 显示通知
  showNotification: (message: string, type?: 'info' | 'warning' | 'error') => void
  // 获取工作区路径
  getWorkspacePath: () => string | null
  // 读取文件
  readFile: (path: string) => Promise<string | null>
  // 写入文件
  writeFile: (path: string, content: string) => Promise<boolean>
  // 打开文件
  openFile: (path: string) => Promise<void>
  // 获取当前编辑器内容
  getActiveEditorContent: () => string | null
  // 获取当前文件路径
  getActiveFilePath: () => string | null
}

// 侧边栏视图
export interface SidebarView {
  id: string
  name: string
  icon: LucideIcon | string
  order?: number
  component: React.ComponentType<{ api: PluginAPI }>
}

// 插件实例
export interface Plugin {
  manifest: PluginManifest
  activate: (api: PluginAPI) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

// 已加载的插件
interface LoadedPlugin {
  manifest: PluginManifest
  instance?: Plugin
  isActive: boolean
  sidebarViews: SidebarView[]
  commands: Map<string, () => void>
}

// 插件管理器
class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map()
  private sidebarViews: SidebarView[] = []
  private commands: Map<string, () => void> = new Map()
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadBuiltinPlugins()
  }

  private loadBuiltinPlugins() {
    // 内置插件可以在这里注册
  }

  // 创建插件 API
  private createPluginAPI(pluginId: string): PluginAPI {
    const plugin = this.plugins.get(pluginId)
    
    return {
      registerSidebarView: (view: SidebarView) => {
        if (plugin) {
          plugin.sidebarViews.push(view)
          this.sidebarViews.push(view)
          this.notifyListeners()
        }
      },
      registerCommand: (id: string, handler: () => void) => {
        const fullId = `${pluginId}.${id}`
        if (plugin) {
          plugin.commands.set(fullId, handler)
          this.commands.set(fullId, handler)
        }
      },
      executeCommand: (id: string, ...args: unknown[]) => {
        const handler = this.commands.get(id)
        if (handler) {
          handler()
        }
      },
      showNotification: (message: string, type = 'info') => {
        // TODO: 实现通知系统
        console.log(`[${type}] ${message}`)
      },
      getWorkspacePath: () => {
        // 从 store 获取
        return (window as any).__ADNIFY_STORE__?.getState()?.workspacePath || null
      },
      readFile: async (path: string) => {
        return window.electronAPI.readFile(path)
      },
      writeFile: async (path: string, content: string) => {
        return window.electronAPI.writeFile(path, content)
      },
      openFile: async (path: string) => {
        const content = await window.electronAPI.readFile(path)
        if (content !== null) {
          const store = (window as any).__ADNIFY_STORE__?.getState()
          if (store) {
            store.openFile(path, content)
            store.setActiveFile(path)
          }
        }
      },
      getActiveEditorContent: () => {
        const store = (window as any).__ADNIFY_STORE__?.getState()
        if (store) {
          const activeFile = store.openFiles.find((f: any) => f.path === store.activeFilePath)
          return activeFile?.content || null
        }
        return null
      },
      getActiveFilePath: () => {
        return (window as any).__ADNIFY_STORE__?.getState()?.activeFilePath || null
      },
    }
  }

  // 注册插件
  async registerPlugin(plugin: Plugin): Promise<boolean> {
    const { manifest } = plugin
    
    if (this.plugins.has(manifest.id)) {
      console.warn(`Plugin ${manifest.id} is already registered`)
      return false
    }

    const loadedPlugin: LoadedPlugin = {
      manifest,
      instance: plugin,
      isActive: false,
      sidebarViews: [],
      commands: new Map(),
    }

    this.plugins.set(manifest.id, loadedPlugin)
    
    // 自动激活
    await this.activatePlugin(manifest.id)
    
    return true
  }

  // 激活插件
  async activatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.isActive) return false

    try {
      const api = this.createPluginAPI(pluginId)
      if (plugin.instance?.activate) {
        await plugin.instance.activate(api)
      }
      plugin.isActive = true
      this.notifyListeners()
      return true
    } catch (e) {
      console.error(`Failed to activate plugin ${pluginId}:`, e)
      return false
    }
  }

  // 停用插件
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || !plugin.isActive) return false

    try {
      if (plugin.instance?.deactivate) {
        await plugin.instance.deactivate()
      }
      
      // 移除侧边栏视图
      plugin.sidebarViews.forEach(view => {
        const idx = this.sidebarViews.findIndex(v => v.id === view.id)
        if (idx !== -1) this.sidebarViews.splice(idx, 1)
      })
      plugin.sidebarViews = []
      
      // 移除命令
      plugin.commands.forEach((_, key) => {
        this.commands.delete(key)
      })
      plugin.commands.clear()
      
      plugin.isActive = false
      this.notifyListeners()
      return true
    } catch (e) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, e)
      return false
    }
  }

  // 获取所有侧边栏视图
  getSidebarViews(): SidebarView[] {
    return [...this.sidebarViews].sort((a, b) => (a.order || 100) - (b.order || 100))
  }

  // 获取所有已注册的插件
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  // 执行命令
  executeCommand(commandId: string) {
    const handler = this.commands.get(commandId)
    if (handler) {
      handler()
    }
  }

  // 订阅变化
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb())
  }
}

export const pluginManager = new PluginManager()

// 示例：创建一个简单的插件
export function createExamplePlugin(): Plugin {
  return {
    manifest: {
      id: 'example-plugin',
      name: 'Example Plugin',
      version: '1.0.0',
      description: 'An example plugin',
    },
    activate: (api) => {
      api.registerCommand('sayHello', () => {
        api.showNotification('Hello from Example Plugin!')
      })
    },
  }
}
