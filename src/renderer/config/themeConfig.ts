/**
 * 主题系统配置
 * 支持内置主题和自定义主题
 */

export interface ThemeColors {
  // 背景色
  background: string
  backgroundSecondary: string
  surface: string
  surfaceHover: string
  surfaceActive: string
  
  // 文字色
  textPrimary: string
  textSecondary: string
  textMuted: string
  
  // 边框色
  borderSubtle: string
  borderStrong: string
  
  // 强调色
  accent: string
  accentHover: string
  accentMuted: string
  
  // 状态色
  statusSuccess: string
  statusWarning: string
  statusError: string
  statusInfo: string
  
  // 编辑器色
  editorBackground: string
  editorLineHighlight: string
  editorSelection: string
  editorCursor: string
}

export interface Theme {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: ThemeColors
  monacoTheme: string // Monaco 编辑器主题名称
}

// 内置主题
export const builtinThemes: Theme[] = [
  {
    id: 'adnify-dark',
    name: 'Adnify Dark',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '#0d0d0f',
      backgroundSecondary: '#111113',
      surface: '#18181b',
      surfaceHover: '#1f1f23',
      surfaceActive: '#27272a',
      textPrimary: '#fafafa',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      borderSubtle: '#27272a',
      borderStrong: '#3f3f46',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      accentMuted: '#8b5cf620',
      statusSuccess: '#22c55e',
      statusWarning: '#f59e0b',
      statusError: '#ef4444',
      statusInfo: '#3b82f6',
      editorBackground: '#0d0d0f',
      editorLineHighlight: '#18181b',
      editorSelection: '#8b5cf640',
      editorCursor: '#8b5cf6',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '#0d1117',
      backgroundSecondary: '#161b22',
      surface: '#21262d',
      surfaceHover: '#30363d',
      surfaceActive: '#484f58',
      textPrimary: '#c9d1d9',
      textSecondary: '#8b949e',
      textMuted: '#6e7681',
      borderSubtle: '#21262d',
      borderStrong: '#30363d',
      accent: '#58a6ff',
      accentHover: '#79c0ff',
      accentMuted: '#58a6ff20',
      statusSuccess: '#3fb950',
      statusWarning: '#d29922',
      statusError: '#f85149',
      statusInfo: '#58a6ff',
      editorBackground: '#0d1117',
      editorLineHighlight: '#161b22',
      editorSelection: '#58a6ff40',
      editorCursor: '#58a6ff',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '#272822',
      backgroundSecondary: '#2d2e27',
      surface: '#3e3d32',
      surfaceHover: '#49483e',
      surfaceActive: '#75715e',
      textPrimary: '#f8f8f2',
      textSecondary: '#cfcfc2',
      textMuted: '#75715e',
      borderSubtle: '#3e3d32',
      borderStrong: '#49483e',
      accent: '#a6e22e',
      accentHover: '#b8f339',
      accentMuted: '#a6e22e20',
      statusSuccess: '#a6e22e',
      statusWarning: '#e6db74',
      statusError: '#f92672',
      statusInfo: '#66d9ef',
      editorBackground: '#272822',
      editorLineHighlight: '#3e3d32',
      editorSelection: '#49483e',
      editorCursor: '#f8f8f0',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '#282c34',
      backgroundSecondary: '#21252b',
      surface: '#2c313a',
      surfaceHover: '#3a3f4b',
      surfaceActive: '#4b5263',
      textPrimary: '#abb2bf',
      textSecondary: '#9da5b4',
      textMuted: '#5c6370',
      borderSubtle: '#181a1f',
      borderStrong: '#3a3f4b',
      accent: '#61afef',
      accentHover: '#74b9f0',
      accentMuted: '#61afef20',
      statusSuccess: '#98c379',
      statusWarning: '#e5c07b',
      statusError: '#e06c75',
      statusInfo: '#61afef',
      editorBackground: '#282c34',
      editorLineHighlight: '#2c313c',
      editorSelection: '#3e4451',
      editorCursor: '#528bff',
    },
  },
  {
    id: 'adnify-light',
    name: 'Adnify Light',
    type: 'light',
    monacoTheme: 'vs',
    colors: {
      background: '#ffffff',
      backgroundSecondary: '#f4f4f5',
      surface: '#e4e4e7',
      surfaceHover: '#d4d4d8',
      surfaceActive: '#a1a1aa',
      textPrimary: '#18181b',
      textSecondary: '#3f3f46',
      textMuted: '#71717a',
      borderSubtle: '#e4e4e7',
      borderStrong: '#d4d4d8',
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      accentMuted: '#7c3aed20',
      statusSuccess: '#16a34a',
      statusWarning: '#d97706',
      statusError: '#dc2626',
      statusInfo: '#2563eb',
      editorBackground: '#ffffff',
      editorLineHighlight: '#f4f4f5',
      editorSelection: '#7c3aed30',
      editorCursor: '#7c3aed',
    },
  },
]

// 主题管理器
class ThemeManager {
  private currentTheme: Theme = builtinThemes[0]
  private customThemes: Theme[] = []
  private listeners: Set<(theme: Theme) => void> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const savedThemeId = localStorage.getItem('adnify-theme')
      const savedCustomThemes = localStorage.getItem('adnify-custom-themes')
      
      if (savedCustomThemes) {
        this.customThemes = JSON.parse(savedCustomThemes)
      }
      
      if (savedThemeId) {
        const theme = this.getThemeById(savedThemeId)
        if (theme) {
          this.currentTheme = theme
        }
      }
    } catch (e) {
      console.error('Failed to load theme from storage:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('adnify-theme', this.currentTheme.id)
      localStorage.setItem('adnify-custom-themes', JSON.stringify(this.customThemes))
    } catch (e) {
      console.error('Failed to save theme to storage:', e)
    }
  }

  getAllThemes(): Theme[] {
    return [...builtinThemes, ...this.customThemes]
  }

  getThemeById(id: string): Theme | undefined {
    return this.getAllThemes().find(t => t.id === id)
  }

  getCurrentTheme(): Theme {
    return this.currentTheme
  }

  setTheme(themeId: string) {
    const theme = this.getThemeById(themeId)
    if (theme) {
      this.currentTheme = theme
      this.applyTheme(theme)
      this.saveToStorage()
      this.notifyListeners()
    }
  }

  addCustomTheme(theme: Theme) {
    // 确保 ID 唯一
    if (this.getThemeById(theme.id)) {
      theme.id = `${theme.id}-${Date.now()}`
    }
    this.customThemes.push(theme)
    this.saveToStorage()
  }

  removeCustomTheme(themeId: string) {
    this.customThemes = this.customThemes.filter(t => t.id !== themeId)
    if (this.currentTheme.id === themeId) {
      this.setTheme('adnify-dark')
    }
    this.saveToStorage()
  }

  applyTheme(theme: Theme) {
    const root = document.documentElement
    const colors = theme.colors

    // 设置 CSS 变量
    root.style.setProperty('--color-background', colors.background)
    root.style.setProperty('--color-background-secondary', colors.backgroundSecondary)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-surface-hover', colors.surfaceHover)
    root.style.setProperty('--color-surface-active', colors.surfaceActive)
    root.style.setProperty('--color-text-primary', colors.textPrimary)
    root.style.setProperty('--color-text-secondary', colors.textSecondary)
    root.style.setProperty('--color-text-muted', colors.textMuted)
    root.style.setProperty('--color-border-subtle', colors.borderSubtle)
    root.style.setProperty('--color-border-strong', colors.borderStrong)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-accent-hover', colors.accentHover)
    root.style.setProperty('--color-accent-muted', colors.accentMuted)
    root.style.setProperty('--color-status-success', colors.statusSuccess)
    root.style.setProperty('--color-status-warning', colors.statusWarning)
    root.style.setProperty('--color-status-error', colors.statusError)
    root.style.setProperty('--color-status-info', colors.statusInfo)

    // 设置主题类型
    root.setAttribute('data-theme', theme.type)
  }

  subscribe(callback: (theme: Theme) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.currentTheme))
  }

  // 初始化时应用当前主题
  init() {
    this.applyTheme(this.currentTheme)
  }
}

export const themeManager = new ThemeManager()
