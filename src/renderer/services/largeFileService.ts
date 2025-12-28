/**
 * 大文件处理服务
 * 提供大文件的分块加载、虚拟滚动支持
 */

import { getEditorConfig } from '@renderer/config/editorConfig'

// 文件大小阈值（字节）- 从配置获取
function getLargeFileThreshold(): number {
  const config = getEditorConfig()
  return (config.performance.largeFileWarningThresholdMB || 5) * 1024 * 1024
}

const CHUNK_SIZE = 64 * 1024 // 64KB per chunk

export interface FileChunk {
  startLine: number
  endLine: number
  content: string
  startOffset: number
  endOffset: number
}

export interface LargeFileInfo {
  path: string
  size: number
  lineCount: number
  isLarge: boolean
  isVeryLarge: boolean
  chunks?: FileChunk[]
}

/**
 * 检查文件是否为大文件
 */
export function isLargeFile(content: string): boolean {
  const threshold = getLargeFileThreshold()
  return content.length > threshold * 0.2 // 20% of threshold as "large"
}

/**
 * 检查文件是否为超大文件
 */
export function isVeryLargeFile(content: string): boolean {
  const threshold = getLargeFileThreshold()
  return content.length > threshold
}

/**
 * 获取文件信息
 */
export function getFileInfo(path: string, content: string): LargeFileInfo {
  const size = content.length
  const lineCount = content.split('\n').length
  const threshold = getLargeFileThreshold()
  
  return {
    path,
    size,
    lineCount,
    isLarge: size > threshold * 0.2,
    isVeryLarge: size > threshold,
  }
}

/**
 * 将大文件分块
 */
export function chunkFile(content: string): FileChunk[] {
  const chunks: FileChunk[] = []
  const lines = content.split('\n')
  
  let currentChunk: string[] = []
  let currentSize = 0
  let startLine = 0
  let startOffset = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineSize = line.length + 1 // +1 for newline
    
    if (currentSize + lineSize > CHUNK_SIZE && currentChunk.length > 0) {
      // 保存当前块
      const chunkContent = currentChunk.join('\n')
      chunks.push({
        startLine,
        endLine: i - 1,
        content: chunkContent,
        startOffset,
        endOffset: startOffset + chunkContent.length,
      })
      
      // 开始新块
      startLine = i
      startOffset += chunkContent.length + 1
      currentChunk = [line]
      currentSize = lineSize
    } else {
      currentChunk.push(line)
      currentSize += lineSize
    }
  }
  
  // 保存最后一块
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n')
    chunks.push({
      startLine,
      endLine: lines.length - 1,
      content: chunkContent,
      startOffset,
      endOffset: startOffset + chunkContent.length,
    })
  }
  
  return chunks
}

/**
 * 获取指定行范围的内容
 */
export function getLineRange(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n')
  return lines.slice(startLine, endLine + 1).join('\n')
}

/**
 * 获取指定行周围的上下文
 */
export function getLineContext(
  content: string,
  line: number,
  contextLines: number = 50
): { content: string; startLine: number; endLine: number } {
  const lines = content.split('\n')
  const startLine = Math.max(0, line - contextLines)
  const endLine = Math.min(lines.length - 1, line + contextLines)
  
  return {
    content: lines.slice(startLine, endLine + 1).join('\n'),
    startLine,
    endLine,
  }
}

/**
 * 优化大文件的 Monaco 编辑器选项
 */
export function getLargeFileEditorOptions(fileInfo: LargeFileInfo): Record<string, any> {
  const options: Record<string, any> = {}
  
  if (fileInfo.isLarge) {
    // 禁用一些性能消耗大的功能
    options.minimap = { enabled: false }
    options.folding = false
    options.wordWrap = 'off'
    options.renderWhitespace = 'none'
    options.renderLineHighlight = 'none'
    options.guides = { indentation: false, bracketPairs: false }
    options.matchBrackets = 'never'
    options.occurrencesHighlight = 'off'
    options.selectionHighlight = false
    options.links = false
    options.colorDecorators = false
  }
  
  if (fileInfo.isVeryLarge) {
    // 超大文件额外禁用
    options.lineNumbers = 'off'
    options.glyphMargin = false
    options.lineDecorationsWidth = 0
    options.lineNumbersMinChars = 0
    options.overviewRulerLanes = 0
    options.hideCursorInOverviewRuler = true
    options.overviewRulerBorder = false
    options.scrollbar = {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    }
  }
  
  return options
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 大文件警告消息
 */
export function getLargeFileWarning(fileInfo: LargeFileInfo, language: 'en' | 'zh'): string | null {
  if (!fileInfo.isLarge) return null
  
  const size = formatFileSize(fileInfo.size)
  
  if (fileInfo.isVeryLarge) {
    return language === 'zh'
      ? `此文件较大 (${size})，部分编辑器功能已禁用以提高性能`
      : `This file is large (${size}), some editor features are disabled for performance`
  }
  
  return language === 'zh'
    ? `此文件较大 (${size})，可能影响编辑器性能`
    : `This file is large (${size}), editor performance may be affected`
}
