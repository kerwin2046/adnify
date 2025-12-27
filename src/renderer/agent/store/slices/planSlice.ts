/**
 * Plan 管理 Slice
 * 负责执行计划的创建、更新、管理
 */

import type { StateCreator } from 'zustand'
import type { Plan, PlanItem } from '../../types'

// ===== 类型定义 =====

export interface PlanState {
    plan: Plan | null
}

export interface PlanActions {
    createPlan: (items: Array<{ title: string; description?: string }>) => void
    updatePlanStatus: (status: Plan['status']) => void
    updatePlanItem: (itemId: string, updates: Partial<PlanItem>) => void
    addPlanItem: (item: { title: string; description?: string }) => void
    deletePlanItem: (itemId: string) => void
    setPlanStep: (stepId: string | null) => void
    clearPlan: () => void
}

export type PlanSlice = PlanState & PlanActions

// ===== 辅助函数 =====

const generateShortId = () => crypto.randomUUID().slice(0, 8)

// ===== Slice 创建器 =====

export const createPlanSlice: StateCreator<
    PlanSlice,
    [],
    [],
    PlanSlice
> = (set) => ({
    // 初始状态
    plan: null,

    // 创建计划
    createPlan: (items) => {
        set({
            plan: {
                id: crypto.randomUUID(),
                items: items.map(item => ({
                    id: generateShortId(),
                    title: item.title,
                    description: item.description,
                    status: 'pending' as const,
                })),
                status: 'draft' as const,
                currentStepId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        })
    },

    // 更新计划状态
    updatePlanStatus: (status) => {
        set(state => {
            if (!state.plan) return {}
            return {
                plan: {
                    ...state.plan,
                    status,
                    updatedAt: Date.now(),
                },
            }
        })
    },

    // 更新计划项
    updatePlanItem: (itemId, updates) => {
        set(state => {
            if (!state.plan) return {}
            return {
                plan: {
                    ...state.plan,
                    items: state.plan.items.map(item =>
                        item.id === itemId ? { ...item, ...updates } : item
                    ),
                    updatedAt: Date.now(),
                },
            }
        })
    },

    // 添加计划项
    addPlanItem: (item) => {
        set(state => {
            if (!state.plan) return {}
            const newItem: PlanItem = {
                id: generateShortId(),
                title: item.title,
                description: item.description,
                status: 'pending' as const,
            }
            return {
                plan: {
                    ...state.plan,
                    items: [...state.plan.items, newItem],
                    updatedAt: Date.now(),
                },
            }
        })
    },

    // 删除计划项
    deletePlanItem: (itemId) => {
        set(state => {
            if (!state.plan) return {}
            return {
                plan: {
                    ...state.plan,
                    items: state.plan.items.filter(item => item.id !== itemId),
                    updatedAt: Date.now(),
                },
            }
        })
    },

    // 设置当前步骤
    setPlanStep: (stepId) => {
        set(state => {
            if (!state.plan) return {}
            return {
                plan: {
                    ...state.plan,
                    currentStepId: stepId,
                    updatedAt: Date.now(),
                },
            }
        })
    },

    // 清空计划
    clearPlan: () => {
        set({ plan: null })
    },
})
