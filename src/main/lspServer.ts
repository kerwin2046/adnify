/**
 * TypeScript Language Server 管理
 * 在主进程中启动和管理 TypeScript Language Server
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import { BrowserWindow, ipcMain } from 'electron'

let tsServer: ChildProcess | null = null
let requestId = 0
const pendingRequests = new Map<number, { resolve: Function; reject: Function }>()
let contentBuffer = ''
let contentLength = -1

/**
 * 启动 TypeScript Language Server
 */
export function startLanguageServer(workspacePath: string): void {
  if (tsServer) {
    console.log('[LSP] Server already running')
    return
  }

  // 查找 typescript-language-server
  const tsServerPath = require.resolve('typescript-language-server/lib/cli.mjs')
  
  console.log('[LSP] Starting TypeScript Language Server...')
  console.log('[LSP] Server path:', tsServerPath)
  console.log('[LSP] Workspace:', workspacePath)

  tsServer = spawn('node', [tsServerPath, '--stdio'], {
    cwd: workspacePath,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (!tsServer.stdout || !tsServer.stdin) {
    console.error('[LSP] Failed to create server pipes')
    return
  }

  // 处理服务器输出
  tsServer.stdout.on('data', (data: Buffer) => {
    handleServerOutput(data.toString())
  })

  tsServer.stderr?.on('data', (data: Buffer) => {
    console.error('[LSP] Server error:', data.toString())
  })

  tsServer.on('close', (code) => {
    console.log('[LSP] Server closed with code:', code)
    tsServer = null
  })

  tsServer.on('error', (err) => {
    console.error('[LSP] Server error:', err)
    tsServer = null
  })

  // 初始化 LSP
  initializeServer(workspacePath)
}

/**
 * 处理服务器输出（LSP 协议）
 */
function handleServerOutput(data: string): void {
  contentBuffer += data

  while (true) {
    if (contentLength === -1) {
      // 解析 header
      const headerEnd = contentBuffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return

      const header = contentBuffer.substring(0, headerEnd)
      const match = header.match(/Content-Length: (\d+)/)
      if (match) {
        contentLength = parseInt(match[1], 10)
      }
      contentBuffer = contentBuffer.substring(headerEnd + 4)
    }

    if (contentLength === -1) return
    if (contentBuffer.length < contentLength) return

    // 解析消息
    const message = contentBuffer.substring(0, contentLength)
    contentBuffer = contentBuffer.substring(contentLength)
    contentLength = -1

    try {
      const json = JSON.parse(message)
      handleServerMessage(json)
    } catch (e) {
      console.error('[LSP] Failed to parse message:', e)
    }
  }
}

/**
 * 处理服务器消息
 */
function handleServerMessage(message: any): void {
  if (message.id !== undefined && pendingRequests.has(message.id)) {
    // 响应
    const { resolve, reject } = pendingRequests.get(message.id)!
    pendingRequests.delete(message.id)

    if (message.error) {
      reject(message.error)
    } else {
      resolve(message.result)
    }
  } else if (message.method) {
    // 通知或请求
    handleServerNotification(message)
  }
}

/**
 * 处理服务器通知
 */
function handleServerNotification(message: any): void {
  // 将诊断信息发送到渲染进程
  if (message.method === 'textDocument/publishDiagnostics') {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach((win) => {
      win.webContents.send('lsp:diagnostics', message.params)
    })
  }
}

/**
 * 发送请求到服务器
 */
function sendRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!tsServer?.stdin) {
      reject(new Error('Server not running'))
      return
    }

    const id = ++requestId
    pendingRequests.set(id, { resolve, reject })

    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`

    tsServer.stdin.write(content)
  })
}

/**
 * 发送通知到服务器
 */
function sendNotification(method: string, params: any): void {
  if (!tsServer?.stdin) return

  const message = JSON.stringify({ jsonrpc: '2.0', method, params })
  const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`

  tsServer.stdin.write(content)
}

/**
 * 初始化服务器
 */
async function initializeServer(workspacePath: string): Promise<void> {
  try {
    const result = await sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${workspacePath.replace(/\\/g, '/')}`,
      capabilities: {
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true,
            didClose: true,
          },
          completion: {
            completionItem: {
              snippetSupport: true,
            },
          },
          hover: {},
          definition: {},
          references: {},
          documentHighlight: {},
          documentSymbol: {},
          rename: {},
        },
        workspace: {
          workspaceFolders: true,
        },
      },
      workspaceFolders: [
        {
          uri: `file://${workspacePath.replace(/\\/g, '/')}`,
          name: path.basename(workspacePath),
        },
      ],
    })

    console.log('[LSP] Server initialized:', result.capabilities)

    // 发送 initialized 通知
    sendNotification('initialized', {})
  } catch (error) {
    console.error('[LSP] Failed to initialize server:', error)
  }
}

/**
 * 停止语言服务器
 */
export function stopLanguageServer(): void {
  if (tsServer) {
    sendRequest('shutdown', null)
      .then(() => {
        sendNotification('exit', null)
        tsServer?.kill()
        tsServer = null
      })
      .catch(() => {
        tsServer?.kill()
        tsServer = null
      })
  }
}

/**
 * 注册 IPC 处理器
 */
export function registerLspHandlers(): void {
  // 启动服务器
  ipcMain.handle('lsp:start', (_, workspacePath: string) => {
    startLanguageServer(workspacePath)
    return { success: true }
  })

  // 停止服务器
  ipcMain.handle('lsp:stop', () => {
    stopLanguageServer()
    return { success: true }
  })

  // 打开文档
  ipcMain.handle('lsp:didOpen', (_, params: { uri: string; languageId: string; version: number; text: string }) => {
    sendNotification('textDocument/didOpen', {
      textDocument: params,
    })
  })

  // 文档变更
  ipcMain.handle('lsp:didChange', (_, params: { uri: string; version: number; text: string }) => {
    sendNotification('textDocument/didChange', {
      textDocument: { uri: params.uri, version: params.version },
      contentChanges: [{ text: params.text }],
    })
  })

  // 关闭文档
  ipcMain.handle('lsp:didClose', (_, params: { uri: string }) => {
    sendNotification('textDocument/didClose', {
      textDocument: { uri: params.uri },
    })
  })

  // 跳转到定义
  ipcMain.handle('lsp:definition', async (_, params: { uri: string; line: number; character: number }) => {
    try {
      const result = await sendRequest('textDocument/definition', {
        textDocument: { uri: params.uri },
        position: { line: params.line, character: params.character },
      })
      return result
    } catch (error) {
      console.error('[LSP] Definition error:', error)
      return null
    }
  })

  // 查找引用
  ipcMain.handle('lsp:references', async (_, params: { uri: string; line: number; character: number }) => {
    try {
      const result = await sendRequest('textDocument/references', {
        textDocument: { uri: params.uri },
        position: { line: params.line, character: params.character },
        context: { includeDeclaration: true },
      })
      return result
    } catch (error) {
      console.error('[LSP] References error:', error)
      return null
    }
  })

  // 悬停信息
  ipcMain.handle('lsp:hover', async (_, params: { uri: string; line: number; character: number }) => {
    try {
      const result = await sendRequest('textDocument/hover', {
        textDocument: { uri: params.uri },
        position: { line: params.line, character: params.character },
      })
      return result
    } catch (error) {
      console.error('[LSP] Hover error:', error)
      return null
    }
  })

  // 代码补全
  ipcMain.handle('lsp:completion', async (_, params: { uri: string; line: number; character: number }) => {
    try {
      const result = await sendRequest('textDocument/completion', {
        textDocument: { uri: params.uri },
        position: { line: params.line, character: params.character },
      })
      return result
    } catch (error) {
      console.error('[LSP] Completion error:', error)
      return null
    }
  })

  // 重命名
  ipcMain.handle('lsp:rename', async (_, params: { uri: string; line: number; character: number; newName: string }) => {
    try {
      const result = await sendRequest('textDocument/rename', {
        textDocument: { uri: params.uri },
        position: { line: params.line, character: params.character },
        newName: params.newName,
      })
      return result
    } catch (error) {
      console.error('[LSP] Rename error:', error)
      return null
    }
  })
}
