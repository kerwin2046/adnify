/**
 * 工具参数 Schema
 * 从统一配置中心导出，保持向后兼容
 */

export { TOOL_SCHEMAS } from '@/shared/config/tools'

// 为需要直接访问单个 schema 的代码导出
import { TOOL_SCHEMAS } from '@/shared/config/tools'

export const ReadFileSchema = TOOL_SCHEMAS.read_file
export const ListDirectorySchema = TOOL_SCHEMAS.list_directory
export const GetDirTreeSchema = TOOL_SCHEMAS.get_dir_tree
export const SearchFilesSchema = TOOL_SCHEMAS.search_files
export const ReadMultipleFilesSchema = TOOL_SCHEMAS.read_multiple_files
export const SearchInFileSchema = TOOL_SCHEMAS.search_in_file
export const EditFileSchema = TOOL_SCHEMAS.edit_file
export const WriteFileSchema = TOOL_SCHEMAS.write_file
export const ReplaceFileContentSchema = TOOL_SCHEMAS.replace_file_content
export const CreateFileOrFolderSchema = TOOL_SCHEMAS.create_file_or_folder
export const DeleteFileOrFolderSchema = TOOL_SCHEMAS.delete_file_or_folder
export const RunCommandSchema = TOOL_SCHEMAS.run_command
export const CodebaseSearchSchema = TOOL_SCHEMAS.codebase_search
export const LspLocationSchema = TOOL_SCHEMAS.find_references
export const GetDocumentSymbolsSchema = TOOL_SCHEMAS.get_document_symbols
export const GetLintErrorsSchema = TOOL_SCHEMAS.get_lint_errors
export const WebSearchSchema = TOOL_SCHEMAS.web_search
export const ReadUrlSchema = TOOL_SCHEMAS.read_url
export const CreatePlanSchema = TOOL_SCHEMAS.create_plan
export const UpdatePlanSchema = TOOL_SCHEMAS.update_plan
