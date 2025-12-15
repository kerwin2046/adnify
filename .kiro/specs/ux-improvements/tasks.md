# Implementation Plan

## Phase 1: 工具调用 UI 重构

- [x] 1. 重构 ToolCallDisplay 组件





  - [x] 1.1 创建 ToolCallCard 组件




    - 创建 `src/renderer/components/ToolCallCard.tsx`
    - 实现紧凑模式和展开模式
    - 添加进度动画（spinner、脉冲效果）
    - _Requirements: 1.1, 1.4, 4.1_
  - [x] 1.2 实现文件编辑特殊显示


    - 对 edit_file/write_file 只显示文件名
    - 添加点击打开文件功能
    - 点击后在编辑器显示 diff
    - _Requirements: 1.2, 1.3_
  - [x] 1.3 优化工具结果内联显示


    - 工具结果嵌入卡片内部
    - 移除单独的 tool message
    - 添加折叠/展开功能
    - _Requirements: 1.6, 3.2_

- [ ] 2. Checkpoint - 确保工具调用 UI 正常工作
  - 确保所有测试通过，如有问题请询问用户

## Phase 2: 文件系统监听

- [ ] 3. 实现文件监听服务
  - [ ] 3.1 创建 FileWatcherService
    - 创建 `src/renderer/services/fileWatcherService.ts`
    - 实现 IPC 通信监听文件变化
    - 添加防抖处理避免频繁刷新
    - _Requirements: 2.1, 2.4_
  - [ ] 3.2 添加主进程文件监听
    - 在 main.ts 添加 fs.watch 监听
    - 实现 IPC 事件发送
    - 处理监听器清理
    - _Requirements: 2.1_
  - [ ] 3.3 集成到 Sidebar
    - 文件变化时自动刷新文件树
    - 添加刷新动画反馈
    - _Requirements: 2.1, 2.4_


- [ ] 4. Checkpoint - 确保文件监听正常工作
  - 确保所有测试通过，如有问题请询问用户

## Phase 3: 编辑器状态同步

- [ ] 5. 实现打开文件自动更新
  - [ ] 5.1 扩展 Store 状态
    - 添加 fileStates Map 跟踪文件状态
    - 添加 externallyModified 标记
    - 实现 updateFileFromExternal action
    - _Requirements: 2.2, 2.3_
  - [ ] 5.2 实现文件修改标记
    - 在文件标签显示修改点
    - 在文件树显示修改状态
    - 区分本地修改和外部修改
    - _Requirements: 2.3_
  - [ ] 5.3 处理外部修改冲突
    - 检测外部修改时提示用户
    - 提供重新加载或保留本地选项
    - _Requirements: 2.5, 5.4_

- [ ] 6. Checkpoint - 确保编辑器状态同步正常
  - 确保所有测试通过，如有问题请询问用户

## Phase 4: 消息流优化

- [ ] 7. 优化 ChatPanel 消息显示
  - [ ] 7.1 移除 tool message 单独显示
    - 修改 useAgent 不再为工具输出创建单独消息
    - 工具结果直接更新到 toolCallsUI 状态
    - _Requirements: 3.2_
  - [ ] 7.2 优化流式响应显示
    - 确保文本流式显示平滑
    - 添加打字指示器
    - 避免消息闪烁
    - _Requirements: 3.1, 3.3_
  - [ ] 7.3 添加文件引用点击
    - 解析消息中的文件路径
    - 添加点击打开功能
    - _Requirements: 3.5_

- [ ] 8. Checkpoint - 确保消息流优化正常
  - 确保所有测试通过，如有问题请询问用户

## Phase 5: UI 一致性

- [ ] 9. 统一样式和动画
  - [ ] 9.1 创建统一的状态指示器组件
    - 创建 `src/renderer/components/StatusIndicator.tsx`
    - 统一颜色方案
    - 统一动画效果
    - _Requirements: 4.2, 4.3_
  - [ ] 9.2 统一加载状态显示
    - 创建统一的 Spinner 组件
    - 创建 Skeleton 加载占位
    - _Requirements: 4.4_
  - [ ] 9.3 统一文件图标
    - 创建 FileIcon 组件
    - 根据文件类型显示不同图标和颜色
    - _Requirements: 4.5_

- [ ] 10. Final Checkpoint - 确保所有改进正常工作
  - 确保所有测试通过，如有问题请询问用户
