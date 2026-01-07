/**
 * Sidebar 主组件
 * 根据 activeSidePanel 状态渲染对应的面板视图
 */

import { useStore } from '@store'
import { ExplorerView } from './panels/ExplorerView'
import { SearchView } from './panels/SearchView'
import { GitView } from './panels/GitView'
import { ProblemsView } from './panels/ProblemsView'
import { OutlineView } from './panels/OutlineView'
import { HistoryView } from './panels/HistoryView'

export default function Sidebar() {
    const { activeSidePanel } = useStore()

    if (!activeSidePanel) return null

    return (
        <div className="w-full bg-background-secondary border-r border-border flex flex-col h-full animate-slide-in relative z-10">
            {activeSidePanel === 'explorer' && <ExplorerView />}
            {activeSidePanel === 'search' && <SearchView />}
            {activeSidePanel === 'git' && <GitView />}
            {activeSidePanel === 'problems' && <ProblemsView />}
            {activeSidePanel === 'outline' && <OutlineView />}
            {activeSidePanel === 'history' && <HistoryView />}
        </div>
    )
}
