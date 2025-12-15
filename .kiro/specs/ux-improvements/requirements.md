# Requirements Document

## Introduction

本文档定义了 Adnify AI 代码编辑器的用户体验改进需求，重点解决工具调用交互、文件系统响应性和整体 UI 一致性问题。目标是达到与 Cursor 编辑器相当的交互流畅度和用户体验。

## Glossary

- **Tool Call**: AI Agent 调用的工具，如读取文件、编辑文件、执行命令等
- **Ghost Text**: 代码补全时显示的半透明建议文本
- **File Watcher**: 文件系统监听器，监控文件变化
- **Dirty State**: 文件已修改但未保存的状态
- **Diff Preview**: 文件修改前后的差异预览

## Requirements

### Requirement 1: 工具调用交互优化

**User Story:** As a developer, I want smooth and informative tool call interactions, so that I can understand what the AI is doing without feeling blocked.

#### Acceptance Criteria

1. WHEN the AI starts a tool call THEN the Adnify SHALL display an animated progress indicator with the tool name
2. WHEN the AI calls edit_file or write_file THEN the Adnify SHALL display only the file name with a clickable link
3. WHEN the user clicks on an edited file name THEN the Adnify SHALL open the file in the editor with diff view
4. WHEN a tool call completes THEN the Adnify SHALL update the status indicator to show success or failure
5. WHEN multiple tool calls occur THEN the Adnify SHALL display them in a compact, collapsible list
6. WHEN displaying tool results THEN the Adnify SHALL inline them within the tool call card instead of creating new messages


### Requirement 2: 文件系统实时响应

**User Story:** As a developer, I want the file tree and open files to automatically reflect changes, so that I don't need to manually refresh.

#### Acceptance Criteria

1. WHEN a file is modified by the AI THEN the Adnify SHALL automatically refresh the file tree
2. WHEN a file is modified by the AI THEN the Adnify SHALL update the open file content if it's currently open
3. WHEN a file is modified THEN the Adnify SHALL display a dirty indicator (dot) on the file tab
4. WHEN a file is created or deleted by the AI THEN the Adnify SHALL update the file tree immediately
5. WHEN external changes occur to watched files THEN the Adnify SHALL prompt the user to reload or show updated content

### Requirement 3: 消息流优化

**User Story:** As a developer, I want a clean and organized chat interface, so that I can easily follow the conversation flow.

#### Acceptance Criteria

1. WHEN the AI responds with text THEN the Adnify SHALL stream it smoothly without creating multiple messages
2. WHEN tool outputs are generated THEN the Adnify SHALL embed them within the tool call UI instead of separate messages
3. WHEN the AI is thinking THEN the Adnify SHALL display a subtle typing indicator
4. WHEN displaying code blocks THEN the Adnify SHALL use consistent syntax highlighting and styling
5. WHEN a message contains file references THEN the Adnify SHALL make them clickable to open the file

### Requirement 4: UI 一致性

**User Story:** As a developer, I want a consistent and polished UI, so that the editor feels professional and cohesive.

#### Acceptance Criteria

1. WHEN displaying tool call cards THEN the Adnify SHALL use consistent styling across all tool types
2. WHEN showing status indicators THEN the Adnify SHALL use a unified color scheme (success=green, error=red, pending=yellow)
3. WHEN animating UI elements THEN the Adnify SHALL use smooth, non-jarring transitions
4. WHEN displaying loading states THEN the Adnify SHALL use consistent spinner/skeleton patterns
5. WHEN showing file icons THEN the Adnify SHALL use consistent iconography based on file type

### Requirement 5: 编辑器状态同步

**User Story:** As a developer, I want the editor state to stay synchronized with AI actions, so that I always see the current state of my files.

#### Acceptance Criteria

1. WHEN the AI modifies a file THEN the Adnify SHALL update the editor content without losing cursor position
2. WHEN the AI creates a new file THEN the Adnify SHALL optionally open it in the editor
3. WHEN viewing a diff THEN the Adnify SHALL allow accepting or rejecting changes inline
4. WHEN the user has unsaved changes THEN the Adnify SHALL warn before AI overwrites the file
5. WHEN restoring from a checkpoint THEN the Adnify SHALL update all affected open files
