/**
 * LSP 服务器安装器
 * 
 * 功能：
 * - 自动检测已安装的 LSP 服务器
 * - 从 npm/GitHub/包管理器自动下载安装
 * - 支持用户自定义安装路径
 * - 配置持久化
 */

import { app } from 'electron'
import { spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { logger } from '@shared/utils/Logger'
import Store from 'electron-store'

// ============ 配置持久化 ============

const store = new Store({ name: 'lsp-config' })
const CONFIG_KEY_BIN_DIR = 'lspBinDir'

// 默认 LSP 服务器安装目录
const DEFAULT_LSP_BIN_DIR = path.join(app.getPath('userData'), 'lsp-servers')

/**
 * 设置自定义 LSP 服务器安装目录（持久化）
 */
export function setCustomLspBinDir(customPath: string | null): void {
  if (customPath) {
    store.set(CONFIG_KEY_BIN_DIR, customPath)
  } else {
    store.delete(CONFIG_KEY_BIN_DIR)
  }
  logger.lsp.info(`[LSP Installer] Bin dir set to: ${customPath || 'default'}`)
}

/**
 * 获取当前配置的 LSP 服务器安装目录
 */
export function getLspBinDir(): string {
  const customDir = store.get(CONFIG_KEY_BIN_DIR) as string | undefined
  const dir = customDir || DEFAULT_LSP_BIN_DIR
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 获取默认 LSP 服务器安装目录
 */
export function getDefaultLspBinDir(): string {
  return DEFAULT_LSP_BIN_DIR
}

// ============ 工具函数 ============

/**
 * 检查命令是否存在于 PATH 中
 */
export function commandExists(cmd: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' })
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

/**
 * 运行 npm 安装包到指定目录
 */
async function npmInstall(packageName: string, targetDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    logger.lsp.info(`[LSP Installer] Running: npm install ${packageName}`)
    
    const proc = spawn(npmCmd, ['install', packageName, '--prefix', targetDir], {
      cwd: targetDir,
      stdio: 'pipe',
      shell: true,
    })
    
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/**
 * 下载文件
 */
async function downloadFile(url: string, destPath: string): Promise<boolean> {
  try {
    logger.lsp.info(`[LSP Installer] Downloading: ${url}`)
    const response = await fetch(url)
    if (!response.ok) return false
    
    const buffer = await response.arrayBuffer()
    fs.writeFileSync(destPath, Buffer.from(buffer))
    return true
  } catch (err) {
    logger.lsp.error(`[LSP Installer] Download failed:`, err)
    return false
  }
}

/**
 * 解压 ZIP 文件
 */
async function extractZip(zipPath: string, destDir: string): Promise<boolean> {
  try {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(destDir, true)
    return true
  } catch (err) {
    logger.lsp.error(`[LSP Installer] Extract failed:`, err)
    return false
  }
}

/**
 * 解压 tar.xz 文件（跨平台）
 */
async function extractTarXz(archivePath: string, destDir: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // Windows: 使用 tar 命令（Windows 10 1803+ 内置）
      // 或者回退到 PowerShell 解压
      try {
        execSync(`tar -xf "${archivePath}"`, { cwd: destDir, stdio: 'ignore' })
        return true
      } catch {
        // 尝试使用 PowerShell（需要 7-Zip 或其他工具）
        logger.lsp.warn('[LSP Installer] tar command failed on Windows, trying alternative...')
        return false
      }
    } else {
      // Unix: 使用 tar 命令
      execSync(`tar -xf "${archivePath}"`, { cwd: destDir, stdio: 'ignore' })
      return true
    }
  } catch (err) {
    logger.lsp.error('[LSP Installer] Extract tar.xz failed:', err)
    return false
  }
}

/**
 * 设置文件可执行权限 (Unix)
 */
function setExecutable(filePath: string): void {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o755)
    } catch { }
  }
}

// ============ 路径查找（统一逻辑） ============

// 内置 node_modules 的基础路径
function getBuiltinBases(): string[] {
  return [
    path.join(process.cwd(), 'node_modules'),
    path.join(__dirname, '..', '..', 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
    path.join(app.getAppPath(), 'node_modules'),
    path.join(process.resourcesPath || '', 'app.asar', 'node_modules'),
    path.join(process.resourcesPath || '', 'app', 'node_modules'),
  ]
}

/**
 * 在内置 node_modules 中查找模块
 */
export function findBuiltinModule(moduleName: string, subPath: string): string | null {
  for (const base of getBuiltinBases()) {
    const fullPath = path.join(base, moduleName, subPath)
    if (fs.existsSync(fullPath)) {
      logger.lsp.debug(`[LSP] Found ${moduleName} at: ${fullPath}`)
      return fullPath
    }
  }
  return null
}

// ============ 服务器路径配置 ============

interface ServerPathConfig {
  // 用户安装目录下的相对路径
  userPaths: string[]
  // 内置 node_modules 下的相对路径
  builtinPaths: string[]
  // 系统命令名（用于检查 PATH）
  systemCommand?: string
}

const SERVER_PATHS: Record<string, ServerPathConfig> = {
  typescript: {
    userPaths: [
      'node_modules/typescript-language-server/lib/cli.mjs',
      'node_modules/typescript-language-server/lib/cli.js',
    ],
    builtinPaths: [
      'typescript-language-server/lib/cli.mjs',
      'typescript-language-server/lib/cli.js',
    ],
  },
  html: {
    userPaths: [
      'node_modules/vscode-langservers-extracted/bin/vscode-html-language-server',
      'node_modules/vscode-langservers-extracted/bin/vscode-html-language-server.js',
    ],
    builtinPaths: [
      'vscode-langservers-extracted/bin/vscode-html-language-server',
      'vscode-langservers-extracted/bin/vscode-html-language-server.js',
    ],
  },
  css: {
    userPaths: [
      'node_modules/vscode-langservers-extracted/bin/vscode-css-language-server',
      'node_modules/vscode-langservers-extracted/bin/vscode-css-language-server.js',
    ],
    builtinPaths: [
      'vscode-langservers-extracted/bin/vscode-css-language-server',
      'vscode-langservers-extracted/bin/vscode-css-language-server.js',
    ],
  },
  json: {
    userPaths: [
      'node_modules/vscode-langservers-extracted/bin/vscode-json-language-server',
      'node_modules/vscode-langservers-extracted/bin/vscode-json-language-server.js',
    ],
    builtinPaths: [
      'vscode-langservers-extracted/bin/vscode-json-language-server',
      'vscode-langservers-extracted/bin/vscode-json-language-server.js',
    ],
  },
  python: {
    userPaths: ['node_modules/pyright/dist/pyright-langserver.js'],
    builtinPaths: ['pyright/dist/pyright-langserver.js'],
    systemCommand: 'pylsp',
  },
  vue: {
    userPaths: ['node_modules/@vue/language-server/bin/vue-language-server.js'],
    builtinPaths: ['@vue/language-server/bin/vue-language-server.js'],
    systemCommand: 'vue-language-server',
  },
  go: {
    userPaths: [`gopls${process.platform === 'win32' ? '.exe' : ''}`],
    builtinPaths: [],
    systemCommand: 'gopls',
  },
  rust: {
    userPaths: [],
    builtinPaths: [],
    systemCommand: 'rust-analyzer',
  },
  clangd: {
    userPaths: [
      `clangd${process.platform === 'win32' ? '.exe' : ''}`,
      // clangd 下载后可能在子目录
      `clangd_*/bin/clangd${process.platform === 'win32' ? '.exe' : ''}`,
    ],
    builtinPaths: [],
    systemCommand: 'clangd',
  },
  zig: {
    userPaths: [`zls${process.platform === 'win32' ? '.exe' : ''}`],
    builtinPaths: [],
    systemCommand: 'zls',
  },
  csharp: {
    userPaths: [`csharp-ls${process.platform === 'win32' ? '.exe' : ''}`],
    builtinPaths: [],
    systemCommand: 'csharp-ls',
  },
  deno: {
    userPaths: [],
    builtinPaths: [],
    systemCommand: 'deno',
  },
}

/**
 * 获取已安装的 LSP 服务器路径（统一入口）
 */
export function getInstalledServerPath(serverType: string): string | null {
  const config = SERVER_PATHS[serverType]
  if (!config) return null

  const binDir = getLspBinDir()

  // 1. 检查用户安装目录
  for (const p of config.userPaths) {
    // 处理通配符路径（如 clangd_*/bin/clangd）
    if (p.includes('*')) {
      const [prefix] = p.split('*')
      const parentDir = path.join(binDir, path.dirname(prefix))
      if (fs.existsSync(parentDir)) {
        const entries = fs.readdirSync(parentDir)
        for (const entry of entries) {
          if (entry.startsWith(path.basename(prefix))) {
            const fullPath = path.join(parentDir, entry, p.split('*/')[1] || '')
            if (fs.existsSync(fullPath)) return fullPath
          }
        }
      }
    } else {
      const fullPath = path.join(binDir, p)
      if (fs.existsSync(fullPath)) return fullPath
    }
  }

  // 2. 检查内置 node_modules
  for (const base of getBuiltinBases()) {
    for (const subPath of config.builtinPaths) {
      const fullPath = path.join(base, subPath)
      if (fs.existsSync(fullPath)) return fullPath
    }
  }

  // 3. 检查系统 PATH
  if (config.systemCommand && commandExists(config.systemCommand)) {
    return config.systemCommand
  }

  return null
}

// ============ 安装结果类型 ============

export interface LspInstallResult {
  success: boolean
  path?: string
  error?: string
}

// ============ 各语言服务器安装函数 ============

/**
 * 安装 TypeScript Language Server
 */
export async function installTypeScriptServer(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('typescript')
  if (existing) return { success: true, path: existing }

  const binDir = getLspBinDir()
  const success = await npmInstall('typescript-language-server typescript', binDir)
  
  if (success) {
    const serverPath = getInstalledServerPath('typescript')
    if (serverPath) {
      logger.lsp.info('[LSP Installer] typescript-language-server installed')
      return { success: true, path: serverPath }
    }
  }
  
  return { success: false, error: 'Failed to install typescript-language-server' }
}

/**
 * 安装 VSCode Language Servers (HTML/CSS/JSON)
 */
export async function installVscodeLanguageServers(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('html')
  if (existing) return { success: true, path: existing }

  const binDir = getLspBinDir()
  const success = await npmInstall('vscode-langservers-extracted', binDir)
  
  if (success) {
    const serverPath = getInstalledServerPath('html')
    if (serverPath) {
      logger.lsp.info('[LSP Installer] vscode-langservers-extracted installed')
      return { success: true, path: serverPath }
    }
  }
  
  return { success: false, error: 'Failed to install vscode-langservers-extracted' }
}

/**
 * 安装 Pyright (Python LSP)
 */
export async function installPyright(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('python')
  if (existing) return { success: true, path: existing }

  const binDir = getLspBinDir()
  const success = await npmInstall('pyright', binDir)
  
  if (success) {
    const serverPath = getInstalledServerPath('python')
    if (serverPath) {
      logger.lsp.info('[LSP Installer] pyright installed')
      return { success: true, path: serverPath }
    }
  }
  
  return { success: false, error: 'Failed to install pyright' }
}

/**
 * 安装 Vue Language Server
 */
export async function installVueServer(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('vue')
  if (existing) return { success: true, path: existing }

  const binDir = getLspBinDir()
  const success = await npmInstall('@vue/language-server', binDir)
  
  if (success) {
    const serverPath = getInstalledServerPath('vue')
    if (serverPath) {
      logger.lsp.info('[LSP Installer] @vue/language-server installed')
      return { success: true, path: serverPath }
    }
  }
  
  return { success: false, error: 'Failed to install @vue/language-server' }
}

/**
 * 安装 gopls (Go LSP)
 */
export async function installGopls(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('go')
  if (existing) return { success: true, path: existing }

  if (!commandExists('go')) {
    return { success: false, error: 'Go is not installed. Please install Go first.' }
  }

  const binDir = getLspBinDir()
  const ext = process.platform === 'win32' ? '.exe' : ''
  const goplsPath = path.join(binDir, 'gopls' + ext)

  logger.lsp.info('[LSP Installer] Installing gopls...')

  return new Promise((resolve) => {
    const proc = spawn('go', ['install', 'golang.org/x/tools/gopls@latest'], {
      env: { ...process.env, GOBIN: binDir },
      stdio: 'pipe',
    })

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(goplsPath)) {
        logger.lsp.info('[LSP Installer] gopls installed')
        resolve({ success: true, path: goplsPath })
      } else {
        resolve({ success: false, error: 'Failed to install gopls' })
      }
    })

    proc.on('error', (err) => resolve({ success: false, error: err.message }))
  })
}


/**
 * 安装 clangd (C/C++ LSP)
 * 从 GitHub Releases 下载预编译二进制
 */
export async function installClangd(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('clangd')
  if (existing) return { success: true, path: existing }

  const binDir = getLspBinDir()

  logger.lsp.info('[LSP Installer] Downloading clangd from GitHub...')

  try {
    // 获取最新 release 信息
    const releaseRes = await fetch('https://api.github.com/repos/clangd/clangd/releases/latest')
    if (!releaseRes.ok) return { success: false, error: 'Failed to fetch clangd release info' }

    const release = await releaseRes.json() as { tag_name?: string; assets?: Array<{ name: string; browser_download_url: string }> }
    const tag = release.tag_name
    if (!tag) return { success: false, error: 'No tag found in clangd release' }

    // 确定平台和架构
    // clangd 的命名格式: clangd-{platform}-{version}.zip
    // platform: mac (Intel), mac-arm64 (Apple Silicon), linux, windows
    let platform: string
    if (process.platform === 'darwin') {
      platform = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
    } else if (process.platform === 'linux') {
      platform = 'linux'
    } else if (process.platform === 'win32') {
      platform = 'windows'
    } else {
      return { success: false, error: `Unsupported platform: ${process.platform}` }
    }

    // 查找对应的 asset
    const assets = release.assets || []
    const asset = assets.find(a => 
      a.name.includes(platform) && 
      a.name.endsWith('.zip')
    )
    if (!asset) return { success: false, error: `No clangd asset found for ${platform}` }

    // 下载
    const zipPath = path.join(binDir, asset.name)
    const downloaded = await downloadFile(asset.browser_download_url, zipPath)
    if (!downloaded) return { success: false, error: 'Failed to download clangd' }

    // 解压
    const extracted = await extractZip(zipPath, binDir)
    fs.unlinkSync(zipPath) // 删除 zip
    if (!extracted) return { success: false, error: 'Failed to extract clangd' }

    // 查找解压后的二进制
    const clangdPath = getInstalledServerPath('clangd')
    if (clangdPath) {
      setExecutable(clangdPath)
      logger.lsp.info('[LSP Installer] clangd installed:', clangdPath)
      return { success: true, path: clangdPath }
    }

    return { success: false, error: 'clangd binary not found after extraction' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 安装 zls (Zig LSP)
 * 从 GitHub Releases 下载预编译二进制
 */
export async function installZls(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('zig')
  if (existing) return { success: true, path: existing }

  // 检查 Zig 是否已安装
  if (!commandExists('zig')) {
    return { success: false, error: 'Zig is not installed. Please install Zig first.' }
  }

  const binDir = getLspBinDir()

  logger.lsp.info('[LSP Installer] Downloading zls from GitHub...')

  try {
    const releaseRes = await fetch('https://api.github.com/repos/zigtools/zls/releases/latest')
    if (!releaseRes.ok) return { success: false, error: 'Failed to fetch zls release info' }

    const release = await releaseRes.json() as { assets?: Array<{ name: string; browser_download_url: string }> }

    // 确定平台和架构
    // zls 命名格式: zls-{arch}-{platform}.{ext}
    // arch: x86_64, aarch64
    // platform: macos, linux, windows
    // ext: tar.xz (Unix), zip (Windows)
    const archMap: Record<string, string> = { x64: 'x86_64', arm64: 'aarch64', ia32: 'x86' }
    const platformMap: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' }
    
    const arch = archMap[process.arch] || process.arch
    const platform = platformMap[process.platform]
    if (!platform) return { success: false, error: `Unsupported platform: ${process.platform}` }

    // Windows 使用 zip，其他平台使用 tar.xz
    const extType = process.platform === 'win32' ? 'zip' : 'tar.xz'
    const assetName = `zls-${arch}-${platform}.${extType}`

    const asset = (release.assets || []).find(a => a.name === assetName)
    if (!asset) return { success: false, error: `No zls asset found: ${assetName}` }

    // 下载
    const archivePath = path.join(binDir, asset.name)
    const downloaded = await downloadFile(asset.browser_download_url, archivePath)
    if (!downloaded) return { success: false, error: 'Failed to download zls' }

    // 解压
    let extractSuccess = false
    if (extType === 'zip') {
      extractSuccess = await extractZip(archivePath, binDir)
    } else {
      extractSuccess = await extractTarXz(archivePath, binDir)
    }
    
    // 清理下载的压缩包
    try { fs.unlinkSync(archivePath) } catch { }
    
    if (!extractSuccess) {
      return { success: false, error: 'Failed to extract zls' }
    }

    const ext = process.platform === 'win32' ? '.exe' : ''
    const zlsPath = path.join(binDir, 'zls' + ext)
    if (fs.existsSync(zlsPath)) {
      setExecutable(zlsPath)
      logger.lsp.info('[LSP Installer] zls installed:', zlsPath)
      return { success: true, path: zlsPath }
    }

    return { success: false, error: 'zls binary not found after extraction' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 安装 csharp-ls (C# LSP)
 * 通过 dotnet tool 安装
 */
export async function installCsharpLs(): Promise<LspInstallResult> {
  const existing = getInstalledServerPath('csharp')
  if (existing) return { success: true, path: existing }

  if (!commandExists('dotnet')) {
    return { success: false, error: '.NET SDK is not installed. Please install .NET first.' }
  }

  const binDir = getLspBinDir()
  const ext = process.platform === 'win32' ? '.exe' : ''

  logger.lsp.info('[LSP Installer] Installing csharp-ls via dotnet tool...')

  return new Promise((resolve) => {
    const proc = spawn('dotnet', ['tool', 'install', 'csharp-ls', '--tool-path', binDir], {
      stdio: 'pipe',
    })

    proc.on('close', (code) => {
      const csharpLsPath = path.join(binDir, 'csharp-ls' + ext)
      if (fs.existsSync(csharpLsPath)) {
        logger.lsp.info('[LSP Installer] csharp-ls installed')
        resolve({ success: true, path: csharpLsPath })
      } else if (code === 0) {
        // 可能已安装，检查系统 PATH
        const existing = getInstalledServerPath('csharp')
        if (existing) resolve({ success: true, path: existing })
        else resolve({ success: false, error: 'csharp-ls not found after installation' })
      } else {
        resolve({ success: false, error: 'Failed to install csharp-ls' })
      }
    })

    proc.on('error', (err) => resolve({ success: false, error: err.message }))
  })
}

// ============ 统一安装入口 ============

/**
 * 根据服务器 ID 安装对应的 LSP 服务器
 */
export async function installServer(serverId: string): Promise<LspInstallResult> {
  switch (serverId) {
    case 'typescript':
      return installTypeScriptServer()
    case 'html':
    case 'css':
    case 'json':
      return installVscodeLanguageServers()
    case 'python':
      return installPyright()
    case 'vue':
      return installVueServer()
    case 'go':
      return installGopls()
    case 'clangd':
      return installClangd()
    case 'zig':
      return installZls()
    case 'csharp':
      return installCsharpLs()
    case 'rust':
      return { success: false, error: 'rust-analyzer must be installed manually via rustup' }
    case 'deno':
      return { success: false, error: 'Deno must be installed manually from deno.land' }
    default:
      return { success: false, error: `Unknown server: ${serverId}` }
  }
}

/**
 * 获取所有 LSP 服务器的安装状态
 */
export function getLspServerStatus(): Record<string, { installed: boolean; path?: string }> {
  const servers = Object.keys(SERVER_PATHS)
  const status: Record<string, { installed: boolean; path?: string }> = {}

  for (const server of servers) {
    const serverPath = getInstalledServerPath(server)
    status[server] = {
      installed: !!serverPath,
      path: serverPath || undefined,
    }
  }

  return status
}

/**
 * 安装所有基础 LSP 服务器
 */
export async function installBasicServers(): Promise<LspInstallResult> {
  logger.lsp.info('[LSP Installer] Installing basic LSP servers...')

  const results = await Promise.all([
    installTypeScriptServer(),
    installVscodeLanguageServers(),
  ])

  const failed = results.filter(r => !r.success)
  if (failed.length > 0) {
    return { success: false, error: failed.map(f => f.error).join('; ') }
  }

  logger.lsp.info('[LSP Installer] Basic LSP servers installed')
  return { success: true }
}
