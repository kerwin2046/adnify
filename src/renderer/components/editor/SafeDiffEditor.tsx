/**
 * 安全的 DiffEditor 包装组件
 * 解决 Monaco DiffEditor 在卸载时 TextModel 被提前销毁的问题
 */

import { useRef, useCallback, useEffect } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface SafeDiffEditorProps {
  original: string | undefined
  modified: string | undefined
  language: string
  options?: editor.IDiffEditorConstructionOptions
  onMount?: (editor: editor.IStandaloneDiffEditor, monaco: typeof import('monaco-editor')) => void
}

export function SafeDiffEditor({ original, modified, language, options, onMount }: SafeDiffEditorProps) {
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  // 在组件卸载时安全清理
  useEffect(() => {
    return () => {
      if (diffEditorRef.current) {
        try {
          // 先获取 models
          const originalModel = diffEditorRef.current.getOriginalEditor()?.getModel()
          const modifiedModel = diffEditorRef.current.getModifiedEditor()?.getModel()
          
          // 设置空 model 避免 dispose 时的错误
          diffEditorRef.current.setModel(null)
          
          // 然后 dispose models
          originalModel?.dispose()
          modifiedModel?.dispose()
        } catch {
          // 忽略清理时的错误
        }
        diffEditorRef.current = null
      }
    }
  }, [])

  const handleMount = useCallback((editor: editor.IStandaloneDiffEditor, monacoInstance: typeof import('monaco-editor')) => {
    diffEditorRef.current = editor
    onMount?.(editor, monacoInstance)
  }, [onMount])

  return (
    <DiffEditor
      height="100%"
      language={language}
      original={original}
      modified={modified}
      theme="adnify-dynamic"
      options={options}
      onMount={handleMount}
    />
  )
}
