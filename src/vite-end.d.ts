/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local Nexus → Cursor HTTP bridge (e.g. http://127.0.0.1:17373). See prompt-os/docs/cursor-bridge.md */
  readonly VITE_PROMPT_OS_CURSOR_BRIDGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.hbs?raw' {
  const src: string
  export default src
}

declare module '*.md?raw' {
  const src: string
  export default src
}
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

declare global {
  interface Window {
    spark: {
      llmPrompt: (strings: readonly string[], ...values: unknown[]) => string
      llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
      user: () => Promise<UserInfo>
      kv: {
        keys: () => Promise<string[]>
        get: <T>(key: string) => Promise<T | undefined>
        set: <T>(key: string, value: T) => Promise<void>
        delete: (key: string) => Promise<void>
      }
    }
  }

  const spark: Window['spark']
}