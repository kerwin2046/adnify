/**
 * 编辑器配置
 * 集中管理所有可配置的参数
 */

export interface EditorConfig {
  // 编辑器外观
  fontSize: number
  fontFamily: string
  tabSize: number
  wordWrap: 'on' | 'off' | 'wordWrapColumn'
  lineHeight: number
  minimap: boolean
  minimapScale: number

  // 终端
  terminal: {
    fontSize: number
    fontFamily: string
    lineHeight: number
    cursorBlink: boolean
    scrollback: number
  }

  // 性能相关
  performance: {
    // 文件扫描
    maxProjectFiles: number // LSP 扫描的最大文件数
    maxFileTreeDepth: number // 文件树最大深度
    
    // 防抖延迟
    fileChangeDebounceMs: number // 文件变化防抖
    completionDebounceMs: number // 代码补全防抖
    searchDebounceMs: number // 搜索防抖
    
    // 刷新间隔
    gitStatusIntervalMs: number // Git 状态刷新间隔
    indexStatusIntervalMs: number // 索引状态刷新间隔
    
    // 超时
    requestTimeoutMs: number // API 请求超时
    commandTimeoutMs: number // 命令执行超时
    
    // 缓冲区大小
    terminalBufferSize: number // 终端输出缓冲区大小
    maxResultLength: number // 结果显示最大长度
  }

  // AI 相关
  ai: {
    maxToolLoops: number // 最大工具调用循环次数
    completionMaxTokens: number // 补全最大 token 数
    completionTemperature: number // 补全温度
    contextMaxChars: number // 上下文最大字符数
  }

  // 忽略的目录
  ignoredDirectories: string[]
}

// 默认配置
export const defaultEditorConfig: EditorConfig = {
  // 编辑器外观
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  tabSize: 2,
  wordWrap: 'on',
  lineHeight: 1.5,
  minimap: true,
  minimapScale: 1,

  // 终端
  terminal: {
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: 1.2,
    cursorBlink: true,
    scrollback: 1000,
  },

  // 性能相关
  performance: {
    maxProjectFiles: 500,
    maxFileTreeDepth: 5,
    fileChangeDebounceMs: 300,
    completionDebounceMs: 300,
    searchDebounceMs: 200,
    gitStatusIntervalMs: 5000,
    indexStatusIntervalMs: 10000,
    requestTimeoutMs: 120000, // 2 分钟
    commandTimeoutMs: 30000, // 30 秒
    terminalBufferSize: 500,
    maxResultLength: 2000,
  },

  // AI 相关
  ai: {
    maxToolLoops: 15,
    completionMaxTokens: 256,
    completionTemperature: 0.1,
    contextMaxChars: 500,
  },

  // 忽略的目录
  ignoredDirectories: [
    'node_modules',
    'dist',
    'build',
    '.git',
    '.next',
    'coverage',
    '__pycache__',
    '.cache',
    'out',
    '.vscode',
    '.idea',
  ],
}

// 配置存储 key
const CONFIG_STORAGE_KEY = 'adnify-editor-config'

/**
 * 获取配置
 */
export function getEditorConfig(): EditorConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 合并默认配置，确保新增的配置项有默认值
      return deepMerge(defaultEditorConfig, parsed)
    }
  } catch (e) {
    console.error('Failed to load editor config:', e)
  }
  return defaultEditorConfig
}

/**
 * 保存配置
 */
export function saveEditorConfig(config: Partial<EditorConfig>): void {
  try {
    const current = getEditorConfig()
    const merged = deepMerge(current, config)
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged))
  } catch (e) {
    console.error('Failed to save editor config:', e)
  }
}

/**
 * 重置配置
 */
export function resetEditorConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY)
}

/**
 * 深度合并对象
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        (result as any)[key] = deepMerge(target[key] as object, source[key] as object)
      } else {
        (result as any)[key] = source[key]
      }
    }
  }
  
  return result
}
