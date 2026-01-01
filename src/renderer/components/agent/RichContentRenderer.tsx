/**
 * 富内容渲染器
 * 统一渲染工具返回的各种内容类型：文本、图片、代码、JSON、Markdown、HTML、文件、链接、表格
 */

import { useState, useMemo, memo } from 'react'
import {
  Image as ImageIcon, Code, FileText, Link as LinkIcon,
  Table, Copy, Check, ExternalLink, Download, Maximize2, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ToolRichContent } from '@/shared/types'
import { JsonHighlight } from '@utils/jsonHighlight'

interface RichContentRendererProps {
  content: ToolRichContent[]
  maxHeight?: string
  className?: string
}

/**
 * 富内容渲染器组件
 */
export const RichContentRenderer = memo(function RichContentRenderer({
  content,
  maxHeight = 'max-h-96',
  className = '',
}: RichContentRendererProps) {
  if (!content || content.length === 0) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {content.map((item, index) => (
        <RichContentItem key={index} item={item} maxHeight={maxHeight} />
      ))}
    </div>
  )
})

/**
 * 单个富内容项渲染
 */
const RichContentItem = memo(function RichContentItem({
  item,
  maxHeight,
}: {
  item: ToolRichContent
  maxHeight: string
}) {
  switch (item.type) {
    case 'image':
      return <ImageContent item={item} />
    case 'code':
      return <CodeContent item={item} maxHeight={maxHeight} />
    case 'json':
      return <JsonContent item={item} maxHeight={maxHeight} />
    case 'markdown':
      return <MarkdownContent item={item} maxHeight={maxHeight} />
    case 'html':
      return <HtmlContent item={item} maxHeight={maxHeight} />
    case 'file':
      return <FileContent item={item} />
    case 'link':
      return <LinkContent item={item} />
    case 'table':
      return <TableContent item={item} maxHeight={maxHeight} />
    case 'text':
    default:
      return <TextContent item={item} maxHeight={maxHeight} />
  }
})

// =================== 图片内容 ===================

function ImageContent({ item }: { item: ToolRichContent }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const imageSrc = useMemo(() => {
    if (!item.data) return null
    const mimeType = item.mimeType || 'image/png'
    // 检查是否已经是完整的 data URL
    if (item.data.startsWith('data:')) {
      return item.data
    }
    return `data:${mimeType};base64,${item.data}`
  }, [item.data, item.mimeType])

  if (!imageSrc) {
    return (
      <div className="p-3 bg-black/20 rounded-md border border-white/5 text-text-muted text-xs">
        [Image: No data available]
      </div>
    )
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = imageSrc
    link.download = item.title || 'image.png'
    link.click()
  }

  const handleCopy = async () => {
    try {
      const response = await fetch(imageSrc)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: copy base64 string
      navigator.clipboard.writeText(item.data || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
          <span className="text-text-muted flex items-center gap-2 text-xs">
            <ImageIcon className="w-3 h-3" />
            {item.title || 'Image'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
              title="Copy image"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
              title="Download"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
              title="Expand"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {/* Image Preview */}
        <div className="p-2 flex justify-center bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#222_0%_50%)] bg-[length:16px_16px]">
          <img
            src={imageSrc}
            alt={item.title || 'Tool result image'}
            className="max-w-full max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsExpanded(true)}
          />
        </div>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={imageSrc}
                alt={item.title || 'Tool result image'}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
              <button
                onClick={() => setIsExpanded(false)}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// =================== 代码内容 ===================

function CodeContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-black/30 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <Code className="w-3 h-3" />
          {item.language || 'Code'}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className={`p-3 overflow-auto ${maxHeight} text-xs font-mono text-text-secondary custom-scrollbar`}>
        <code>{item.text}</code>
      </pre>
    </div>
  )
}

// =================== JSON 内容 ===================

function JsonContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <Code className="w-3 h-3" />
          JSON
        </span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <div className={`overflow-auto ${maxHeight} p-2 custom-scrollbar`}>
        <JsonHighlight data={item.text} maxHeight={maxHeight} maxLength={5000} />
      </div>
    </div>
  )
}

// =================== Markdown 内容 ===================

function MarkdownContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 简单的 Markdown 渲染（可以后续替换为更完整的渲染器）
  const renderedContent = useMemo(() => {
    if (!item.text) return ''
    return item.text
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-sm font-semibold text-text-primary mt-3 mb-1">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-base font-semibold text-text-primary mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-lg font-bold text-text-primary mt-4 mb-2">$1</h1>')
      // Bold & Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      // Code
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-accent font-mono text-xs">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-accent hover:underline">$1</a>')
      // Line breaks
      .replace(/\n/g, '<br/>')
  }, [item.text])

  return (
    <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <FileText className="w-3 h-3" />
          Markdown
        </span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <div
        className={`p-3 overflow-auto ${maxHeight} text-sm text-text-secondary prose prose-invert prose-sm max-w-none custom-scrollbar`}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  )
}

// =================== HTML 内容 ===================

function HtmlContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <Code className="w-3 h-3" />
          HTML
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              showRaw ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
          >
            {showRaw ? 'Preview' : 'Raw'}
          </button>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className={`overflow-auto ${maxHeight} custom-scrollbar`}>
        {showRaw ? (
          <pre className="p-3 text-xs font-mono text-text-secondary">
            <code>{item.text}</code>
          </pre>
        ) : (
          <div
            className="p-3 text-sm text-text-secondary"
            dangerouslySetInnerHTML={{ __html: item.text || '' }}
          />
        )}
      </div>
    </div>
  )
}

// =================== 文件内容 ===================

function FileContent({ item }: { item: ToolRichContent }) {
  const fileName = item.title || item.uri?.split(/[/\\]/).pop() || 'File'

  const handleOpen = async () => {
    if (item.uri) {
      // 读取文件内容并在编辑器中打开
      const content = await window.electronAPI?.readFile?.(item.uri)
      if (content !== null) {
        const { useStore } = await import('@store')
        useStore.getState().openFile(item.uri, content)
        useStore.getState().setActiveFile(item.uri)
      }
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-3 bg-black/20 rounded-md border border-white/5 hover:bg-black/30 cursor-pointer transition-colors"
      onClick={handleOpen}
    >
      <div className="p-2 bg-white/5 rounded-md">
        <FileText className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{fileName}</div>
        {item.uri && (
          <div className="text-xs text-text-muted truncate">{item.uri}</div>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-text-muted" />
    </div>
  )
}

// =================== 链接内容 ===================

function LinkContent({ item }: { item: ToolRichContent }) {
  const handleOpen = () => {
    if (item.url) {
      window.open(item.url, '_blank')
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-3 bg-black/20 rounded-md border border-white/5 hover:bg-black/30 cursor-pointer transition-colors group"
      onClick={handleOpen}
    >
      <div className="p-2 bg-accent/10 rounded-md">
        <LinkIcon className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-accent group-hover:underline truncate">
          {item.title || item.url}
        </div>
        {item.title && item.url && (
          <div className="text-xs text-text-muted truncate">{item.url}</div>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
    </div>
  )
}

// =================== 表格内容 ===================

function TableContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!item.tableData) return
    const { headers, rows } = item.tableData
    const csv = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n')
    navigator.clipboard.writeText(csv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!item.tableData) {
    return <TextContent item={item} maxHeight={maxHeight} />
  }

  const { headers, rows } = item.tableData

  return (
    <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <Table className="w-3 h-3" />
          Table ({rows.length} rows)
        </span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
          title="Copy as TSV"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <div className={`overflow-auto ${maxHeight} custom-scrollbar`}>
        <table className="w-full text-xs">
          <thead className="bg-white/5 sticky top-0">
            <tr>
              {headers.map((header, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-text-secondary border-b border-white/5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-text-muted border-b border-white/5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =================== 文本内容 ===================

function TextContent({ item, maxHeight }: { item: ToolRichContent; maxHeight: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Result</span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className={`p-3 overflow-auto ${maxHeight} text-xs font-mono text-text-secondary whitespace-pre-wrap break-all custom-scrollbar`}>
        {item.text}
      </pre>
    </div>
  )
}

export default RichContentRenderer
