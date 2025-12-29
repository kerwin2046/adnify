/**
 * 性能监控服务
 * 统计 LLM 调用、工具执行、文件操作等性能指标
 */

import { logger } from './Logger'

// 性能指标类型
export interface PerformanceMetric {
  name: string
  category: MetricCategory
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  lastDuration: number
  lastTimestamp: number
  errors: number
}

export type MetricCategory = 'llm' | 'tool' | 'file' | 'index' | 'network' | 'render'

// 单次测量记录
interface MeasurementRecord {
  duration: number
  timestamp: number
  success: boolean
  metadata?: Record<string, unknown>
}

// 性能监控配置
interface PerformanceConfig {
  enabled: boolean
  maxHistoryPerMetric: number
  maxMetrics: number // 最大指标数量，防止无限增长
  slowThresholds: Record<MetricCategory, number>
  reportInterval: number // 毫秒
}

class PerformanceMonitorClass {
  private config: PerformanceConfig = {
    enabled: true,
    maxHistoryPerMetric: 100,
    maxMetrics: 500, // 最大 500 个不同的指标
    slowThresholds: {
      llm: 5000,      // LLM 调用超过 5s 视为慢
      tool: 3000,     // 工具执行超过 3s 视为慢
      file: 1000,     // 文件操作超过 1s 视为慢
      index: 10000,   // 索引操作超过 10s 视为慢
      network: 5000,  // 网络请求超过 5s 视为慢
      render: 100,    // 渲染超过 100ms 视为慢
    },
    reportInterval: 60000, // 每分钟报告一次
  }

  private metrics: Map<string, PerformanceMetric> = new Map()
  private history: Map<string, MeasurementRecord[]> = new Map()
  private activeTimers: Map<string, { startTime: number; category: MetricCategory; metadata?: Record<string, unknown> }> = new Map()
  private reportTimer: NodeJS.Timeout | null = null

  constructor() {
    // 自动启动定期报告
    this.startPeriodicReport()
  }

  /**
   * 配置性能监控
   */
  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /**
   * 开始计时
   */
  start(name: string, category: MetricCategory, metadata?: Record<string, unknown>): void {
    if (!this.config.enabled) return

    this.activeTimers.set(name, {
      startTime: performance.now(),
      category,
      metadata,
    })
  }

  /**
   * 结束计时并记录
   */
  end(name: string, success: boolean = true, additionalMetadata?: Record<string, unknown>): number | null {
    if (!this.config.enabled) return null

    const timer = this.activeTimers.get(name)
    if (!timer) {
      logger.perf.warn(`Timer "${name}" not found`)
      return null
    }

    const duration = Math.round(performance.now() - timer.startTime)
    this.activeTimers.delete(name)

    this.record(name, timer.category, duration, success, { ...timer.metadata, ...additionalMetadata })

    return duration
  }

  /**
   * 记录一次测量
   */
  record(
    name: string,
    category: MetricCategory,
    duration: number,
    success: boolean = true,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enabled) return

    const key = `${category}:${name}`
    const now = Date.now()

    // 更新指标
    let metric = this.metrics.get(key)
    if (!metric) {
      // 检查是否超过最大指标数量，如果超过则清理最旧的
      if (this.metrics.size >= this.config.maxMetrics) {
        this.evictOldestMetric()
      }
      
      metric = {
        name,
        category,
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastDuration: 0,
        lastTimestamp: 0,
        errors: 0,
      }
      this.metrics.set(key, metric)
    }

    metric.count++
    metric.totalDuration += duration
    metric.avgDuration = Math.round(metric.totalDuration / metric.count)
    metric.minDuration = Math.min(metric.minDuration, duration)
    metric.maxDuration = Math.max(metric.maxDuration, duration)
    metric.lastDuration = duration
    metric.lastTimestamp = now
    if (!success) metric.errors++

    // 记录历史
    let hist = this.history.get(key)
    if (!hist) {
      hist = []
      this.history.set(key, hist)
    }
    hist.push({ duration, timestamp: now, success, metadata })
    if (hist.length > this.config.maxHistoryPerMetric) {
      hist.shift()
    }

    // 检查是否为慢操作
    const threshold = this.config.slowThresholds[category]
    if (duration > threshold) {
      logger.perf.warn(`Slow ${category} operation: ${name}`, {
        duration,
        threshold,
        metadata,
      })
    }
  }

  /**
   * 测量异步函数
   */
  async measure<T>(
    name: string,
    category: MetricCategory,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name, category, metadata)
    try {
      const result = await fn()
      this.end(name, true)
      return result
    } catch (error) {
      this.end(name, false, { error: String(error) })
      throw error
    }
  }

  /**
   * 测量同步函数
   */
  measureSync<T>(
    name: string,
    category: MetricCategory,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.start(name, category, metadata)
    try {
      const result = fn()
      this.end(name, true)
      return result
    } catch (error) {
      this.end(name, false, { error: String(error) })
      throw error
    }
  }

  /**
   * 获取指标
   */
  getMetric(name: string, category: MetricCategory): PerformanceMetric | undefined {
    return this.metrics.get(`${category}:${name}`)
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values())
  }

  /**
   * 获取分类指标
   */
  getMetricsByCategory(category: MetricCategory): PerformanceMetric[] {
    return this.getAllMetrics().filter(m => m.category === category)
  }

  /**
   * 获取历史记录
   */
  getHistory(name: string, category: MetricCategory): MeasurementRecord[] {
    return this.history.get(`${category}:${name}`) || []
  }

  /**
   * 获取性能摘要
   */
  getSummary(): {
    totalOperations: number
    totalErrors: number
    avgDuration: number
    byCategory: Record<MetricCategory, { count: number; avgDuration: number; errors: number }>
  } {
    const metrics = this.getAllMetrics()
    const byCategory: Record<MetricCategory, { count: number; avgDuration: number; errors: number; totalDuration: number }> = {
      llm: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
      tool: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
      file: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
      index: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
      network: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
      render: { count: 0, avgDuration: 0, errors: 0, totalDuration: 0 },
    }

    let totalOperations = 0
    let totalErrors = 0
    let totalDuration = 0

    for (const metric of metrics) {
      totalOperations += metric.count
      totalErrors += metric.errors
      totalDuration += metric.totalDuration

      const cat = byCategory[metric.category]
      cat.count += metric.count
      cat.errors += metric.errors
      cat.totalDuration += metric.totalDuration
    }

    // 计算平均值
    for (const cat of Object.values(byCategory)) {
      cat.avgDuration = cat.count > 0 ? Math.round(cat.totalDuration / cat.count) : 0
    }

    return {
      totalOperations,
      totalErrors,
      avgDuration: totalOperations > 0 ? Math.round(totalDuration / totalOperations) : 0,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, { count: v.count, avgDuration: v.avgDuration, errors: v.errors }])
      ) as Record<MetricCategory, { count: number; avgDuration: number; errors: number }>,
    }
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.clear()
    this.history.clear()
    this.activeTimers.clear()
  }

  /**
   * 淘汰最旧的指标（LRU）
   */
  private evictOldestMetric(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, metric] of this.metrics) {
      if (metric.lastTimestamp < oldestTime) {
        oldestTime = metric.lastTimestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.metrics.delete(oldestKey)
      this.history.delete(oldestKey)
    }
  }

  /**
   * 启动定期报告
   */
  private startPeriodicReport(): void {
    if (this.reportTimer) return

    this.reportTimer = setInterval(() => {
      if (!this.config.enabled) return

      const summary = this.getSummary()
      if (summary.totalOperations > 0) {
        logger.perf.info('Performance summary', summary)
      }
    }, this.config.reportInterval)
  }

  /**
   * 停止定期报告
   */
  stopPeriodicReport(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = null
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopPeriodicReport()
    this.clear()
  }
}

// 单例导出
export const performanceMonitor = new PerformanceMonitorClass()

export default performanceMonitor
