/**
 * 代码库索引主服务
 * 整合 Embedding、分块、向量存储
 */

import { logger } from '@shared/utils/Logger'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { Worker } from 'worker_threads'
import { EmbeddingService } from './embedder'
import { VectorStoreService } from './vectorStore'
import {
  IndexConfig,
  IndexStatus,
  SearchResult,
  EmbeddingConfig,
  DEFAULT_INDEX_CONFIG,
} from './types'

/**
 * Worker 响应消息类型（与 worker 中定义保持一致）
 */
interface WorkerProgressMessage { type: 'progress'; processed: number; total: number }
interface WorkerResultMessage { type: 'result'; chunks: any[]; processed: number; total: number }
interface WorkerUpdateResultMessage { type: 'update_result'; filePath: string; chunks: any[]; deleted: boolean }
interface WorkerBatchUpdateResultMessage { type: 'batch_update_result'; results: Array<{ filePath: string; chunks: any[]; deleted: boolean }> }
interface WorkerCompleteMessage { type: 'complete'; totalChunks: number }
interface WorkerErrorMessage { type: 'error'; error: string }

type WorkerMessage = 
  | WorkerProgressMessage 
  | WorkerResultMessage 
  | WorkerUpdateResultMessage 
  | WorkerBatchUpdateResultMessage
  | WorkerCompleteMessage 
  | WorkerErrorMessage

export class CodebaseIndexService {
  private workspacePath: string
  private config: IndexConfig
  private embedder: EmbeddingService
  private vectorStore: VectorStoreService
  private mainWindow: BrowserWindow | null = null
  private worker: Worker | null = null

  private status: IndexStatus = {
    isIndexing: false,
    totalFiles: 0,
    indexedFiles: 0,
    totalChunks: 0,
  }
  
  // 进度节流：避免频繁发送 IPC 消息
  private lastProgressEmit = 0
  private readonly PROGRESS_THROTTLE_MS = 100

  constructor(workspacePath: string, config?: Partial<IndexConfig>) {
    this.workspacePath = workspacePath
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config }
    this.embedder = new EmbeddingService(this.config.embedding)
    this.vectorStore = new VectorStoreService(workspacePath)
    this.initWorker()
  }

  private initWorker(): void {
    try {
      const workerPath = path.join(__dirname, 'indexer.worker.js')
      this.worker = new Worker(workerPath)

      this.worker.on('message', async (message: WorkerMessage) => {
        switch (message.type) {
          case 'progress':
            this.status.indexedFiles = message.processed
            if (message.total) this.status.totalFiles = message.total
            this.emitProgress()
            break

          case 'result':
            if (message.chunks?.length > 0) {
              await this.vectorStore.addBatch(message.chunks)
              this.status.totalChunks += message.chunks.length
            }
            this.status.indexedFiles = message.processed
            if (message.total) this.status.totalFiles = message.total
            this.emitProgress()
            break

          case 'update_result':
            if (message.deleted) {
              await this.vectorStore.deleteFile(message.filePath)
            } else if (message.chunks?.length > 0) {
              await this.vectorStore.upsertFile(message.filePath, message.chunks)
            }
            logger.index.info(`[IndexService] Updated index for: ${message.filePath}`)
            break

          case 'batch_update_result':
            for (const result of message.results) {
              if (result.deleted) {
                await this.vectorStore.deleteFile(result.filePath)
              } else if (result.chunks?.length > 0) {
                await this.vectorStore.upsertFile(result.filePath, result.chunks)
              }
            }
            logger.index.info(`[IndexService] Batch updated ${message.results.length} files`)
            break

          case 'complete':
            this.status.isIndexing = false
            this.status.lastIndexedAt = Date.now()
            logger.index.info(`[IndexService] Indexing complete. Total chunks: ${this.status.totalChunks}`)
            this.emitProgress(true)
            break

          case 'error':
            logger.index.error('[IndexService] Worker error:', message.error)
            this.status.error = message.error
            this.status.isIndexing = false
            this.emitProgress(true)
            break
        }
      })

      this.worker.on('error', (err) => {
        logger.index.error('[IndexService] Worker thread error:', err.message)
        this.status.error = err.message
        this.status.isIndexing = false
        this.emitProgress()
      })

    } catch (e) {
      logger.index.error('[IndexService] Failed to initialize worker:', e)
    }
  }

  /**
   * 设置主窗口（用于发送进度事件）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize()

    // 从数据库读取实际的索引统计
    const hasExistingIndex = await this.vectorStore.hasIndex()
    if (hasExistingIndex) {
      const stats = await this.vectorStore.getStats()
      this.status.totalChunks = stats.chunkCount
      this.status.totalFiles = stats.fileCount
    }

    logger.index.info('[IndexService] Initialized for:', this.workspacePath,
      hasExistingIndex ? `(${this.status.totalChunks} chunks)` : '(no index)')
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.embedding) {
      this.embedder.updateConfig(config.embedding)
    }
    // Worker will get new config on next message
  }

  /**
   * 更新 Embedding 配置
   */
  updateEmbeddingConfig(config: Partial<EmbeddingConfig>): void {
    this.config.embedding = { ...this.config.embedding, ...config }
    this.embedder.updateConfig(this.config.embedding)
  }

  /**
   * 获取当前状态
   */
  getStatus(): IndexStatus {
    return { ...this.status }
  }

  /**
   * 检查是否有索引
   */
  async hasIndex(): Promise<boolean> {
    return this.vectorStore.hasIndex()
  }

  /**
   * 全量索引工作区
   */
  async indexWorkspace(): Promise<void> {
    if (this.status.isIndexing) {
      logger.index.info('[IndexService] Already indexing, skipping...')
      return
    }

    if (!this.worker) {
      this.initWorker()
    }

    this.status = {
      isIndexing: true,
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    }
    this.emitProgress()

    try {
      // 获取已有文件哈希用于增量更新
      // Map 通过 postMessage 传递会变成空对象，需要转换为普通对象
      const existingHashesMap = await this.vectorStore.getFileHashes()
      const existingHashes: Record<string, string> = Object.fromEntries(existingHashesMap)

      logger.index.info(`[IndexService] Starting indexing for ${this.workspacePath} (${existingHashesMap.size} existing files)...`)
      this.worker?.postMessage({
        type: 'index',
        workspacePath: this.workspacePath,
        config: this.config,
        existingHashes
      })

    } catch (e) {
      logger.index.error('[IndexService] Indexing failed:', e)
      this.status.error = e instanceof Error ? e.message : String(e)
      this.status.isIndexing = false
      this.emitProgress()
    }
  }

  /**
   * 增量更新单个文件
   */
  async updateFile(filePath: string): Promise<void> {
    if (!this.vectorStore.isInitialized()) {
      return
    }

    if (!this.worker) {
      this.initWorker()
    }

    // 简单检查后缀
    const ext = path.extname(filePath).toLowerCase()
    if (!this.config.includedExts.includes(ext)) {
      return
    }

    this.worker?.postMessage({
      type: 'update',
      workspacePath: this.workspacePath,
      file: filePath,
      config: this.config
    })
  }

  /**
   * 批量增量更新文件
   * 用于文件监听器批量触发的场景
   */
  async updateFiles(filePaths: string[]): Promise<void> {
    if (!this.vectorStore.isInitialized() || filePaths.length === 0) {
      return
    }

    if (!this.worker) {
      this.initWorker()
    }

    // 过滤有效文件
    const validFiles = filePaths.filter(filePath => {
      const ext = path.extname(filePath).toLowerCase()
      return this.config.includedExts.includes(ext)
    })

    if (validFiles.length === 0) return

    logger.index.info(`[IndexService] Batch updating ${validFiles.length} files`)

    this.worker?.postMessage({
      type: 'batch_update',
      workspacePath: this.workspacePath,
      files: validFiles,
      config: this.config
    })
  }

  /**
   * 删除文件索引
   */
  async deleteFileIndex(filePath: string): Promise<void> {
    if (!this.vectorStore.isInitialized()) {
      return
    }

    await this.vectorStore.deleteFile(filePath)
    logger.index.info(`[IndexService] Deleted index for: ${filePath}`)
  }

  /**
   * 语义搜索
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.vectorStore.isInitialized()) {
      throw new Error('Index not initialized')
    }

    // 生成查询向量 (Keep in main process for low latency)
    const queryVector = await this.embedder.embed(query)

    // 向量搜索
    return this.vectorStore.search(queryVector, topK)
  }

  /**
   * 混合搜索（向量 + 关键词）
   */
  async hybridSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
    // 1. 向量搜索
    const semanticResults = await this.search(query, topK * 2)
    return semanticResults.slice(0, topK)
  }

  /**
   * 清空索引
   */
  async clearIndex(): Promise<void> {
    await this.vectorStore.clear()
    this.status = {
      isIndexing: false,
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    }
    logger.index.info('[IndexService] Index cleared')
  }

  /**
   * 测试 Embedding 连接
   */
  async testEmbeddingConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    return this.embedder.testConnection()
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }

  // ========== 私有方法 ==========

  /**
   * 发送进度事件到渲染进程（带节流）
   */
  private emitProgress(force = false): void {
    const now = Date.now()
    
    // 节流：除非强制或间隔足够，否则跳过
    if (!force && now - this.lastProgressEmit < this.PROGRESS_THROTTLE_MS) {
      return
    }
    this.lastProgressEmit = now
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('index:progress', this.status)
      } catch (e) {
        // 忽略窗口已销毁的错误
      }
    }
  }
}

// 按工作区路径管理索引服务实例（支持多窗口）
const indexServiceInstances = new Map<string, CodebaseIndexService>()

/**
 * 规范化工作区路径（用于 Map key）
 */
function normalizeWorkspacePath(workspacePath: string): string {
  return workspacePath.replace(/\\/g, '/').toLowerCase()
}

/**
 * 获取或创建索引服务实例
 * 每个工作区有独立的实例，支持多窗口同时打开不同工作区
 */
export function getIndexService(workspacePath: string): CodebaseIndexService {
  const normalizedPath = normalizeWorkspacePath(workspacePath)
  
  let instance = indexServiceInstances.get(normalizedPath)
  if (!instance) {
    instance = new CodebaseIndexService(workspacePath)
    indexServiceInstances.set(normalizedPath, instance)
    logger.index.info(`[IndexService] Created instance for: ${workspacePath}`)
  }

  return instance
}

/**
 * 销毁指定工作区的索引服务实例
 */
export function destroyIndexService(workspacePath?: string): void {
  if (workspacePath) {
    const normalizedPath = normalizeWorkspacePath(workspacePath)
    const instance = indexServiceInstances.get(normalizedPath)
    if (instance) {
      instance.destroy()
      indexServiceInstances.delete(normalizedPath)
      logger.index.info(`[IndexService] Instance destroyed for: ${workspacePath}`)
    }
  } else {
    // 销毁所有实例
    for (const [path, instance] of indexServiceInstances) {
      instance.destroy()
      logger.index.info(`[IndexService] Instance destroyed for: ${path}`)
    }
    indexServiceInstances.clear()
    logger.index.info('[IndexService] All instances destroyed')
  }
}
