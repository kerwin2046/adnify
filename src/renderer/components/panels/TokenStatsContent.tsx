/**
 * Token 统计面板内容
 * 显示会话的 Token 使用详情
 */

import { Coins, Zap, AlertTriangle } from 'lucide-react'
import { TokenUsage } from '@renderer/agent/types'

interface TokenStatsContentProps {
  totalUsage: TokenUsage
  lastUsage?: TokenUsage
  language?: 'zh' | 'en'
}

export default function TokenStatsContent({
  totalUsage,
  lastUsage,
  language = 'en',
}: TokenStatsContentProps) {
  const isHighUsage = totalUsage.totalTokens > 100000
  const isMediumUsage = totalUsage.totalTokens > 50000

  const formatNumber = (n: number) => n.toLocaleString()
  const formatK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()

  return (
    <div className="p-4 space-y-4">
      {/* 总计卡片 */}
      <div className={`p-4 rounded-xl border ${
        isHighUsage 
          ? 'bg-orange-500/10 border-orange-500/30' 
          : isMediumUsage 
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-accent/10 border-accent/30'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              isHighUsage ? 'bg-orange-500/20' : isMediumUsage ? 'bg-yellow-500/20' : 'bg-accent/20'
            }`}>
              <Coins className={`w-4 h-4 ${
                isHighUsage ? 'text-orange-400' : isMediumUsage ? 'text-yellow-400' : 'text-accent'
              }`} />
            </div>
            <span className="text-sm font-medium text-text-primary">
              {language === 'zh' ? '会话累计' : 'Session Total'}
            </span>
          </div>
          <span className={`text-2xl font-bold font-mono ${
            isHighUsage ? 'text-orange-400' : isMediumUsage ? 'text-yellow-400' : 'text-accent'
          }`}>
            {formatK(totalUsage.totalTokens)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              {language === 'zh' ? '输入' : 'Prompt'}
            </div>
            <div className="text-sm font-mono text-text-primary">
              {formatNumber(totalUsage.promptTokens)}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              {language === 'zh' ? '输出' : 'Completion'}
            </div>
            <div className="text-sm font-mono text-text-primary">
              {formatNumber(totalUsage.completionTokens)}
            </div>
          </div>
        </div>
      </div>

      {/* 最近请求 */}
      {lastUsage && (
        <div className="p-3 rounded-xl bg-surface-hover border border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-text-secondary">
              {language === 'zh' ? '最近一次请求' : 'Last Request'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">
              {language === 'zh' ? '输入' : 'In'}: <span className="font-mono text-text-primary">{formatNumber(lastUsage.promptTokens)}</span>
            </span>
            <span className="text-text-muted">
              {language === 'zh' ? '输出' : 'Out'}: <span className="font-mono text-text-primary">{formatNumber(lastUsage.completionTokens)}</span>
            </span>
          </div>
        </div>
      )}

      {/* 高使用量警告 */}
      {isHighUsage && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-orange-300">
            {language === 'zh' 
              ? 'Token 使用量较高，建议新建会话以获得更好的响应质量和速度。'
              : 'High token usage detected. Consider starting a new session for better response quality and speed.'}
          </div>
        </div>
      )}

      {/* 使用量进度条 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>{language === 'zh' ? '上下文使用率' : 'Context Usage'}</span>
          <span>{Math.min(100, Math.round(totalUsage.totalTokens / 2000)).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isHighUsage 
                ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                : isMediumUsage 
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-accent to-green-400'
            }`}
            style={{ width: `${Math.min(100, totalUsage.totalTokens / 2000)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
