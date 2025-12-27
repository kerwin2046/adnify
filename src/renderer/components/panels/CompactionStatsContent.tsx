/**
 * 压缩统计面板内容
 * 显示上下文压缩的摘要和统计信息
 */

import { Minimize2, RefreshCw, Trash2, FileText, Clock, Hash } from 'lucide-react'
import { useAgentStore, selectContextSummary, selectMessages, contextCompactionService } from '@/renderer/agent'
import { Button } from '../ui'
import { useState, useCallback, useMemo } from 'react'

interface CompactionStatsContentProps {
  language?: 'zh' | 'en'
}

export default function CompactionStatsContent({
  language = 'en',
}: CompactionStatsContentProps) {
  const contextSummary = useAgentStore(selectContextSummary)
  const setContextSummary = useAgentStore(state => state.setContextSummary)
  const messages = useAgentStore(selectMessages)
  const isCompacting = useAgentStore(state => state.isCompacting)
  
  const [isRecompacting, setIsRecompacting] = useState(false)

  const stats = useMemo(() => contextCompactionService.getStats(), [contextSummary])

  const handleForceCompact = useCallback(async () => {
    setIsRecompacting(true)
    try {
      const summary = await contextCompactionService.forceCompaction(messages)
      if (summary) {
        setContextSummary(summary)
      }
    } finally {
      setIsRecompacting(false)
    }
  }, [messages, setContextSummary])

  const handleClearSummary = useCallback(() => {
    contextCompactionService.clearSummary()
    setContextSummary(null)
  }, [setContextSummary])

  const summaryLength = contextSummary?.length || 0

  return (
    <div className="p-4 space-y-4">
      {/* 状态卡片 */}
      <div className={`p-4 rounded-xl border ${
        isCompacting 
          ? 'bg-yellow-500/10 border-yellow-500/30' 
          : contextSummary 
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-surface-hover border-border-subtle'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              isCompacting ? 'bg-yellow-500/20' : contextSummary ? 'bg-green-500/20' : 'bg-white/5'
            }`}>
              <Minimize2 className={`w-4 h-4 ${
                isCompacting ? 'text-yellow-400 animate-pulse' : contextSummary ? 'text-green-400' : 'text-text-muted'
              }`} />
            </div>
            <span className="text-sm font-medium text-text-primary">
              {isCompacting 
                ? (language === 'zh' ? '正在压缩...' : 'Compacting...')
                : contextSummary 
                  ? (language === 'zh' ? '已压缩' : 'Compacted')
                  : (language === 'zh' ? '未压缩' : 'Not Compacted')
              }
            </span>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleForceCompact}
              disabled={isCompacting || isRecompacting || messages.length < 10}
              className="h-7 w-7 hover:bg-white/10"
              title={language === 'zh' ? '重新压缩' : 'Re-compact'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecompacting ? 'animate-spin' : ''}`} />
            </Button>
            {contextSummary && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSummary}
                className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400"
                title={language === 'zh' ? '清除摘要' : 'Clear summary'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-black/20">
            <div className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider mb-1">
              <Hash className="w-3 h-3" />
              {language === 'zh' ? '字符数' : 'Chars'}
            </div>
            <div className="text-sm font-mono text-text-primary">
              {summaryLength.toLocaleString()}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider mb-1">
              <FileText className="w-3 h-3" />
              {language === 'zh' ? '已压缩' : 'Compacted'}
            </div>
            <div className="text-sm font-mono text-text-primary">
              {stats.compactedMessageCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider mb-1">
              <Clock className="w-3 h-3" />
              {language === 'zh' ? '时间' : 'Time'}
            </div>
            <div className="text-sm font-mono text-text-primary">
              {stats.lastCompactedAt 
                ? new Date(stats.lastCompactedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '-'
              }
            </div>
          </div>
        </div>
      </div>

      {/* 摘要内容 */}
      {contextSummary ? (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {language === 'zh' ? '摘要内容' : 'Summary Content'}
          </h4>
          <div className="max-h-40 overflow-y-auto custom-scrollbar p-3 rounded-xl bg-black/20 border border-border-subtle">
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {contextSummary}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-text-muted text-xs">
          {language === 'zh' 
            ? '对话尚未压缩。当上下文超过阈值时会自动压缩。'
            : 'Conversation not yet compacted. Will auto-compact when context exceeds threshold.'
          }
        </div>
      )}
    </div>
  )
}
