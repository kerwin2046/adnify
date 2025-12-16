/**
 * AI 增强服务
 * 提供多文件重构、代码审查、测试生成等功能
 */

export interface RefactorRequest {
  files: { path: string; content: string }[]
  instruction: string
  context?: string
}

export interface CodeReviewRequest {
  files: { path: string; content: string }[]
  focusAreas?: ('security' | 'performance' | 'maintainability' | 'bugs')[]
}

export interface TestGenerationRequest {
  filePath: string
  content: string
  framework?: 'jest' | 'vitest' | 'mocha' | 'pytest'
  coverage?: 'unit' | 'integration' | 'e2e'
}

export interface RefactorResult {
  files: { path: string; originalContent: string; newContent: string; changes: string[] }[]
  summary: string
}

export interface CodeReviewResult {
  issues: {
    severity: 'critical' | 'warning' | 'info'
    category: string
    file: string
    line?: number
    message: string
    suggestion?: string
  }[]
  summary: string
  score: number // 0-100
}

export interface TestGenerationResult {
  testFilePath: string
  testContent: string
  coverage: string[]
}

/**
 * 构建多文件重构的系统提示词
 */
export function buildRefactorPrompt(request: RefactorRequest): string {
  const fileList = request.files.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
  
  return `You are an expert code refactoring assistant. Your task is to refactor the following files according to the user's instruction.

## Files to refactor:
${fileList}

## User instruction:
${request.instruction}

${request.context ? `## Additional context:\n${request.context}` : ''}

## Output format:
For each file that needs changes, output in this format:

### FILE: <file_path>
\`\`\`<language>
<complete new file content>
\`\`\`

### CHANGES:
- <description of change 1>
- <description of change 2>

After all files, provide a summary:

### SUMMARY:
<brief summary of all changes made>

Important:
- Only output files that have changes
- Output the COMPLETE file content, not just the changed parts
- Maintain consistent code style
- Preserve existing functionality unless explicitly asked to change it`
}

/**
 * 构建代码审查的系统提示词
 */
export function buildCodeReviewPrompt(request: CodeReviewRequest): string {
  const fileList = request.files.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
  const focusAreas = request.focusAreas?.join(', ') || 'all aspects'
  
  return `You are an expert code reviewer. Review the following code focusing on: ${focusAreas}.

## Files to review:
${fileList}

## Output format:
Provide your review in this JSON format:

\`\`\`json
{
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "security|performance|maintainability|bugs|style",
      "file": "path/to/file",
      "line": 42,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "Overall assessment of the code quality",
  "score": 85
}
\`\`\`

Guidelines:
- Be specific about line numbers when possible
- Provide actionable suggestions
- Score from 0-100 based on overall quality
- Critical issues are security vulnerabilities or bugs that will cause failures
- Warnings are potential problems or bad practices
- Info are style suggestions or minor improvements`
}

/**
 * 构建测试生成的系统提示词
 */
export function buildTestGenerationPrompt(request: TestGenerationRequest): string {
  const framework = request.framework || 'vitest'
  const coverage = request.coverage || 'unit'
  
  return `You are an expert test engineer. Generate ${coverage} tests for the following code using ${framework}.

## File: ${request.filePath}
\`\`\`
${request.content}
\`\`\`

## Requirements:
- Use ${framework} testing framework
- Generate comprehensive ${coverage} tests
- Cover edge cases and error scenarios
- Use descriptive test names
- Include setup and teardown if needed
- Mock external dependencies appropriately

## Output format:
\`\`\`typescript
// Test file content here
\`\`\`

### COVERAGE:
- <function/method 1>: tested
- <function/method 2>: tested
...`
}

/**
 * 解析重构结果
 */
export function parseRefactorResult(response: string): RefactorResult {
  const files: RefactorResult['files'] = []
  let summary = ''
  
  // 解析文件块
  const fileRegex = /### FILE: (.+?)\n```(\w+)?\n([\s\S]+?)```\n\n### CHANGES:\n([\s\S]+?)(?=\n### FILE:|### SUMMARY:|$)/g
  let match
  
  while ((match = fileRegex.exec(response)) !== null) {
    const [, path, , content, changesBlock] = match
    const changes = changesBlock.split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.slice(2).trim())
    
    files.push({
      path: path.trim(),
      originalContent: '', // 需要从外部提供
      newContent: content.trim(),
      changes,
    })
  }
  
  // 解析摘要
  const summaryMatch = response.match(/### SUMMARY:\n([\s\S]+?)$/)
  if (summaryMatch) {
    summary = summaryMatch[1].trim()
  }
  
  return { files, summary }
}

/**
 * 解析代码审查结果
 */
export function parseCodeReviewResult(response: string): CodeReviewResult {
  try {
    const jsonMatch = response.match(/```json\n([\s\S]+?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
  } catch (e) {
    console.error('Failed to parse code review result:', e)
  }
  
  return {
    issues: [],
    summary: 'Failed to parse review result',
    score: 0,
  }
}

/**
 * 解析测试生成结果
 */
export function parseTestGenerationResult(response: string, originalPath: string): TestGenerationResult {
  const testContent = response.match(/```(?:typescript|javascript)?\n([\s\S]+?)```/)?.[1] || ''
  
  // 生成测试文件路径
  const ext = originalPath.split('.').pop()
  const baseName = originalPath.replace(/\.[^.]+$/, '')
  const testFilePath = `${baseName}.test.${ext}`
  
  // 解析覆盖信息
  const coverageMatch = response.match(/### COVERAGE:\n([\s\S]+?)(?=$|\n\n)/)
  const coverage = coverageMatch
    ? coverageMatch[1].split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.slice(2).trim())
    : []
  
  return {
    testFilePath,
    testContent: testContent.trim(),
    coverage,
  }
}

/**
 * AI 增强服务类
 */
class AIEnhancedService {
  /**
   * 执行多文件重构
   */
  async refactor(request: RefactorRequest): Promise<RefactorResult> {
    const prompt = buildRefactorPrompt(request)
    // 这里需要调用 LLM API
    // 实际实现会通过 useAgent hook 或直接调用 LLM 服务
    console.log('[AI Enhanced] Refactor prompt:', prompt)
    
    // 返回占位结果，实际实现需要调用 LLM
    return {
      files: [],
      summary: 'Refactoring requires LLM integration',
    }
  }

  /**
   * 执行代码审查
   */
  async review(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const prompt = buildCodeReviewPrompt(request)
    console.log('[AI Enhanced] Review prompt:', prompt)
    
    return {
      issues: [],
      summary: 'Code review requires LLM integration',
      score: 0,
    }
  }

  /**
   * 生成测试
   */
  async generateTests(request: TestGenerationRequest): Promise<TestGenerationResult> {
    const prompt = buildTestGenerationPrompt(request)
    console.log('[AI Enhanced] Test generation prompt:', prompt)
    
    return {
      testFilePath: '',
      testContent: '',
      coverage: [],
    }
  }
}

export const aiEnhancedService = new AIEnhancedService()
