/**
 * 内联编辑组件
 * Cmd+K 风格的内联代码修改
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Sparkles, Check, Loader2 } from 'lucide-react'
import { useStore } from '../store'

interface InlineEditProps {
	// 编辑器位置信息
	position: { x: number; y: number }
	// 选中的代码
	selectedCode: string
	// 文件路径
	filePath: string
	// 选中的行范围
	lineRange: [number, number]
	// 关闭回调
	onClose: () => void
	// 应用修改回调
	onApply: (newCode: string) => void
}

type EditState = 'idle' | 'loading' | 'preview' | 'error'

export default function InlineEdit({
	position,
	selectedCode,
	filePath,
	lineRange,
	onClose,
	onApply,
}: InlineEditProps) {
	const [instruction, setInstruction] = useState('')
	const [state, setState] = useState<EditState>('idle')
	const [generatedCode, setGeneratedCode] = useState('')
	const [error, setError] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const { llmConfig } = useStore()

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	const handleSubmit = useCallback(async () => {
		if (!instruction.trim() || state === 'loading') return
		
		setState('loading')
		setError('')
		
		try {
			// 构建提示词
			const prompt = buildEditPrompt(instruction, selectedCode, filePath, lineRange)
			
			// 调用 LLM
			const result = await generateEdit(llmConfig, prompt)
			
			if (result.success && result.code) {
				setGeneratedCode(result.code)
				setState('preview')
			} else {
				setError(result.error || 'Failed to generate code')
				setState('error')
			}
		} catch (err: unknown) {
			const error = err as { message?: string }
			setError(error.message || 'An error occurred')
			setState('error')
		}
	}, [instruction, state, selectedCode, filePath, lineRange, llmConfig])

	const handleApply = useCallback(() => {
		if (generatedCode) {
			onApply(generatedCode)
			onClose()
		}
	}, [generatedCode, onApply, onClose])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			if (state === 'preview') {
				handleApply()
			} else {
				handleSubmit()
			}
		} else if (e.key === 'Escape') {
			onClose()
		}
	}

	return (
		<div
			className="fixed z-50 bg-surface border border-border-subtle rounded-lg shadow-xl overflow-hidden animate-scale-in"
			style={{
				left: position.x,
				top: position.y,
				minWidth: 400,
				maxWidth: 600,
			}}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border-subtle">
				<div className="flex items-center gap-2">
					<Sparkles className="w-4 h-4 text-accent" />
					<span className="text-xs font-medium text-text-primary">Edit Code</span>
					<span className="text-[10px] text-text-muted">
						Lines {lineRange[0]}-{lineRange[1]}
					</span>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-surface-active text-text-muted hover:text-text-primary transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Input */}
			<div className="p-3">
				<input
					ref={inputRef}
					type="text"
					value={instruction}
					onChange={(e) => setInstruction(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Describe the change you want to make..."
					disabled={state === 'loading'}
					className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
				/>
			</div>

			{/* Preview */}
			{state === 'preview' && generatedCode && (
				<div className="px-3 pb-3">
					<div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Preview</div>
					<div className="bg-background rounded-lg border border-border-subtle p-2 max-h-48 overflow-auto">
						<pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
							{generatedCode}
						</pre>
					</div>
				</div>
			)}

			{/* Error */}
			{state === 'error' && error && (
				<div className="px-3 pb-3">
					<div className="p-2 bg-status-error/10 border border-status-error/20 rounded-lg">
						<p className="text-xs text-status-error">{error}</p>
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-t border-border-subtle">
				<span className="text-[10px] text-text-muted">
					{state === 'preview' ? '↵ to apply' : '↵ to generate'}
				</span>
				<div className="flex items-center gap-2">
					{state === 'loading' && (
						<Loader2 className="w-4 h-4 text-accent animate-spin" />
					)}
					{state === 'preview' && (
						<button
							onClick={handleApply}
							className="flex items-center gap-1 px-3 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors"
						>
							<Check className="w-3 h-3" />
							Apply
						</button>
					)}
					{(state === 'idle' || state === 'error') && (
						<button
							onClick={handleSubmit}
							disabled={!instruction.trim()}
							className="flex items-center gap-1 px-3 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Sparkles className="w-3 h-3" />
							Generate
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

/**
 * 构建编辑提示词
 */
function buildEditPrompt(
	instruction: string,
	code: string,
	filePath: string,
	lineRange: [number, number]
): string {
	const lang = filePath.split('.').pop() || 'code'
	
	return `You are a code editor assistant. Edit the following code according to the user's instruction.

File: ${filePath}
Lines: ${lineRange[0]}-${lineRange[1]}

Current code:
\`\`\`${lang}
${code}
\`\`\`

User instruction: ${instruction}

Respond with ONLY the modified code, no explanations or markdown formatting. The code should be ready to replace the original selection.`
}

interface LLMConfigForEdit {
	provider: string
	model: string
	apiKey: string
	baseUrl?: string
}

/**
 * 调用 LLM 生成编辑
 */
async function generateEdit(
	config: LLMConfigForEdit,
	prompt: string
): Promise<{ success: boolean; code?: string; error?: string }> {
	return new Promise((resolve) => {
		let result = ''
		let resolved = false
		const unsubscribers: (() => void)[] = []

		const cleanup = () => {
			if (!resolved) {
				resolved = true
				unsubscribers.forEach(unsub => unsub())
			}
		}

		// 监听流式响应
		unsubscribers.push(
			window.electronAPI.onLLMStream((chunk) => {
				if (chunk.type === 'text' && chunk.content) {
					result += chunk.content
				}
			})
		)

		// 监听完成
		unsubscribers.push(
			window.electronAPI.onLLMDone(() => {
				cleanup()
				// 清理可能的 markdown 代码块
				let code = result.trim()
				if (code.startsWith('```')) {
					code = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
				}
				resolve({ success: true, code })
			})
		)

		// 监听错误
		unsubscribers.push(
			window.electronAPI.onLLMError((error) => {
				cleanup()
				resolve({ success: false, error: error.message })
			})
		)

		// 超时
		setTimeout(() => {
			if (!resolved) {
				cleanup()
				resolve({ success: false, error: 'Request timeout' })
			}
		}, 60000)

		// 发送请求
		window.electronAPI.sendMessage({
			config,
			messages: [{ role: 'user', content: prompt }],
			systemPrompt: 'You are a helpful code editor assistant. Respond only with code, no explanations.',
		}).catch((err) => {
			if (!resolved) {
				cleanup()
				resolve({ success: false, error: err.message })
			}
		})
	})
}
