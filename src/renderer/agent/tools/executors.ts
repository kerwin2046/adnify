/**
 * 工具执行器实现
 * 所有内置工具的执行逻辑
 */

import { logger } from '@utils/Logger'
import type { ToolExecutionResult, ToolExecutionContext } from '@/shared/types'
import type { PlanItem } from '../types'
import { validatePath, isSensitivePath } from '@/renderer/utils/pathUtils'
import { pathToLspUri } from '@/renderer/services/lspService'
import {
    parseSearchReplaceBlocks,
    applySearchReplaceBlocks,
    calculateLineChanges,
} from '@/renderer/utils/searchReplace'
import { getAgentConfig } from '../utils/AgentConfig'
import { AgentService } from '../services/AgentService'
import { useAgentStore } from '../store/AgentStore'
import { lintService } from '../services/lintService'
import { useStore } from '@/renderer/store'

// ===== 辅助函数 =====

interface DirTreeNode {
    name: string
    path: string
    isDirectory: boolean
    children?: DirTreeNode[]
}

async function buildDirTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<DirTreeNode[]> {
    if (currentDepth >= maxDepth) return []

    const items = await window.electronAPI.readDir(dirPath)
    if (!items) return []

    const ignoreDirs = getAgentConfig().ignoredDirectories

    const nodes: DirTreeNode[] = []
    for (const item of items) {
        if (item.name.startsWith('.') && item.name !== '.env') continue
        if (ignoreDirs.includes(item.name)) continue

        const node: DirTreeNode = { name: item.name, path: item.path, isDirectory: item.isDirectory }
        if (item.isDirectory && currentDepth < maxDepth - 1) {
            node.children = await buildDirTree(item.path, maxDepth, currentDepth + 1)
        }
        nodes.push(node)
    }

    return nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
    })
}

function formatDirTree(nodes: DirTreeNode[], prefix = ''): string {
    let result = ''
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const isLast = i === nodes.length - 1
        result += `${prefix}${isLast ? '└── ' : '├── '}${node.isDirectory ? '📁 ' : '📄 '}${node.name}\n`
        if (node.children?.length) {
            result += formatDirTree(node.children, prefix + (isLast ? '    ' : '│   '))
        }
    }
    return result
}

function generatePlanMarkdown(plan: { items: PlanItem[] }, title?: string): string {
    let content = `# 📋 ${title || 'Execution Plan'}\n\n> Generated: ${new Date().toLocaleString()}\n\n## Steps\n`
    plan.items.forEach(item => {
        const checkbox = item.status === 'completed' ? '[x]' : item.status === 'in_progress' ? '[/]' : item.status === 'failed' ? '[!]' : '[ ]'
        const icon = item.status === 'completed' ? '✅' : item.status === 'in_progress' ? '🔄' : item.status === 'failed' ? '❌' : '⬜'
        content += `- ${checkbox} ${icon} [id: ${item.id}] ${item.title}\n`
        if (item.description) content += `  > ${item.description}\n`
    })
    return content + `\n---\n*Plan ID: ${plan.items[0]?.id?.slice(0, 8) || 'N/A'}*\n`
}

function resolvePath(p: unknown, workspacePath: string | null, allowRead = false): string {
    if (typeof p !== 'string') throw new Error('Invalid path: not a string')
    const validation = validatePath(p, workspacePath, { allowSensitive: false, allowOutsideWorkspace: false })
    if (!validation.valid) throw new Error(`Security: ${validation.error}`)
    if (!allowRead && isSensitivePath(validation.sanitizedPath!)) {
        throw new Error('Security: Cannot modify sensitive files')
    }
    return validation.sanitizedPath!
}

// ===== 工具执行器 =====

export const toolExecutors: Record<string, (args: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<ToolExecutionResult>> = {
    async read_file(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const content = await window.electronAPI.readFile(path)
        if (content === null) return { success: false, result: '', error: `File not found: ${path}` }

        AgentService.markFileAsRead(path)

        const lines = content.split('\n')
        const startLine = typeof args.start_line === 'number' ? Math.max(1, args.start_line) : 1
        const endLine = typeof args.end_line === 'number' ? Math.min(lines.length, args.end_line) : lines.length
        const numberedContent = lines.slice(startLine - 1, endLine).map((line, i) => `${startLine + i}: ${line}`).join('\n')

        return { success: true, result: numberedContent, meta: { filePath: path } }
    },

    async list_directory(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const items = await window.electronAPI.readDir(path)
        if (!items) return { success: false, result: '', error: `Directory not found: ${path}` }
        return { success: true, result: items.map(item => `${item.isDirectory ? '📁' : '📄'} ${item.name}`).join('\n') }
    },

    async get_dir_tree(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const tree = await buildDirTree(path, (args.max_depth as number) || 3)
        return { success: true, result: formatDirTree(tree) }
    },

    async search_files(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const results = await window.electronAPI.searchFiles(args.pattern as string, path, {
            isRegex: !!args.is_regex, include: args.file_pattern as string | undefined, isCaseSensitive: false
        })
        if (!results) return { success: false, result: 'Search failed' }
        return { success: true, result: results.slice(0, 50).map(r => `${r.path}:${r.line}: ${r.text.trim()}`).join('\n') || 'No matches found' }
    },

    async search_in_file(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const content = await window.electronAPI.readFile(path)
        if (content === null) return { success: false, result: '', error: `File not found: ${path}` }

        const pattern = args.pattern as string
        const matches: string[] = []
        content.split('\n').forEach((line, index) => {
            const matched = args.is_regex
                ? (() => { try { return new RegExp(pattern, 'gi').test(line) } catch { return false } })()
                : line.toLowerCase().includes(pattern.toLowerCase())
            if (matched) matches.push(`${index + 1}: ${line.trim()}`)
        })

        return { success: true, result: matches.length ? `Found ${matches.length} matches:\n${matches.slice(0, 100).join('\n')}` : `No matches found for "${pattern}"` }
    },

    async read_multiple_files(args, ctx) {
        const paths = args.paths as string[]
        let result = ''
        for (const p of paths) {
            try {
                const validPath = resolvePath(p, ctx.workspacePath, true)
                const content = await window.electronAPI.readFile(validPath)
                if (content !== null) {
                    result += `\n--- File: ${p} ---\n${content}\n`
                    AgentService.markFileAsRead(validPath)
                } else {
                    result += `\n--- File: ${p} ---\n[File not found]\n`
                }
            } catch (e: unknown) {
                result += `\n--- File: ${p} ---\n[Error: ${(e as Error).message}]\n`
            }
        }
        return { success: true, result }
    },

    async edit_file(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath)
        if (!AgentService.hasReadFile(path)) {
            return { success: false, result: '', error: 'Read-before-write required: You must read the file first.' }
        }

        const originalContent = await window.electronAPI.readFile(path)
        if (originalContent === null) return { success: false, result: '', error: `File not found: ${path}` }

        const blocks = parseSearchReplaceBlocks(args.search_replace_blocks as string)
        if (blocks.length === 0) return { success: false, result: '', error: 'No valid SEARCH/REPLACE blocks found.' }

        const applyResult = applySearchReplaceBlocks(originalContent, blocks)
        if (applyResult.errors.length > 0) return { success: false, result: '', error: applyResult.errors.join('\n') }

        const success = await window.electronAPI.writeFile(path, applyResult.newContent)
        if (!success) return { success: false, result: '', error: 'Failed to write file' }

        const lineChanges = calculateLineChanges(originalContent, applyResult.newContent)
        return { success: true, result: 'File updated successfully', meta: { filePath: path, oldContent: originalContent, newContent: applyResult.newContent, linesAdded: lineChanges.added, linesRemoved: lineChanges.removed } }
    },

    async write_file(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath)
        const content = args.content as string
        const originalContent = await window.electronAPI.readFile(path) || ''
        const success = await window.electronAPI.writeFile(path, content)
        if (!success) return { success: false, result: '', error: 'Failed to write file' }

        const lineChanges = calculateLineChanges(originalContent, content)
        return { success: true, result: 'File written successfully', meta: { filePath: path, oldContent: originalContent, newContent: content, linesAdded: lineChanges.added, linesRemoved: lineChanges.removed } }
    },

    async replace_file_content(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath)
        if (!AgentService.hasReadFile(path)) {
            return { success: false, result: '', error: 'Read-before-write required' }
        }

        const originalContent = await window.electronAPI.readFile(path)
        if (originalContent === null) return { success: false, result: '', error: `File not found: ${path}` }

        const content = args.content as string
        if (originalContent === '') {
            const success = await window.electronAPI.writeFile(path, content)
            return success
                ? { success: true, result: 'File written (was empty)', meta: { filePath: path, oldContent: '', newContent: content, linesAdded: content.split('\n').length, linesRemoved: 0 } }
                : { success: false, result: '', error: 'Failed to write file' }
        }

        const lines = originalContent.split('\n')
        lines.splice((args.start_line as number) - 1, (args.end_line as number) - (args.start_line as number) + 1, ...content.split('\n'))
        const newContent = lines.join('\n')

        const success = await window.electronAPI.writeFile(path, newContent)
        if (!success) return { success: false, result: '', error: 'Failed to write file' }

        const lineChanges = calculateLineChanges(originalContent, newContent)
        return { success: true, result: 'File updated successfully', meta: { filePath: path, oldContent: originalContent, newContent, linesAdded: lineChanges.added, linesRemoved: lineChanges.removed } }
    },

    async create_file_or_folder(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath)
        const isFolder = path.endsWith('/') || path.endsWith('\\')

        if (isFolder) {
            const success = await window.electronAPI.mkdir(path)
            return { success, result: success ? 'Folder created' : 'Failed to create folder' }
        }

        const content = (args.content as string) || ''
        const success = await window.electronAPI.writeFile(path, content)
        return { success, result: success ? 'File created' : 'Failed to create file', meta: { filePath: path, isNewFile: true, newContent: content, linesAdded: content.split('\n').length } }
    },

    async delete_file_or_folder(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath)
        const success = await window.electronAPI.deleteFile(path)
        return { success, result: success ? 'Deleted successfully' : 'Failed to delete' }
    },

    async run_command(args, ctx) {
        const command = args.command as string
        const cwd = args.cwd ? resolvePath(args.cwd, ctx.workspacePath, true) : ctx.workspacePath
        const timeout = ((args.timeout as number) || 30) * 1000

        const cmdStr = command.trim()
        const firstSpace = cmdStr.indexOf(' ')
        const cmdName = firstSpace > -1 ? cmdStr.substring(0, firstSpace) : cmdStr
        const argsStr = firstSpace > -1 ? cmdStr.substring(firstSpace + 1) : ''

        const cmdArgs: string[] = []
        const regex = /[^\s"]+|"([^"]*)"/gi
        let match
        while ((match = regex.exec(argsStr)) !== null) {
            cmdArgs.push(match[1] ?? match[0])
        }

        const result = await window.electronAPI.executeSecureCommand({
            command: cmdName, args: cmdArgs, cwd: cwd || undefined, timeout, requireConfirm: false
        })

        return { success: true, result: result.output || (result.success ? 'Command executed' : 'Command failed'), meta: { command, cwd, exitCode: result.success ? 0 : 1 }, error: result.error }
    },

    async get_lint_errors(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const errors = await lintService.getLintErrors(path, args.refresh as boolean)
        return { success: true, result: errors.length ? errors.map((e) => `[${e.severity}] ${e.message} (Line ${e.startLine})`).join('\n') : 'No lint errors found.' }
    },

    async codebase_search(args, ctx) {
        if (!ctx.workspacePath) return { success: false, result: '', error: 'No workspace open' }
        const results = await window.electronAPI.indexSearch(ctx.workspacePath, args.query as string, (args.top_k as number) || 10)
        if (!results?.length) return { success: false, result: 'No results found' }
        return { success: true, result: results.map(r => `${r.relativePath}:${r.startLine}: ${r.content.trim()}`).join('\n') }
    },

    async find_references(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const locations = await window.electronAPI.lspReferences({
            uri: pathToLspUri(path), line: (args.line as number) - 1, character: (args.column as number) - 1, workspacePath: ctx.workspacePath
        })
        if (!locations?.length) return { success: true, result: 'No references found' }
        return { success: true, result: locations.map(loc => `${loc.uri}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`).join('\n') }
    },

    async go_to_definition(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const locations = await window.electronAPI.lspDefinition({
            uri: pathToLspUri(path), line: (args.line as number) - 1, character: (args.column as number) - 1, workspacePath: ctx.workspacePath
        })
        if (!locations?.length) return { success: true, result: 'Definition not found' }
        return { success: true, result: locations.map(loc => `${loc.uri}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`).join('\n') }
    },

    async get_hover_info(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const hover = await window.electronAPI.lspHover({
            uri: pathToLspUri(path), line: (args.line as number) - 1, character: (args.column as number) - 1, workspacePath: ctx.workspacePath
        })
        if (!hover?.contents) return { success: true, result: 'No hover info' }
        const contents = Array.isArray(hover.contents) ? hover.contents.join('\n') : (typeof hover.contents === 'string' ? hover.contents : hover.contents.value)
        return { success: true, result: contents }
    },

    async get_document_symbols(args, ctx) {
        const path = resolvePath(args.path, ctx.workspacePath, true)
        const symbols = await window.electronAPI.lspDocumentSymbol({ uri: pathToLspUri(path), workspacePath: ctx.workspacePath })
        if (!symbols?.length) return { success: true, result: 'No symbols found' }

        const format = (s: { name: string; kind: number; children?: unknown[] }, depth: number): string => {
            let out = `${'  '.repeat(depth)}${s.name} (${s.kind})\n`
            if (s.children) out += (s.children as typeof s[]).map(c => format(c, depth + 1)).join('')
            return out
        }
        return { success: true, result: symbols.map((s) => format(s, 0)).join('') }
    },

    async web_search(args) {
        const result = await window.electronAPI.httpWebSearch(args.query as string, args.max_results as number)
        if (!result.success || !result.results) return { success: false, result: '', error: result.error || 'Search failed' }
        return { success: true, result: result.results.map((r) => `[${r.title}](${r.url})\n${r.snippet}`).join('\n\n') }
    },

    async read_url(args) {
        const result = await window.electronAPI.httpReadUrl(args.url as string, (args.timeout as number) || 30)
        if (!result.success || !result.content) return { success: false, result: '', error: result.error || 'Failed to read URL' }
        return { success: true, result: `Title: ${result.title}\n\n${result.content}` }
    },

    async create_plan(args, ctx) {
        const items = args.items as Array<{ title: string; description?: string }>
        const title = args.title as string | undefined
        useAgentStore.getState().createPlan(items)

        const plan = useAgentStore.getState().plan
        if (plan && ctx.workspacePath) {
            const planContent = generatePlanMarkdown(plan, title)
            const planName = title ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30) : `plan_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
            const planFilePath = `${ctx.workspacePath}/.adnify/plans/${planName}.md`

            await window.electronAPI.ensureDir(`${ctx.workspacePath}/.adnify/plans`)
            await window.electronAPI.writeFile(planFilePath, planContent)

            useStore.getState().openFile(planFilePath, planContent)
            useStore.getState().setActiveFile(planFilePath)
            await window.electronAPI.writeFile(`${ctx.workspacePath}/.adnify/active_plan.txt`, planFilePath)

            return { success: true, result: `Plan created with ${plan.items.length} items` }
        }
        return { success: true, result: 'Plan created successfully' }
    },

    async update_plan(args, ctx) {
        const store = useAgentStore.getState()
        const plan = store.plan

        if (args.status) store.updatePlanStatus(args.status as 'draft' | 'active' | 'completed' | 'failed')

        if (args.items && plan) {
            for (const item of args.items as Array<{ id?: string; status?: string; title?: string }>) {
                let targetId = item.id
                if (!targetId && item.title) {
                    const match = plan.items.find((p: PlanItem) => p.title === item.title)
                    if (match) targetId = match.id
                }
                if (!targetId) continue

                let matchedItem = plan.items.find((p: PlanItem) => p.id === targetId)
                if (!matchedItem && targetId.length >= 4) {
                    const prefixMatches = plan.items.filter((p: PlanItem) => p.id.startsWith(targetId!))
                    if (prefixMatches.length === 1) matchedItem = prefixMatches[0]
                }
                if (!matchedItem) {
                    const idx = parseInt(targetId, 10)
                    if (!isNaN(idx)) {
                        const adjustedIdx = idx > 0 && idx <= plan.items.length ? idx - 1 : idx
                        if (adjustedIdx >= 0 && adjustedIdx < plan.items.length) matchedItem = plan.items[adjustedIdx]
                    }
                }

                if (matchedItem) {
                    const updates: Partial<PlanItem> = {}
                    if (item.status) updates.status = item.status as PlanItem['status']
                    if (item.title) updates.title = item.title
                    store.updatePlanItem(matchedItem.id, updates)
                }
            }
        }

        if (args.currentStepId !== undefined) {
            let stepId = args.currentStepId as string | null
            if (plan && stepId) {
                const idx = parseInt(stepId, 10)
                if (!isNaN(idx)) {
                    const adjustedIdx = idx > 0 && idx <= plan.items.length ? idx - 1 : idx
                    if (adjustedIdx >= 0 && adjustedIdx < plan.items.length) stepId = plan.items[adjustedIdx].id
                }
            }
            store.setPlanStep(stepId)
        }

        // 同步文件
        const updatedPlan = useAgentStore.getState().plan
        if (updatedPlan && ctx.workspacePath) {
            let planFilePath = await window.electronAPI.readFile(`${ctx.workspacePath}/.adnify/active_plan.txt`)
            planFilePath = (planFilePath || `${ctx.workspacePath}/.adnify/plan.md`).trim()

            let finalTitle = args.title as string | undefined
            if (!finalTitle) {
                const oldContent = await window.electronAPI.readFile(planFilePath)
                const match = oldContent?.match(/^# 📋 (.*)$/m)
                if (match) finalTitle = match[1]
            }

            const planContent = generatePlanMarkdown(updatedPlan, finalTitle)
            await window.electronAPI.writeFile(planFilePath, planContent)

            try {
                const openFile = useStore.getState().openFiles.find((f: { path: string }) => f.path === planFilePath)
                if (openFile) useStore.getState().reloadFileFromDisk(planFilePath, planContent)
            } catch (err) {
                logger.agent.error('[update_plan] Failed to sync editor:', err)
            }
        }

        return { success: true, result: 'Plan updated successfully' }
    },
}

/**
 * 初始化工具注册表
 */
export async function initializeTools(): Promise<void> {
    const { toolRegistry } = await import('./registry')
    toolRegistry.registerAll(toolExecutors)
}
