/**
 * 上下文管理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ContextManager } from '@renderer/agent/context/ContextManager'
import { estimateTokens, estimateMessageTokens } from '@renderer/agent/context/TokenEstimator'
import { truncateToolResult, truncateMessage } from '@renderer/agent/context/MessageTruncator'
import type { OpenAIMessage } from '@renderer/agent/llm/MessageConverter'

// 辅助函数
function createUserMessage(content: string): OpenAIMessage {
  return { role: 'user', content }
}

function createAssistantMessage(content: string, toolCalls?: any[]): OpenAIMessage {
  return { role: 'assistant', content, tool_calls: toolCalls }
}

function createToolMessage(content: string, name = 'read_file'): OpenAIMessage {
  return { role: 'tool', content, tool_call_id: 'tc-1', name } as any
}

function createSystemMessage(content: string): OpenAIMessage {
  return { role: 'system', content }
}

describe('TokenEstimator', () => {
  it('should estimate tokens for English text', () => {
    const text = 'Hello world'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(text.length)
  })

  it('should estimate more tokens for Chinese text', () => {
    const english = 'Hello'
    const chinese = '你好世界'
    
    const englishTokens = estimateTokens(english)
    const chineseTokens = estimateTokens(chinese)
    
    // 中文每字符约 0.67 token，英文每字符约 0.25 token
    expect(chineseTokens / chinese.length).toBeGreaterThan(englishTokens / english.length)
  })

  it('should estimate message tokens including structure overhead', () => {
    const msg = createUserMessage('Hello')
    const tokens = estimateMessageTokens(msg)
    
    // 应该包含结构开销
    expect(tokens).toBeGreaterThan(estimateTokens('Hello'))
  })

  it('should estimate tool_calls tokens', () => {
    const msg = createAssistantMessage('', [{
      id: 'tc-1',
      type: 'function',
      function: { name: 'read_file', arguments: '{"path": "test.ts"}' }
    }])
    
    const tokens = estimateMessageTokens(msg)
    expect(tokens).toBeGreaterThan(10) // 结构开销 + 函数名 + 参数
  })
})

describe('MessageTruncator', () => {
  it('should not truncate short content', () => {
    const content = 'Short content'
    const result = truncateToolResult(content, 'read_file')
    expect(result).toBe(content)
  })

  it('should truncate long content', () => {
    const content = 'x'.repeat(20000)
    const result = truncateToolResult(content, 'read_file')
    
    expect(result.length).toBeLessThan(content.length)
    expect(result).toContain('omitted')
  })

  it('should preserve error messages', () => {
    const content = 'Error: File not found\n' + 'x'.repeat(5000)
    const result = truncateToolResult(content, 'read_file')
    
    expect(result).toContain('Error: File not found')
  })

  it('should truncate search results by lines', () => {
    const lines = Array(100).fill('result line').join('\n')
    const result = truncateToolResult(lines, 'search_files', { maxToolResultChars: 500 })
    
    expect(result).toContain('more results omitted')
  })

  it('should truncate message with preserved ends', () => {
    const content = 'START' + 'x'.repeat(5000) + 'END'
    const result = truncateMessage(content, 1000, true)
    
    expect(result).toContain('START')
    expect(result).toContain('END')
    expect(result).toContain('truncated')
  })
})

describe('ContextManager', () => {
  let manager: ContextManager

  beforeEach(() => {
    manager = new ContextManager()
  })

  it('should optimize messages within token limit', () => {
    const messages: OpenAIMessage[] = [
      createSystemMessage('You are helpful.'),
      createUserMessage('Hello'),
      createAssistantMessage('Hi there!'),
    ]

    const { messages: optimized, stats } = manager.optimize(messages, { maxTokens: 100000 })

    expect(optimized.length).toBe(3)
    expect(stats.compactedTurns).toBe(0)
  })

  it('should compact old messages when exceeding limit', () => {
    const messages: OpenAIMessage[] = [createSystemMessage('System')]
    
    // 创建很多轮对话
    for (let i = 0; i < 20; i++) {
      messages.push(createUserMessage(`Question ${i}: ${'x'.repeat(500)}`))
      messages.push(createAssistantMessage(`Answer ${i}: ${'y'.repeat(500)}`))
    }

    const { messages: optimized, stats, summary } = manager.optimize(messages, {
      maxTokens: 5000,
      keepRecentTurns: 3,
    })

    expect(stats.compactedTurns).toBeGreaterThan(0)
    expect(stats.keptTurns).toBe(3)
    expect(summary).toBeTruthy()
  })

  it('should preserve tool_call and tool_result pairs', () => {
    const messages: OpenAIMessage[] = [
      createSystemMessage('System'),
      createUserMessage('Read file'),
      createAssistantMessage('', [{
        id: 'tc-1',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path": "test.ts"}' }
      }]),
      createToolMessage('file content', 'read_file'),
      createUserMessage('Thanks'),
      createAssistantMessage('You are welcome'),
    ]

    const { messages: optimized } = manager.optimize(messages, { maxTokens: 100000 })

    // 应该保持配对完整
    const hasToolCall = optimized.some(m => m.role === 'assistant' && m.tool_calls?.length)
    const hasToolResult = optimized.some(m => m.role === 'tool')
    
    if (hasToolCall) {
      expect(hasToolResult).toBe(true)
    }
  })

  it('should truncate tool results', () => {
    const longContent = 'x'.repeat(20000)
    const messages: OpenAIMessage[] = [
      createSystemMessage('System'),
      createUserMessage('Read file'),
      createToolMessage(longContent, 'read_file'),
    ]

    const { messages: optimized } = manager.optimize(messages, {
      maxTokens: 100000,
      maxToolResultChars: 1000,
    })

    const toolMsg = optimized.find(m => m.role === 'tool')
    expect(toolMsg?.content.length).toBeLessThan(longContent.length)
  })

  it('should manage summary state', () => {
    expect(manager.getSummary()).toBeNull()

    manager.setSummary('Test summary')
    expect(manager.getSummary()).toBe('Test summary')

    manager.clearSummary()
    expect(manager.getSummary()).toBeNull()
  })

  it('should include summary in system message when compacting', () => {
    manager.setSummary('Previous context summary')

    const messages: OpenAIMessage[] = [
      createSystemMessage('You are helpful.'),
      createUserMessage('Hello'),
    ]

    const { messages: optimized } = manager.optimize(messages, { maxTokens: 100 })

    const systemMsg = optimized.find(m => m.role === 'system')
    expect(systemMsg?.content).toContain('Previous context summary')
  })
})
