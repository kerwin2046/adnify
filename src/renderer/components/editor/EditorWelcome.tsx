/**
 * 编辑器欢迎页面组件
 */

import { FileCode } from 'lucide-react'
import { useStore } from '@store'
import { t } from '@renderer/i18n'

export function EditorWelcome() {
  const language = useStore((state) => state.language)

  return (
    <div className="h-full flex flex-col bg-transparent relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] opacity-50" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[100px] opacity-30" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-30" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-fade-in p-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6 group">
            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-surface to-surface-active border border-border-subtle flex items-center justify-center shadow-2xl relative z-10 transform group-hover:scale-105 transition-transform duration-500">
              <FileCode className="w-12 h-12 text-accent" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-text-primary to-text-primary/60 mb-3 tracking-tight">
            ADNIFY
          </h1>
          <p className="text-text-muted text-lg font-light tracking-wide opacity-80">
            Advanced AI-Powered Editor
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <QuickActionButton
            icon={<FileCode className="w-5 h-5 text-accent" />}
            iconBg="bg-accent/10 group-hover:bg-accent/20"
            title={t('searchFile', language)}
            subtitle="Search and open files"
            shortcut={['Ctrl', 'P']}
            onClick={() => useStore.getState().setShowQuickOpen(true)}
          />

          <QuickActionButton
            icon={<div className="w-5 h-5 text-purple-400 font-mono font-bold text-center leading-5">{'>'}</div>}
            iconBg="bg-purple-500/10 group-hover:bg-purple-500/20"
            title={t('commandPalette', language)}
            subtitle="Run commands"
            shortcut={['Ctrl', 'Shift', 'P']}
            onClick={() => useStore.getState().setShowCommandPalette(true)}
          />
        </div>

        {/* Footer Hints */}
        <div className="mt-12 flex items-center gap-8 text-xs text-text-muted/60">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-surface/50 border border-border-subtle font-mono">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface/50 border border-border-subtle font-mono">,</kbd>
            <span>Settings</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-text-muted/20" />
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-surface/50 border border-border-subtle font-mono">F12</kbd>
            <span>DevTools</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// 快捷操作按钮
interface QuickActionButtonProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  shortcut: string[]
  onClick: () => void
}

function QuickActionButton({ icon, iconBg, title, subtitle, shortcut, onClick }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-between p-4 rounded-xl bg-surface/30 hover:bg-surface/60 border border-border-subtle hover:border-accent/20 transition-all duration-300 backdrop-blur-sm"
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center transition-colors`}>
          {icon}
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-text-primary group-hover:text-white transition-colors">
            {title}
          </div>
          <div className="text-xs text-text-muted">{subtitle}</div>
        </div>
      </div>
      <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
        {shortcut.map((key, i) => (
          <kbd key={i} className="h-6 px-2 rounded bg-surface/50 border border-border-subtle text-[10px] font-mono flex items-center text-text-muted">
            {key}
          </kbd>
        ))}
      </div>
    </button>
  )
}
