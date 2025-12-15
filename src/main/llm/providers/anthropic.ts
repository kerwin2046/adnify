/**
 * Anthropic Provider
 * 支持 Claude 系列模型
 */

import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider } from './base'
import { ChatParams, ToolDefinition, ToolCall } from '../types'

export class AnthropicProvider extends BaseProvider {
	private client: Anthropic

	constructor(apiKey: string) {
		super('Anthropic')
		this.log('info', 'Initializing')
		this.client = new Anthropic({ apiKey })
	}

	private convertTools(tools?: ToolDefinition[]): Anthropic.Tool[] | undefined {
		if (!tools?.length) return undefined
		return tools.map(tool => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.parameters as Anthropic.Tool['input_schema'],
		}))
	}

	async chat(params: ChatParams): Promise<void> {
		const { model, messages, tools, systemPrompt, signal, onStream, onToolCall, onComplete, onError } = params

		try {
			this.log('info', 'Starting chat', { model, messageCount: messages.length })

			// 构建消息
			const anthropicMessages: Anthropic.MessageParam[] = []

			for (const msg of messages) {
				if (msg.role === 'tool') {
					anthropicMessages.push({
						role: 'user',
						content: [{
							type: 'tool_result',
							tool_use_id: msg.toolCallId!,
							content: msg.content,
						}]
					})
				} else if (msg.role === 'assistant' && msg.toolName) {
					anthropicMessages.push({
						role: 'assistant',
						content: [{
							type: 'tool_use',
							id: msg.toolCallId!,
							name: msg.toolName,
							input: JSON.parse(msg.content),
						}]
					})
				} else if (msg.role === 'user' || msg.role === 'assistant') {
					anthropicMessages.push({
						role: msg.role,
						content: msg.content,
					})
				}
			}

			// 发起流式请求
			const stream = this.client.messages.stream({
				model,
				max_tokens: 8192,
				system: systemPrompt,
				messages: anthropicMessages,
				tools: this.convertTools(tools),
			}, { signal })

			let fullContent = ''
			const toolCalls: ToolCall[] = []

			// 监听文本流
			stream.on('text', (text) => {
				fullContent += text
				onStream({ type: 'text', content: text })
			})

			// 等待完成并提取工具调用
			const finalMessage = await stream.finalMessage()

			for (const block of finalMessage.content) {
				if (block.type === 'tool_use') {
					const toolCall: ToolCall = {
						id: block.id,
						name: block.name,
						arguments: block.input as Record<string, unknown>,
					}
					toolCalls.push(toolCall)
					onToolCall(toolCall)
				}
			}

			this.log('info', 'Chat complete', {
				contentLength: fullContent.length,
				toolCallCount: toolCalls.length
			})

			onComplete({
				content: fullContent,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				usage: {
					promptTokens: finalMessage.usage.input_tokens,
					completionTokens: finalMessage.usage.output_tokens,
					totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
				}
			})

		} catch (error: unknown) {
			const llmError = this.parseError(error)
			this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
			onError(llmError)
		}
	}
}
