import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Send, Sparkles,
  Trash2, StopCircle,
  FileText, AlertTriangle,
  History
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore, Message } from '../store'
import { useAgent } from '../hooks/useAgent'

import ToolCallCard from './ToolCallCard'
import SessionList from './SessionList'
import FileMentionPopup from './FileMentionPopup'
import { sessionService } from '../agent/sessionService'
import { checkpointService } from '../agent/checkpointService'


function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  // Requirements 1.6, 3.2: Tool outputs are now embedded within ToolCallCard
  // Hide separate tool messages to avoid duplication
  if (message.role === 'tool') {
      // Return null to hide tool messages - results are shown inline in ToolCallCard
      return null
  }

  return (
    <div className={`
        group flex gap-4 py-6 px-5 transition-colors border-b border-border-subtle/20
        ${isUser ? 'bg-transparent' : 'bg-transparent'}
    `}>
      {/* Avatar */}
      <div className={`
        w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium shadow-sm
        ${isUser 
            ? 'bg-surface text-text-secondary border border-border-subtle' 
            : 'bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow border-none'}
      `}>
        {isUser ? 'You' : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2 mb-2">
             <span className="text-xs font-bold text-text-primary tracking-wide">
                 {isUser ? 'User' : 'Adnify Agent'}
             </span>
             <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                 {new Date(message.timestamp).toLocaleTimeString()}
             </span>
         </div>

        <div className={`text-sm leading-7 text-text-secondary ${isUser ? 'text-text-primary' : ''}`}>
            <ReactMarkdown
              className="prose prose-invert prose-sm max-w-none break-words"
              components={{
                code({ className, children, node, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  // 检查是否是真正的代码块（有语言标识或者是 pre 的子元素）
                  const isCodeBlock = match || (node?.position?.start?.line !== node?.position?.end?.line)
                  // 检查内容是否像代码（包含特殊字符）
                  const content = String(children)
                  const looksLikeCode = /[{}()[\];=<>]/.test(content) || content.includes('\n')
                  const isInline = !isCodeBlock && !looksLikeCode
                  
                  return isInline ? (
                    <code className="bg-surface-active/50 border border-white/5 px-1.5 py-0.5 rounded text-accent font-mono text-xs" {...props}>
                      {children}
                    </code>
                  ) : (
                    <div className="relative group/code my-4 rounded-lg overflow-hidden border border-border-subtle bg-[#0d0d0d] shadow-sm">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                            <span className="text-[10px] text-text-muted font-mono">{match?.[1] || 'code'}</span>
                            {/* Future: Add Copy Button here */}
                        </div>
                        <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match?.[1]}
                            PreTag="div"
                            className="!bg-transparent !p-4 !m-0 !text-xs custom-scrollbar"
                            customStyle={{ background: 'transparent', margin: 0 }}
                            wrapLines={true}
                            wrapLongLines={true} // Prevent horizontal scrolling for long text
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    </div>
                  )
                },
                p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-4 mb-3 space-y-1 marker:text-text-muted">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-4 mb-3 space-y-1 marker:text-text-muted">{children}</ol>,
                a: ({href, children}) => <a href={href} target="_blank" className="text-accent hover:underline">{children}</a>,
                blockquote: ({children}) => <blockquote className="border-l-2 border-accent/50 pl-4 py-1 my-2 bg-accent/5 italic text-text-muted rounded-r">{children}</blockquote>
              }}
            >
              {message.content}
            </ReactMarkdown>
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1 align-middle rounded-sm" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const {
    chatMode, setChatMode, messages, isStreaming, currentToolCalls,
    clearMessages, llmConfig, pendingToolCall,
    setCurrentSessionId, addMessage, workspacePath, openFile, setActiveFile
  } = useStore()
  const {
    sendMessage,
    abort,
    approveCurrentTool,
    rejectCurrentTool,
  } = useAgent()

  // 处理工具调用中的文件点击 - 打开文件并显示 diff
  // Requirements: 1.2, 1.3 - 点击文件名打开文件并显示 diff
  const handleToolFileClick = useCallback(async (filePath: string) => {
    // 解析完整路径
    let fullPath = filePath
    if (workspacePath && !filePath.startsWith('/') && !filePath.match(/^[a-zA-Z]:/)) {
      const sep = workspacePath.includes('\\') ? '\\' : '/'
      fullPath = `${workspacePath}${sep}${filePath}`
    }
    
    // 读取当前文件内容
    const currentContent = await window.electronAPI.readFile(fullPath)
    if (currentContent === null) {
      console.warn('[ToolFileClick] Failed to read file:', fullPath)
      return
    }
    
    // 从 checkpointService 获取检查点（这是实际存储快照的地方）
    const serviceCheckpoints = checkpointService.getCheckpoints()
    // 同时也检查 store 中的检查点
    const { checkpoints: storeCheckpoints } = useStore.getState()
    const allCheckpoints = [...serviceCheckpoints, ...storeCheckpoints]
    
    console.log('[ToolFileClick] Looking for file:', filePath, 'fullPath:', fullPath)
    console.log('[ToolFileClick] Total checkpoints:', allCheckpoints.length)
    
    let originalContent: string | undefined
    
    // 规范化路径函数
    const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase()
    const normalizedFullPath = normalizePath(fullPath)
    const normalizedFilePath = normalizePath(filePath)
    
    // 从最新的检查点开始查找
    for (let i = allCheckpoints.length - 1; i >= 0; i--) {
      const checkpoint = allCheckpoints[i]
      if (!checkpoint.snapshots) continue
      
      const snapshotPaths = Object.keys(checkpoint.snapshots)
      console.log('[ToolFileClick] Checkpoint', i, 'has snapshots:', snapshotPaths)
      
      for (const snapshotPath of snapshotPaths) {
        const normalizedSnapshotPath = normalizePath(snapshotPath)
        
        // 精确匹配或路径结尾匹配
        if (normalizedSnapshotPath === normalizedFullPath ||
            normalizedSnapshotPath === normalizedFilePath ||
            normalizedSnapshotPath.endsWith('/' + normalizedFilePath) ||
            normalizedFullPath.endsWith('/' + normalizePath(snapshotPath.split(/[/\\]/).pop() || ''))) {
          originalContent = checkpoint.snapshots[snapshotPath].content
          console.log('[ToolFileClick] Found match! snapshotPath:', snapshotPath)
          break
        }
      }
      if (originalContent) break
    }
    
    console.log('[ToolFileClick] Original content found:', !!originalContent)
    console.log('[ToolFileClick] Content differs:', originalContent !== currentContent)
    
    // 如果找到原始内容且与当前内容不同，显示 diff 视图
    if (originalContent && originalContent !== currentContent) {
      openFile(fullPath, currentContent, originalContent)
    } else {
      // 否则正常打开文件
      openFile(fullPath, currentContent)
    }
    setActiveFile(fullPath)
  }, [workspacePath, openFile, setActiveFile])
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [showFileMention, setShowFileMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // 检测输入中的 @file 引用
  const fileRefs = useMemo(() => {
    const refs: string[] = []
    const regex = /@(?:file:)?([^\s@]+\.[a-zA-Z0-9]+)/g
    let match
    while ((match = regex.exec(input)) !== null) {
      refs.push(match[1])
    }
    return refs
  }, [input])

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation() // Critical to prevent parent handlers
      setIsDragging(false)
      
      let paths: string[] = []

      // 1. Try internal drag (Sidebar)
      const internalPath = e.dataTransfer.getData('application/adnify-file-path')
      if (internalPath) {
          paths.push(internalPath)
      } else {
          // 2. Try external drag (System)
          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0) {
             // Electron exposes 'path' on File objects
             paths = files.map(f => (f as File & { path?: string }).path).filter((p): p is string => Boolean(p))
          }
      }
      
      if (paths.length > 0) {
          setInput(prev => {
              const prefix = prev.trim() ? prev + ' ' : ''
              // Convert absolute paths to simple filenames or relative paths if possible
              // For now, let's use the basename to keep it clean in the UI, 
              // assuming the agent can handle fuzzy matching or we have full path in context context.
              // BUT, to be safe, let's use the full path but maybe show it shorter later?
              // The current logic expects just the name for Mentions to trigger, but here we are direct inserting.
              // Let's insert basename for readability, and let the Agent resolve it, OR
              // if we want to be precise, use the full path.
              // Let's use basename for UX (like @App.tsx), assuming unique names for now.
              const mentions = paths.map(p => {
                  const name = p.split(/[/\\]/).pop()
                  return `@${name}` 
              }).join(' ')
              return prefix + mentions + ' '
          })
          textareaRef.current?.focus()
      }
  }, [])

  // 检测 @ 触发
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setInput(value)

    // 检查光标前是否有未完成的 @ 引用
    const textBeforeCursor = value.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      if (inputContainerRef.current) {
        const rect = inputContainerRef.current.getBoundingClientRect()
        setMentionPosition({ x: rect.left + 16, y: rect.top - 200 }) // Position above input
      }
      setShowFileMention(true)
    } else {
      setShowFileMention(false)
      setMentionQuery('')
    }
  }, [])

  // 选择文件引用
  const handleSelectFile = useCallback((filePath: string) => {
    const cursorPos = textareaRef.current?.selectionStart || input.length
    const textBeforeCursor = input.slice(0, cursorPos)
    const textAfterCursor = input.slice(cursorPos)
    
    // 找到 @ 的位置并替换
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex !== -1) {
      const newInput = textBeforeCursor.slice(0, atIndex) + '@' + filePath + ' ' + textAfterCursor
      setInput(newInput)
    }
    
    setShowFileMention(false)
    setMentionQuery('')
    textareaRef.current?.focus()
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolCalls])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    const userMessage = input.trim()
    setInput('')
    await sendMessage(userMessage)
  }, [input, isStreaming, sendMessage])

  const handleLoadSession = useCallback(async (sessionId: string) => {
    const session = await sessionService.getSession(sessionId)
    if (session) {
      clearMessages()
      setChatMode(session.mode)
      session.messages.forEach(msg => {
        addMessage({
          role: msg.role,
          content: msg.content,
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
        })
      })
      setCurrentSessionId(sessionId)
      setShowSessions(false)
    }
  }, [clearMessages, setChatMode, addMessage, setCurrentSessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果文件选择弹窗打开，不处理回车（让弹窗处理）
    if (showFileMention) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFileMention(false)
        setMentionQuery('')
      }
      // Enter, ArrowUp, ArrowDown 由 FileMentionPopup 处理
      if (['Enter', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
        e.preventDefault()
        return
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasApiKey = !!llmConfig.apiKey

  return (
    <div 
        className={`w-[450px] flex flex-col relative z-10 border-l border-border bg-[#09090b] transition-colors ${isDragging ? 'bg-accent/5 ring-2 ring-inset ring-accent' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-background/50 backdrop-blur-sm z-20">
        <div className="flex bg-surface rounded-lg p-0.5 border border-border-subtle">
            <button
            onClick={() => setChatMode('chat')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                chatMode === 'chat'
                ? 'bg-background text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            >
            Chat
            </button>
            <button
            onClick={() => setChatMode('agent')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                chatMode === 'agent'
                ? 'text-accent bg-accent/10 shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            >
            Agent
            </button>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className={`p-1.5 rounded-md hover:bg-surface-hover transition-colors ${showSessions ? 'text-accent' : 'text-text-muted'}`}
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
           <button
            onClick={clearMessages}
            className="p-1.5 rounded-md hover:bg-surface-hover hover:text-status-error transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Overlays */}
      {showSessions && (
        <div className="absolute top-12 right-0 left-0 bottom-0 bg-background/95 backdrop-blur-md z-30 overflow-hidden animate-slide-in p-4">
          <SessionList 
            onClose={() => setShowSessions(false)} 
            onLoadSession={handleLoadSession}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-0 pb-4 bg-background">
        {!hasApiKey && (
          <div className="m-4 p-4 border border-warning/20 bg-warning/5 rounded-lg flex gap-3">
             <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
             <div>
                <span className="font-medium text-sm text-warning block mb-1">Setup Required</span>
                <p className="text-xs text-text-muted leading-relaxed">Please configure your LLM provider settings (API Key) to start using the assistant.</p>
             </div>
          </div>
        )}

        {messages.length === 0 && hasApiKey && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 select-none pointer-events-none gap-4">
             <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-text-muted" />
             </div>
             <p className="text-sm font-medium">How can I help you code today?</p>
          </div>
        )}

        <div className="divide-y divide-border-subtle/20">
            {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
            ))}
        </div>

        {/* Current Tool Calls Area - 使用新的 ToolCallCard */}
        {currentToolCalls.length > 0 && (
            <div className="px-4 py-2 space-y-1.5 animate-fade-in">
                {currentToolCalls.map((toolCall) => (
                    <ToolCallCard
                      key={toolCall.id}
                      toolCall={toolCall}
                      onApprove={pendingToolCall?.id === toolCall.id ? approveCurrentTool : undefined}
                      onReject={pendingToolCall?.id === toolCall.id ? rejectCurrentTool : undefined}
                      onFileClick={handleToolFileClick}
                    />
                ))}
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Mention Popup */}
      {showFileMention && (
        <FileMentionPopup
          position={mentionPosition}
          searchQuery={mentionQuery}
          onSelect={handleSelectFile}
          onClose={() => {
            setShowFileMention(false)
            setMentionQuery('')
          }}
        />
      )}

      {/* Input Area */}
      <div ref={inputContainerRef} className="p-4 bg-background border-t border-border z-20">
        <div className={`
            relative group rounded-xl border transition-all duration-200
            ${isStreaming 
                ? 'border-accent/50 bg-accent/5' 
                : 'border-border-subtle bg-surface focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 focus-within:shadow-glow'}
        `}>
          
          {/* File Chips */}
          {fileRefs.length > 0 && (
             <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                {fileRefs.map((ref, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-[10px] font-medium rounded-full border border-accent/20 animate-fade-in">
                        <FileText className="w-3 h-3" />
                        {ref}
                    </span>
                ))}
             </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Ask anything... (Type @ to add context)" : "Configure API Key..."}
            disabled={!hasApiKey || !!pendingToolCall}
            className="w-full bg-transparent border-none rounded-xl px-4 py-3 pr-12
                     text-sm text-text-primary placeholder-text-muted/60 resize-none
                     focus:ring-0 focus:outline-none leading-relaxed"
            rows={1}
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />
          
          <div className="absolute right-2 bottom-2">
            <button
                onClick={isStreaming ? abort : handleSubmit}
                disabled={!hasApiKey || (!input.trim() && !isStreaming) || !!pendingToolCall}
                className={`p-2 rounded-lg transition-all flex items-center justify-center
                ${isStreaming
                    ? 'bg-status-error/10 text-status-error hover:bg-status-error/20'
                    : input.trim() 
                        ? 'bg-accent text-white shadow-glow hover:bg-accent-hover' 
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}
                `}
            >
                {isStreaming ? (
                <StopCircle className="w-4 h-4" />
                ) : (
                <Send className="w-4 h-4" />
                )}
            </button>
          </div>
        </div>
        
        <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                {chatMode === 'agent' && (
                    <span className="flex items-center gap-1 text-accent">
                        <Sparkles className="w-3 h-3" />
                        Agent Mode
                    </span>
                )}
            </div>
            <span className="text-[10px] text-text-muted opacity-50 font-mono">
                RETURN to send
            </span>
        </div>
      </div>
    </div>
  )
}
