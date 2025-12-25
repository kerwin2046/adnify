import { logger } from '@utils/Logger'
import { useState, useEffect, useCallback } from 'react'
import {
    GitBranch, ChevronDown, Plus, RefreshCw,
    Trash2, ArrowRight, Loader2, Check
} from 'lucide-react'
import { useStore } from '@store'
import { t } from '@renderer/i18n'
import { gitService, GitStatus, GitCommit } from '@renderer/agent/gitService'
import { getEditorConfig } from '@renderer/config/editorConfig'
import { toast } from '@components/common/ToastProvider'
import { keybindingService } from '@services/keybindingService'
import { Input, Button } from '@components/ui'

export function GitView() {
    const { workspacePath, language, openFile, setActiveFile } = useStore()
    const [status, setStatus] = useState<GitStatus | null>(null)
    const [commits, setCommits] = useState<GitCommit[]>([])
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showCommits, setShowCommits] = useState(true)

    // 新增状态
    const [branches, setBranches] = useState<{ name: string; current: boolean; remote: boolean }[]>([])
    const [showBranches, setShowBranches] = useState(false)
    const [showStash, setShowStash] = useState(false)
    const [stashList, setStashList] = useState<{ index: number; message: string; branch: string }[]>([])
    const [showNewBranch, setShowNewBranch] = useState(false)
    const [newBranchName, setNewBranchName] = useState('')
    const [isPushing, setIsPushing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)

    const refreshStatus = useCallback(async () => {
        if (!workspacePath) return
        setIsRefreshing(true)
        setError(null)
        try {
            // Ensure workspace is set
            gitService.setWorkspace(workspacePath)

            const [s, c, b, st] = await Promise.all([
                gitService.getStatus(),
                gitService.getRecentCommits(),
                gitService.getBranches(),
                gitService.getStashList()
            ])
            setStatus(s)
            setCommits(c)
            setBranches(b)
            setStashList(st)
        } catch (e: unknown) {
            logger.ui.error('Git status error:', e)
            setError('Failed to load git status')
        } finally {
            setIsRefreshing(false)
        }
    }, [workspacePath])

    useEffect(() => {
        refreshStatus()
        const interval = setInterval(refreshStatus, getEditorConfig().performance.indexStatusIntervalMs)
        return () => clearInterval(interval)
    }, [refreshStatus])

    const handleInit = async () => {
        if (!workspacePath) return
        await gitService.init()
        refreshStatus()
    }

    const handleStage = async (path: string) => {
        await gitService.stageFile(path)
        refreshStatus()
    }

    const handleUnstage = async (path: string) => {
        await gitService.unstageFile(path)
        refreshStatus()
    }

    const handleCommit = async () => {
        if (!commitMessage.trim()) return
        setIsCommitting(true)
        const result = await gitService.commit(commitMessage)
        setIsCommitting(false)
        if (result.success) {
            setCommitMessage('')
            refreshStatus()
            toast.success('Commit successful')
        } else {
            toast.error('Commit failed', result.error)
        }
    }

    const handlePush = async () => {
        setIsPushing(true)
        const result = await gitService.push()
        setIsPushing(false)
        if (!result.success) {
            toast.error('Push failed', result.error)
        } else {
            refreshStatus()
            toast.success('Push successful')
        }
    }

    const handlePull = async () => {
        setIsPulling(true)
        const result = await gitService.pull()
        setIsPulling(false)
        if (!result.success) {
            toast.error('Pull failed', result.error)
        } else {
            refreshStatus()
            toast.success('Pull successful')
        }
    }

    const handleCheckoutBranch = async (branchName: string) => {
        const result = await gitService.checkoutBranch(branchName)
        if (result.success) {
            refreshStatus()
            setShowBranches(false)
            toast.success('Branch switched', branchName)
        } else {
            toast.error('Checkout failed', result.error)
        }
    }

    const handleCreateBranch = async () => {
        if (!newBranchName.trim()) return
        const result = await gitService.createBranch(newBranchName)
        if (result.success) {
            setNewBranchName('')
            setShowNewBranch(false)
            refreshStatus()
            toast.success('Branch created', newBranchName)
        } else {
            toast.error('Create branch failed', result.error)
        }
    }

    const handleStash = async () => {
        const result = await gitService.stash()
        if (result.success) {
            refreshStatus()
            toast.success('Changes stashed')
        } else {
            toast.error('Stash failed', result.error)
        }
    }

    const handleStashPop = async (index: number) => {
        const result = await gitService.stashApply(index)
        if (result.success) {
            refreshStatus()
            toast.success('Stash applied')
        } else {
            toast.error('Stash pop failed', result.error)
        }
    }

    const handleFileClick = async (path: string, fileStatus: string) => {
        const content = await window.electronAPI.readFile(path) || ''

        // If modified, try to show diff
        if (fileStatus === 'modified' || fileStatus === 'renamed') {
            const original = await gitService.getHeadFileContent(path)
            if (original !== null) {
                openFile(path, content, original)
                setActiveFile(path)
                return
            }
        }

        openFile(path, content)
        setActiveFile(path)
    }

    if (!workspacePath) return <div className="p-4 text-xs text-text-muted text-center">{t('noFolderOpened', language)}</div>

    // Not a repo state
    if (!status && !isRefreshing) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-12 h-12 bg-surface-hover rounded-full flex items-center justify-center mb-3">
                    <GitBranch className="w-6 h-6 text-text-muted opacity-50" />
                </div>
                <p className="text-xs text-text-muted mb-4">No source control active.</p>
                <Button
                    onClick={handleInit}
                    className="px-4 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-accent-hover transition-colors shadow-glow"
                >
                    Initialize Repository
                </Button>
                {error && <p className="text-[10px] text-status-error mt-2">{error}</p>}
            </div>
        )
    }

    // Repo loaded but maybe empty
    const hasChanges = status ? (status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0) : false

    return (
        <div className="flex flex-col h-full bg-transparent text-sm">
            <div className="h-10 px-3 flex items-center justify-between border-b border-white/5 sticky top-0 z-10 bg-transparent">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider opacity-80">
                    Source Control
                </span>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="icon"
                        size="icon"
                        onClick={handlePull}
                        disabled={isPulling}
                        title="Pull"
                        className="w-6 h-6"
                    >
                        <ArrowRight className={`w-3.5 h-3.5 rotate-90 ${isPulling ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                        variant="icon"
                        size="icon"
                        onClick={handlePush}
                        disabled={isPushing}
                        title="Push"
                        className="w-6 h-6"
                    >
                        <ArrowRight className={`w-3.5 h-3.5 -rotate-90 ${isPushing ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                        variant="icon"
                        size="icon"
                        onClick={refreshStatus}
                        title="Refresh"
                        className="w-6 h-6"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Branch Selector */}
                {status && (
                    <div className="px-3 py-2 border-b border-border-subtle bg-surface/30">
                        <div
                            className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover rounded px-2 py-1 transition-colors"
                            onClick={() => setShowBranches(!showBranches)}
                        >
                            <GitBranch className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-medium text-text-primary flex-1">{status.branch}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showBranches ? 'rotate-180' : ''}`} />
                        </div>

                        {showBranches && (
                            <div className="mt-2 bg-background rounded border border-border-subtle max-h-48 overflow-y-auto animate-slide-in">
                                {/* New Branch */}
                                <div className="p-2 border-b border-border-subtle">
                                    {showNewBranch ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                value={newBranchName}
                                                onChange={(e) => setNewBranchName(e.target.value)}
                                                placeholder="Branch name"
                                                className="flex-1 h-7 text-xs"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCreateBranch()
                                                    if (e.key === 'Escape') setShowNewBranch(false)
                                                }}
                                                autoFocus
                                            />
                                            <button onClick={handleCreateBranch} className="p-1 hover:bg-surface-active rounded">
                                                <Check className="w-3 h-3 text-status-success" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewBranch(true)}
                                            className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary w-full px-2 py-1 hover:bg-surface-hover rounded"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Create new branch
                                        </button>
                                    )}
                                </div>

                                {/* Local Branches */}
                                {branches.filter(b => !b.remote).map(branch => (
                                    <div
                                        key={branch.name}
                                        onClick={() => !branch.current && handleCheckoutBranch(branch.name)}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${branch.current
                                            ? 'bg-accent/10 text-accent'
                                            : 'text-text-secondary hover:bg-surface-hover'
                                            }`}
                                    >
                                        {branch.current && <Check className="w-3 h-3" />}
                                        <span className={branch.current ? '' : 'ml-5'}>{branch.name}</span>
                                    </div>
                                ))}

                                {/* Remote Branches */}
                                {branches.filter(b => b.remote).length > 0 && (
                                    <>
                                        <div className="px-3 py-1 text-[10px] text-text-muted font-semibold bg-surface-active/30">
                                            REMOTE
                                        </div>
                                        {branches.filter(b => b.remote).map(branch => (
                                            <div
                                                key={branch.name}
                                                onClick={() => handleCheckoutBranch(branch.name)}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover cursor-pointer"
                                            >
                                                <span className="ml-5">{branch.name}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Commit Area */}
                <div className="p-3 border-b border-white/5 bg-transparent">
                    <div className="relative">
                        <textarea
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Message (Ctrl+Enter to commit)"
                            className="w-full bg-black/20 border border-white/5 rounded-md p-2 text-xs text-text-primary focus:border-accent/50 focus:bg-black/40 focus:outline-none resize-none min-h-[60px] block placeholder:text-text-muted/50"
                            onKeyDown={(e) => {
                                if (keybindingService.matches(e, 'git.commit')) handleCommit()
                            }}
                        />
                    </div>
                    <Button
                        onClick={handleCommit}
                        disabled={isCommitting || (status?.staged.length === 0)}
                        className="w-full mt-2 flex items-center justify-center gap-2"
                    >
                        {isCommitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {isCommitting ? 'Committing...' : 'Commit'}
                    </Button>
                </div>

                {!hasChanges && status && (
                    <div className="p-4 text-center text-xs text-text-muted opacity-60">
                        No changes detected.
                    </div>
                )}

                {/* Staged Changes */}
                {status && status.staged.length > 0 && (
                    <div className="flex flex-col">
                        <div className="px-3 py-1.5 text-[10px] text-text-muted font-semibold bg-surface-active/30 border-y border-border-subtle sticky top-0 flex items-center justify-between group/header">
                            <span>STAGED CHANGES</span>
                            <span className="bg-surface-active px-1.5 rounded-full">{status.staged.length}</span>
                        </div>
                        {status.staged.map(file => (
                            <div key={file.path} className="group flex items-center px-3 py-1 hover:bg-surface-hover cursor-pointer" onClick={() => handleFileClick(file.path, file.status)}>
                                <span className="text-[10px] font-mono text-accent w-4 text-center flex-shrink-0">{file.status[0].toUpperCase()}</span>
                                <span className="text-xs text-text-secondary truncate flex-1">{file.path}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleUnstage(file.path) }}
                                        className="p-1 hover:bg-surface-active rounded text-text-muted hover:text-text-primary"
                                        title="Unstage"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Changes (Unstaged + Untracked) */}
                {status && (status.unstaged.length > 0 || status.untracked.length > 0) && (
                    <div className="flex flex-col mt-2">
                        <div className="px-3 py-1.5 text-[10px] text-text-muted font-semibold bg-surface-active/30 border-y border-border-subtle sticky top-0 flex items-center justify-between">
                            <span>CHANGES</span>
                            <span className="bg-surface-active px-1.5 rounded-full">{status.unstaged.length + status.untracked.length}</span>
                        </div>
                        {/* Unstaged */}
                        {status.unstaged.map(file => (
                            <div key={file.path} className="group flex items-center px-3 py-1 hover:bg-surface-hover cursor-pointer" onClick={() => handleFileClick(file.path, file.status)}>
                                <span className="text-[10px] font-mono text-warning w-4 text-center flex-shrink-0">{file.status[0].toUpperCase()}</span>
                                <span className="text-xs text-text-secondary truncate flex-1">{file.path}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStage(file.path) }}
                                        className="p-1 hover:bg-surface-active rounded text-text-muted hover:text-text-primary"
                                        title="Stage"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {/* Untracked */}
                        {status.untracked.map(path => (
                            <div key={path} className="group flex items-center px-3 py-1 hover:bg-surface-hover cursor-pointer" onClick={() => handleFileClick(path, 'untracked')}>
                                <span className="text-[10px] font-mono text-status-success w-4 text-center flex-shrink-0">U</span>
                                <span className="text-xs text-text-secondary truncate flex-1">{path}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStage(path) }}
                                        className="p-1 hover:bg-surface-active rounded text-text-muted hover:text-text-primary"
                                        title="Stage"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Stash Section */}
                <div className="flex flex-col mt-2 border-t border-border-subtle">
                    <div
                        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-hover select-none group"
                        onClick={() => setShowStash(!showStash)}
                    >
                        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showStash ? '' : '-rotate-90'}`} />
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex-1">STASH</span>
                        {stashList.length > 0 && (
                            <span className="text-[10px] text-text-muted bg-surface-active px-1.5 rounded-full">{stashList.length}</span>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleStash() }}
                            className="p-1 hover:bg-surface-active rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Stash changes"
                        >
                            <Plus className="w-3 h-3 text-text-muted" />
                        </button>
                    </div>

                    {showStash && (
                        <div className="pb-2">
                            {stashList.length === 0 ? (
                                <div className="px-4 py-2 text-xs text-text-muted opacity-60">No stashed changes</div>
                            ) : (
                                stashList.map((stash) => (
                                    <div key={stash.index} className="px-4 py-1.5 hover:bg-surface-hover cursor-pointer group flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-text-primary truncate">{stash.message}</div>
                                            <div className="text-[10px] text-text-muted">stash@{`{${stash.index}}`} on {stash.branch}</div>
                                        </div>
                                        <button
                                            onClick={() => handleStashPop(stash.index)}
                                            className="p-1 hover:bg-surface-active rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Pop stash"
                                        >
                                            <ArrowRight className="w-3 h-3 text-text-muted" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Commits List */}
                {commits.length > 0 && (
                    <div className="flex flex-col border-t border-border-subtle">
                        <div
                            className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-hover select-none"
                            onClick={() => setShowCommits(!showCommits)}
                        >
                            <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showCommits ? '' : '-rotate-90'}`} />
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">COMMITS</span>
                        </div>

                        {showCommits && (
                            <div className="pb-2">
                                {commits.map((commit) => (
                                    <div key={commit.hash} className="px-4 py-1.5 hover:bg-surface-hover cursor-pointer group border-l-2 border-transparent hover:border-accent">
                                        <div className="text-xs text-text-primary truncate font-medium">{commit.message}</div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[10px] text-text-muted flex items-center gap-1">
                                                <GitBranch className="w-3 h-3" />
                                                {commit.shortHash}
                                            </span>
                                            <span className="text-[10px] text-text-muted opacity-60">
                                                {commit.author}, {new Date(commit.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
