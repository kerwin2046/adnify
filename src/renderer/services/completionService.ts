/**
 * Code Completion Service
 * Provides AI-powered code completion with debounce and cancellation support
 * Requirements: 1.1, 1.4, 1.5
 */

import { useStore } from '../store'

// ============ Interfaces ============

export interface Position {
  line: number
  column: number
}

export interface CompletionContext {
  filePath: string
  fileContent: string
  cursorPosition: Position
  prefix: string  // Text before cursor
  suffix: string  // Text after cursor
  language: string
  openFiles: Array<{ path: string; content: string }>
  recentFiles?: Array<{ path: string; content: string }>
}

export interface CompletionSuggestion {
  text: string
  displayText: string
  range: { start: number; end: number }
  confidence: number
}

export interface CompletionResult {
  suggestions: CompletionSuggestion[]
  cached: boolean
}

export interface CompletionOptions {
  enabled: boolean
  debounceMs: number
  maxTokens: number
  temperature: number
  triggerCharacters: string[]
}


// Default options
const DEFAULT_OPTIONS: CompletionOptions = {
  enabled: true,
  debounceMs: 150,
  maxTokens: 256,
  temperature: 0.2,
  triggerCharacters: ['.', '(', '{', '[', '"', "'", '/', '@', '#', ' ']
}

// ============ Debounce Utility ============

type DebouncedFunction<T extends (...args: Parameters<T>) => ReturnType<T>> = {
  (...args: Parameters<T>): void
  cancel: () => void
}

function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debouncedFn
}


// ============ Language Detection ============

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java',
  cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', vue: 'html', svelte: 'html',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell',
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return LANGUAGE_MAP[ext] || 'plaintext'
}

// ============ Import Analysis ============

const IMPORT_PATTERNS = [
  /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,  // ES6 import
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,      // Dynamic import
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,     // CommonJS require
]

function analyzeImports(content: string): string[] {
  const imports: Set<string> = new Set()
  
  for (const pattern of IMPORT_PATTERNS) {
    let match
    const regex = new RegExp(pattern.source, pattern.flags)
    while ((match = regex.exec(content)) !== null) {
      const importPath = match[1]
      // Only include relative imports (local files)
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.add(importPath)
      }
    }
  }
  
  return Array.from(imports)
}


// ============ Completion Service Class ============

type CompletionCallback = (result: CompletionResult | null) => void
type ErrorCallback = (error: Error) => void

class CompletionService {
  private options: CompletionOptions = { ...DEFAULT_OPTIONS }
  private currentAbortController: AbortController | null = null
  private debouncedRequest: DebouncedFunction<(ctx: CompletionContext) => void> | null = null
  private onCompletionCallback: CompletionCallback | null = null
  private onErrorCallback: ErrorCallback | null = null
  private recentEditedFiles: Array<{ path: string; timestamp: number }> = []
  private maxRecentFiles = 5

  constructor() {
    this.setupDebouncedRequest()
  }

  private setupDebouncedRequest(): void {
    this.debouncedRequest = debounce(
      (context: CompletionContext) => this.executeRequest(context),
      this.options.debounceMs
    )
  }

  /**
   * Configure completion options
   */
  configure(options: Partial<CompletionOptions>): void {
    this.options = { ...this.options, ...options }
    // Recreate debounced function with new delay
    this.setupDebouncedRequest()
  }

  /**
   * Get current options
   */
  getOptions(): CompletionOptions {
    return { ...this.options }
  }

  /**
   * Set completion callback
   */
  onCompletion(callback: CompletionCallback): void {
    this.onCompletionCallback = callback
  }

  /**
   * Set error callback
   */
  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback
  }


  /**
   * Track recently edited files
   */
  trackFileEdit(filePath: string): void {
    const now = Date.now()
    // Remove if already exists
    this.recentEditedFiles = this.recentEditedFiles.filter(f => f.path !== filePath)
    // Add to front
    this.recentEditedFiles.unshift({ path: filePath, timestamp: now })
    // Keep only maxRecentFiles
    if (this.recentEditedFiles.length > this.maxRecentFiles) {
      this.recentEditedFiles = this.recentEditedFiles.slice(0, this.maxRecentFiles)
    }
  }

  /**
   * Get recently edited files
   */
  getRecentFiles(): string[] {
    return this.recentEditedFiles.map(f => f.path)
  }

  /**
   * Request completion with debounce
   */
  requestCompletion(context: CompletionContext): void {
    if (!this.options.enabled) {
      return
    }
    this.debouncedRequest?.(context)
  }

  /**
   * Cancel current request
   */
  cancel(): void {
    this.debouncedRequest?.cancel()
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
  }

  /**
   * Check if a character should trigger completion
   */
  shouldTrigger(char: string): boolean {
    return this.options.enabled && this.options.triggerCharacters.includes(char)
  }


  /**
   * Build completion context from editor state
   */
  buildContext(
    filePath: string,
    fileContent: string,
    cursorPosition: Position,
    prefixLines: number = 50,
    suffixLines: number = 20
  ): CompletionContext {
    const lines = fileContent.split('\n')
    const { line, column } = cursorPosition
    
    // Calculate prefix (text before cursor)
    const startLine = Math.max(0, line - prefixLines)
    const prefixLineArray = lines.slice(startLine, line)
    const currentLinePrefix = lines[line]?.substring(0, column) || ''
    const prefix = [...prefixLineArray, currentLinePrefix].join('\n')
    
    // Calculate suffix (text after cursor)
    const currentLineSuffix = lines[line]?.substring(column) || ''
    const endLine = Math.min(lines.length, line + suffixLines)
    const suffixLineArray = lines.slice(line + 1, endLine)
    const suffix = [currentLineSuffix, ...suffixLineArray].join('\n')
    
    // Get open files from store
    const state = useStore.getState()
    const openFiles = state.openFiles
      .filter(f => f.path !== filePath)
      .slice(0, 5)
      .map(f => ({ path: f.path, content: f.content }))
    
    return {
      filePath,
      fileContent,
      cursorPosition,
      prefix,
      suffix,
      language: getLanguageFromPath(filePath),
      openFiles,
      recentFiles: this.getRecentFilesContent()
    }
  }

  private getRecentFilesContent(): Array<{ path: string; content: string }> {
    const state = useStore.getState()
    return this.recentEditedFiles
      .map(f => {
        const openFile = state.openFiles.find(of => of.path === f.path)
        return openFile ? { path: f.path, content: openFile.content } : null
      })
      .filter((f): f is { path: string; content: string } => f !== null)
  }


  /**
   * Execute the actual completion request
   */
  private async executeRequest(context: CompletionContext): Promise<void> {
    // Cancel any existing request
    if (this.currentAbortController) {
      this.currentAbortController.abort()
    }
    this.currentAbortController = new AbortController()

    try {
      const result = await this.fetchCompletion(context, this.currentAbortController.signal)
      this.onCompletionCallback?.(result)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.currentAbortController = null
    }
  }

  /**
   * Fetch completion from LLM using existing sendMessage API
   */
  private fetchCompletion(
    context: CompletionContext,
    signal: AbortSignal
  ): Promise<CompletionResult> {
    return new Promise((resolve, reject) => {
      const state = useStore.getState()
      const { llmConfig } = state

      if (!llmConfig.apiKey) {
        reject(new Error('API key not configured'))
        return
      }

      // Build the prompt for FIM (Fill-in-the-Middle)
      const prompt = this.buildFIMPrompt(context)
      let completionText = ''
      let isAborted = false

      // Handle abort signal
      const abortHandler = () => {
        isAborted = true
        window.electronAPI.abortMessage()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal.addEventListener('abort', abortHandler)

      // Set up listeners
      const unsubStream = window.electronAPI.onLLMStream((chunk) => {
        if (isAborted) return
        if (chunk.type === 'text' && chunk.content) {
          completionText += chunk.content
        }
      })

      const unsubError = window.electronAPI.onLLMError((error) => {
        cleanup()
        if (!isAborted) {
          reject(new Error(error.message))
        }
      })

      const unsubDone = window.electronAPI.onLLMDone(() => {
        cleanup()
        if (isAborted) return

        if (!completionText) {
          resolve({ suggestions: [], cached: false })
          return
        }

        const suggestion: CompletionSuggestion = {
          text: completionText.trim(),
          displayText: this.formatDisplayText(completionText.trim()),
          range: { start: 0, end: 0 },
          confidence: 0.8
        }
        resolve({ suggestions: [suggestion], cached: false })
      })

      const cleanup = () => {
        signal.removeEventListener('abort', abortHandler)
        unsubStream()
        unsubError()
        unsubDone()
      }

      // Send the completion request
      window.electronAPI.sendMessage({
        config: llmConfig,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a code completion assistant. Output ONLY the code completion, no explanations or markdown.'
      }).catch((err) => {
        cleanup()
        if (!isAborted) {
          reject(err)
        }
      })
    })
  }


  /**
   * Build FIM (Fill-in-the-Middle) prompt
   */
  private buildFIMPrompt(context: CompletionContext): string {
    const { prefix, suffix, language, openFiles } = context
    
    // Build context from related files
    let relatedContext = ''
    if (openFiles.length > 0) {
      relatedContext = openFiles
        .slice(0, 3)
        .map(f => `// File: ${f.path}\n${f.content.slice(0, 2000)}`)
        .join('\n\n')
      relatedContext = `Related files:\n${relatedContext}\n\n`
    }

    return `${relatedContext}Language: ${language}
Complete the code at the cursor position marked with <CURSOR>.
Only output the completion, no explanations.

${prefix}<CURSOR>${suffix}`
  }

  /**
   * Format display text (truncate if too long)
   */
  private formatDisplayText(text: string, maxLength: number = 100): string {
    const firstLine = text.split('\n')[0]
    if (firstLine.length <= maxLength) {
      return firstLine
    }
    return firstLine.substring(0, maxLength - 3) + '...'
  }

  /**
   * Validate context has required fields
   */
  validateContext(context: CompletionContext): boolean {
    return !!(
      context.filePath &&
      context.fileContent !== undefined &&
      context.cursorPosition &&
      typeof context.cursorPosition.line === 'number' &&
      typeof context.cursorPosition.column === 'number' &&
      Array.isArray(context.openFiles)
    )
  }
}

// Export singleton instance
export const completionService = new CompletionService()

// Export utilities for testing
export { debounce, analyzeImports, getLanguageFromPath }
