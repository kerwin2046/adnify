import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Send, Bot, Sparkles,
  Trash2, StopCircle, Terminal, FileEdit, Search,
  FolderOpen, FileText, Check, X, AlertTriangle,
  FolderTree, History, Loader2, ChevronDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore, Message, ToolCall } from '../store'
import { useAgent } from '../hooks/useAgent'

import ToolResultViewer from './ToolResultViewer'
import SessionList from './SessionList'
import FileMentionPopup from './FileMentionPopup'
import { sessionService } from '../agent/sessionService'
import DiffViewer from './DiffViewer'
import { parseSearchReplaceBlocks, applySearchReplaceBlocks } from '../agent/tools'

const ToolIcon = ({ name }: { name: string }) => {
  const icons: Record<string, typeof Terminal> = {
    read_file: FileText,
    write_file: FileEdit,
    edit_file: FileEdit,
    search_files: Search,
    search_in_file: Search,
    list_directory: FolderOpen,
    get_dir_tree: FolderTree,
    create_file_or_folder: FolderOpen,
    delete_file_or_folder: Trash2,
    run_command: Terminal,
    open_terminal: Terminal,
    run_in_terminal: Terminal,
    get_terminal_output: Terminal,
    list_terminals: Terminal,
    get_lint_errors: AlertTriangle,
  }
  const Icon = icons[name] || Terminal
  return <Icon className="w-3.5 h-3.5" />
}

function ToolCallDisplay({
  toolCall,
  onApprove,
  onReject,
}: {
  toolCall: ToolCall
  onApprove?: () => void
  onReject?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isAwaiting = toolCall.status === 'awaiting_user'
  const { workspacePath } = useStore()
  
  // Preview state
  const [previewData, setPreviewData] = useState<{ original: string, modified: string, path: string } | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Auto-expand if awaiting approval
  useEffect(() => {
    if (isAwaiting) setExpanded(true)
  }, [isAwaiting])

  // Load preview data for edit/write operations
  useEffect(() => {
    const loadPreview = async () => {
      if (toolCall.name !== 'edit_file' && toolCall.name !== 'write_file') return
      
      const args = toolCall.arguments as any
      const relPath = args.path
      if (!relPath) return

      // Simple path resolution
      let fullPath = relPath
      if (workspacePath && !relPath.startsWith('/') && !relPath.match(/^[a-zA-Z]:/)) {
        const sep = workspacePath.includes('\\') ? '\\' : '/'
        fullPath = `${workspacePath}${sep}${relPath}`
      }

      setIsPreviewLoading(true)
      try {
        // Read original file (might fail if new file, handle gracefully)
        const originalContent = await window.electronAPI.readFile(fullPath) || ''
        
        let modifiedContent = ''
        if (toolCall.name === 'write_file') {
          modifiedContent = args.content || ''
        } else if (toolCall.name === 'edit_file') {
          const blocks = parseSearchReplaceBlocks(args.search_replace_blocks || '')
          const result = applySearchReplaceBlocks(originalContent, blocks)
          modifiedContent = result.newContent
        }

        setPreviewData({
          original: originalContent,
          modified: modifiedContent,
          path: fullPath
        })
      } catch (e) {
        console.error('Failed to load preview:', e)
      } finally {
        setIsPreviewLoading(false)
      }
    }

    if (expanded && !previewData && (toolCall.name === 'edit_file' || toolCall.name === 'write_file')) {
      loadPreview()
    }
  }, [expanded, toolCall, workspacePath, previewData])


  const getStatusColor = () => {
    switch (toolCall.status) {
        case 'success': return 'text-status-success'
        case 'error': return 'text-status-error'
        case 'awaiting_user': return 'text-warning'
        case 'running': return 'text-accent'
        default: return 'text-text-muted'
    }
  }

  return (
    <div className={`
        group my-2 border rounded-lg transition-all duration-200 overflow-hidden
        ${expanded 
            ? 'bg-surface/40 border-border-subtle shadow-sm' 
            : 'bg-transparent border-transparent hover:bg-surface/20'
        }
    `}>
      {/* Minimized / Header View */}
      <div 
        className={`
            flex items-center gap-2 px-3 py-2 cursor-pointer select-none
            text-xs font-mono transition-colors
            ${expanded ? 'border-b border-border-subtle/50' : ''}
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded ${getStatusColor()} bg-opacity-10`}>
            {toolCall.status === 'running' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
                <ToolIcon name={toolCall.name} />
            )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className={`font-medium ${getStatusColor()}`}>
                {toolCall.name}
            </span>
            {!expanded && (
                <span className="text-text-muted truncate opacity-50 text-[10px]">
                    {JSON.stringify(toolCall.arguments)}
                </span>
            )}
        </div>

        <div className="flex items-center gap-2 text-text-muted">
             {toolCall.status === 'success' && <Check className="w-3 h-3" />}
             {toolCall.status === 'error' && <X className="w-3 h-3" />}
             {isAwaiting && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded animate-pulse">Approval Needed</span>}
             <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
          <div className="p-3 bg-black/20 text-xs">
            {/* Diff Preview for Edits */}
            {previewData ? (
                <div className="mb-3">
                   <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Preview</span>
                   </div>
                   <DiffViewer 
                      originalContent={previewData.original}
                      modifiedContent={previewData.modified}
                      filePath={previewData.path}
                      onAccept={() => {}} // Controlled by outer buttons
                      onReject={() => {}} // Controlled by outer buttons
                   />
                </div>
            ) : (
                /* Standard Arguments View */
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Params</span>
                        {isPreviewLoading && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
                    </div>
                    <pre className="font-mono text-text-secondary bg-black/30 p-2 rounded overflow-x-auto border border-white/5 custom-scrollbar">
                        {JSON.stringify(toolCall.arguments, null, 2)}
                    </pre>
                </div>
            )}

            {/* Approval Actions */}
            {isAwaiting && onApprove && onReject && (
                <div className="flex items-center justify-between gap-3 bg-warning/5 p-3 rounded border border-warning/10 mb-3">
                    <div className="flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4 text-warning" />
                         <span className="text-warning font-medium">Allow execution?</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onReject() }} 
                            className="px-3 py-1.5 rounded bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors">
                            Deny
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onApprove() }} 
                            className="px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover shadow-glow transition-all font-medium">
                            Allow
                        </button>
                    </div>
                </div>
            )}

            {/* Result */}
            {(toolCall.result || toolCall.error) && (
                <div className="animate-fade-in">
                     <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1.5 block">Output</span>
                     <ToolResultViewer toolName={toolCall.name} result={toolCall.result || ''} error={toolCall.error} />
                </div>
            )}
          </div>
      )}
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [showToolOutput, setShowToolOutput] = useState(false)

  // Special handling for tool outputs: Collapse them by default
  if (message.role === 'tool') {
      return (
          <div className="px-4 py-2 group">
              <div 
                onClick={() => setShowToolOutput(!showToolOutput)}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-hover transition-colors border border-transparent hover:border-border-subtle"
              >
                  <div className="w-5 h-5 rounded bg-surface-active flex items-center justify-center text-text-muted">
                      <Terminal className="w-3 h-3" />
                  </div>
                  <span className="text-xs text-text-muted font-medium flex-1">
                      Tool Output <span className="opacity-50">({message.content.length} chars)</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showToolOutput ? 'rotate-180' : ''}`} />
              </div>
              
              {showToolOutput && (
                  <div className="mt-2 ml-2 pl-4 border-l-2 border-border-subtle">
                      <ToolResultViewer toolName={message.toolName || 'Tool'} result={message.content} />
                  </div>
              )}
          </div>
      )
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
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const inline = !match
                  return inline ? (
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
    setCurrentSessionId, addMessage
  } = useStore()
  const {
    sendMessage,
    abort,
    approveCurrentTool,
    rejectCurrentTool,
  } = useAgent()
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

        {/* Current Tool Calls Area */}
        {currentToolCalls.length > 0 && (
            <div className="px-4 py-2 animate-fade-in">
                {currentToolCalls.map((toolCall) => (
                    <ToolCallDisplay
                    key={toolCall.id}
                    toolCall={toolCall}
                    onApprove={pendingToolCall?.id === toolCall.id ? approveCurrentTool : undefined}
                    onReject={pendingToolCall?.id === toolCall.id ? rejectCurrentTool : undefined}
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
