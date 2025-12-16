/**
 * LSP 服务 - 渲染进程端
 * 与主进程中的 TypeScript Language Server 通信
 */

// 文档版本追踪
const documentVersions = new Map<string, number>()

/**
 * 获取文件的语言 ID
 */
function getLanguageId(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    md: 'markdown',
    py: 'python',
  }
  return languageMap[ext] || 'plaintext'
}

/**
 * 将文件路径转换为 LSP URI
 */
export function pathToLspUri(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  return `file:///${normalizedPath}`
}

/**
 * 将 LSP URI 转换为文件路径
 */
export function lspUriToPath(uri: string): string {
  return uri.replace('file:///', '').replace(/\//g, '\\')
}

/**
 * 启动 LSP 服务器
 */
export async function startLspServer(workspacePath: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.lspStart(workspacePath)
    console.log('[LSP Client] Server started:', result)
    return result.success
  } catch (error) {
    console.error('[LSP Client] Failed to start server:', error)
    return false
  }
}

/**
 * 停止 LSP 服务器
 */
export async function stopLspServer(): Promise<void> {
  try {
    await window.electronAPI.lspStop()
    documentVersions.clear()
    console.log('[LSP Client] Server stopped')
  } catch (error) {
    console.error('[LSP Client] Failed to stop server:', error)
  }
}

/**
 * 通知服务器文档已打开
 */
export async function didOpenDocument(filePath: string, content: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  const languageId = getLanguageId(filePath)
  const version = 1
  
  documentVersions.set(uri, version)
  
  await window.electronAPI.lspDidOpen({
    uri,
    languageId,
    version,
    text: content,
  })
}

/**
 * 通知服务器文档已变更
 */
export async function didChangeDocument(filePath: string, content: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  const currentVersion = documentVersions.get(uri) || 0
  const newVersion = currentVersion + 1
  
  documentVersions.set(uri, newVersion)
  
  await window.electronAPI.lspDidChange({
    uri,
    version: newVersion,
    text: content,
  })
}

/**
 * 通知服务器文档已关闭
 */
export async function didCloseDocument(filePath: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  documentVersions.delete(uri)
  
  await window.electronAPI.lspDidClose({ uri })
}

/**
 * 跳转到定义
 */
export async function goToDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspDefinition({
      uri,
      line,
      character,
    })
    
    if (!result) return null
    
    // 结果可能是单个位置或位置数组
    if (Array.isArray(result)) {
      return result
    }
    return [result]
  } catch (error) {
    console.error('[LSP Client] Definition error:', error)
    return null
  }
}

/**
 * 查找引用
 */
export async function findReferences(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: any }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspReferences({
      uri,
      line,
      character,
    })
    return result
  } catch (error) {
    console.error('[LSP Client] References error:', error)
    return null
  }
}

/**
 * 获取悬停信息
 */
export async function getHoverInfo(
  filePath: string,
  line: number,
  character: number
): Promise<{ contents: any; range?: any } | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspHover({
      uri,
      line,
      character,
    })
    return result
  } catch (error) {
    console.error('[LSP Client] Hover error:', error)
    return null
  }
}

/**
 * 获取代码补全
 */
export async function getCompletions(
  filePath: string,
  line: number,
  character: number
): Promise<any> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspCompletion({
      uri,
      line,
      character,
    })
    return result
  } catch (error) {
    console.error('[LSP Client] Completion error:', error)
    return null
  }
}

/**
 * 重命名符号
 */
export async function renameSymbol(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<any> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspRename({
      uri,
      line,
      character,
      newName,
    })
    return result
  } catch (error) {
    console.error('[LSP Client] Rename error:', error)
    return null
  }
}

/**
 * 监听诊断信息
 */
export function onDiagnostics(
  callback: (uri: string, diagnostics: any[]) => void
): () => void {
  return window.electronAPI.onLspDiagnostics((params) => {
    callback(params.uri, params.diagnostics)
  })
}
