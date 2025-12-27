/**
 * 上下文压缩状态指示器
 * 显示当前对话的压缩状态和摘要信息
 */

import { useState, useCallback, useMemo } from 'react'
import { Minimize2, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'
import { useAgentStore, selectContextSummary, selectMessages, contextCompactionService } from '@/renderer/agent'
import { Button } from '../ui'

interface ContextCompactionIndicatorProps {
  language?: 'zh' | 'en'
}

export default function ContextCompactionIndicator({
  language = 'en',
}: ContextCompactionIndicatorProps) {
  const contextSummary = useAgentStore(selectContextSummary)
  const setContextSummary = useAgentStore(state => state.setContextSummary)
  const messages = useAgentStore(selectMessages)
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)

  // 使用 useMemo 缓存 stats，避免每次渲染都调用
  const stats = useMemo(() => contextCompactionService.getStats(), [contextSummary])

  const handleForceCompact = useCallback(async () => {
    setIsCompacting(true)
    try {
      const summary = await contextCompactionService.forceCompaction(messages)
      if (summary) {
        setContextSummary(summary)
      }
    } finally {
      setIsCompacting(false)
    }
  }, [messages, setContextSummary])

  const handleClearSummary = useCallback(() => {
    contextCompactionService.clearSummary()
    setContextSummary(null)
  }, [setContextSummary])

  // 没有摘要时显示简化版本
  if (!contextSummary) {
    return (
      <button
        onClick={handleForceCompact}
        disabled={isCompacting || messages.length < 10}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={language === 'zh' ? '压缩对话上下文' : 'Compress conversation context'}
      >
        <Minimize2 className={`w-3 h-3 ${isCompacting ? 'animate-pulse' : ''}`} />
        {isCompacting 
          ? (language === 'zh' ? '压缩中...' : 'Compacting...')
          : (language === 'zh' ? '压缩上下文' : 'Compact')}
      </button>
    )
  }

  return (
    <div className="relative">
      {/* Compact Badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 hover:bg-green-500/20 transition-colors"
      >
        <Minimize2 className="w-3 h-3" />
        <span>{language === 'zh' ? '已压缩' : 'Compacted'}</span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-1 w-80 p-3 rounded-xl bg-surface border border-white/10 shadow-xl z-50 animate-scale-in">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-text-primary">
              {language === 'zh' ? '对话摘要' : 'Conversation Summary'}
            </h4>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForceCompact}
                disabled={isCompacting}
                className="h-6 w-6 hover:bg-white/10"
                title={language === 'zh' ? '重新压缩' : 'Re-compact'}
              >
                <RefreshCw className={`w-3 h-3 ${isCompacting ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSummary}
                className="h-6 w-6 hover:bg-red-500/10 hover:text-red-500"
                title={language === 'zh' ? '清除摘要' : 'Clear summary'}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Summary Content */}
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {contextSummary}
            </p>
          </div>

          {/* Stats */}
          {stats.lastCompactedAt && (
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-text-muted">
              <span>
                {language === 'zh' 
                  ? `已压缩 ${stats.compactedMessageCount} 条消息`
                  : `${stats.compactedMessageCount} messages compacted`}
              </span>
              <span>
                {new Date(stats.lastCompactedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 压缩进度条 - 显示在消息列表顶部
 */
export function CompactionProgressBar({
  language = 'en',
}: {
  language?: 'zh' | 'en'
}) {
  // 使用 store 中的状态，而不是轮询
  const isCompacting = useAgentStore(state => state.isCompacting)

  if (!isCompacting) return null

  return (
    <div className="px-4 py-2 bg-accent/5 border-b border-accent/10">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 relative">
          <div className="absolute inset-0 border-2 border-accent/30 rounded-full" />
          <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-xs text-accent">
          {language === 'zh' ? '正在压缩对话上下文...' : 'Compacting conversation context...'}
        </span>
      </div>
    </div>
  )
}
