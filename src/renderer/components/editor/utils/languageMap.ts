/**
 * 编辑器语言映射
 */

import { getFileName } from '@utils/pathUtils'

// 语言映射
export const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Web
  html: 'html', htm: 'html', vue: 'html', svelte: 'html', css: 'css', scss: 'scss', less: 'scss',
  // Python
  py: 'python', pyw: 'python', pyi: 'python',
  // Java
  java: 'java', jar: 'java', class: 'java',
  // C / C++
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  // C#
  cs: 'csharp', csx: 'csharp',
  // Go
  go: 'go',
  // Rust
  rs: 'rust',
  // Ruby
  rb: 'ruby', erb: 'ruby',
  // PHP
  php: 'php',
  // Shell
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  // PowerShell
  ps1: 'powershell', psm1: 'powershell',
  // Data / Config
  json: 'json', jsonc: 'json',
  xml: 'xml', svg: 'xml', xaml: 'xml',
  yml: 'yaml', yaml: 'yaml',
  toml: 'ini', ini: 'ini', env: 'ini', conf: 'ini', properties: 'ini',
  md: 'markdown', mdx: 'markdown',
  sql: 'sql',
  // Mobile
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
  dart: 'dart',
  // Others
  lua: 'lua',
  r: 'r',
  pl: 'perl', pm: 'perl',
  clj: 'clojure', cljs: 'clojure', edn: 'clojure',
  scala: 'scala', sc: 'scala',
  groovy: 'groovy', gradle: 'groovy',
  m: 'objective-c', mm: 'objective-c',
  hs: 'haskell',
  ex: 'elixir', exs: 'elixir',
  erl: 'erlang', hr: 'erlang',
  fs: 'fsharp', fsi: 'fsharp', fsx: 'fsharp',
  v: 'verilog', vh: 'verilog',
  coffee: 'coffeescript',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  bat: 'bat', cmd: 'bat',
  diff: 'diff', patch: 'diff',
}

/**
 * 根据文件路径获取语言
 */
export function getLanguage(path: string): string {
  const fileName = getFileName(path).toLowerCase()

  // 特殊文件名
  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'makefile'
  if (fileName.startsWith('.env')) return 'ini'

  const ext = fileName.split('.').pop() || ''
  return LANGUAGE_MAP[ext] || 'plaintext'
}
