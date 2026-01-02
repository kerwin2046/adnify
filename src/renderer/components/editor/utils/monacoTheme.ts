/**
 * Monaco 主题定义
 */

import type { ThemeName } from '@store/slices/themeSlice'
import { themes } from '../ThemeManager'

// RGB 字符串转 Hex
const rgbToHex = (rgbStr: string) => {
  const parts = rgbStr.split(' ').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return '#000000'
  const [r, g, b] = parts
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * 定义 Monaco 主题
 */
export function defineMonacoTheme(monacoInstance: typeof import('monaco-editor'), themeName: ThemeName) {
  const themeVars = themes[themeName] || themes['adnify-dark']
  if (!themeVars) return

  const bg = rgbToHex(themeVars['--background'])
  const surface = rgbToHex(themeVars['--surface'])
  const text = rgbToHex(themeVars['--text-primary'])
  const textMuted = rgbToHex(themeVars['--text-muted'])
  const border = rgbToHex(themeVars['--border'])
  const accent = rgbToHex(themeVars['--accent'])
  const selection = accent + '40'

  monacoInstance.editor.defineTheme('adnify-dynamic', {
    base: themeName === 'dawn' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: textMuted.slice(1), fontStyle: 'italic' },
      { token: 'keyword', foreground: accent.slice(1) },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: 'ffc600' },
      { token: 'type', foreground: '4ec9b0' },
    ],
    colors: {
      'editor.background': bg,
      'editor.foreground': text,
      'editor.lineHighlightBackground': surface,
      'editorCursor.foreground': accent,
      'editorWhitespace.foreground': border,
      'editorIndentGuide.background': border,
      'editor.selectionBackground': selection,
      'editorLineNumber.foreground': textMuted,
      'editorLineNumber.activeForeground': text,
      'editorWidget.background': surface,
      'editorWidget.border': border,
      'editorSuggestWidget.background': surface,
      'editorSuggestWidget.border': border,
      'editorSuggestWidget.selectedBackground': accent + '20',
      'editorHoverWidget.background': surface,
      'editorHoverWidget.border': border,
    }
  })
}
