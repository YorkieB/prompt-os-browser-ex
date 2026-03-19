/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace chrome {
  namespace runtime {
    const id: string | undefined
    const lastError: { message?: string } | null | undefined
    function sendMessage(message: unknown): Promise<unknown>
    function sendMessage(message: unknown, callback: (response: any) => void): void
    const onMessage: {
      addListener: (listener: (...args: any[]) => any) => void
    }
  }

  namespace tabs {
    function query(queryInfo: unknown, callback: (tabs: Array<{ id?: number; url?: string }>) => void): void
    function create(options: { url: string; active?: boolean }): void
    function sendMessage(tabId: number, message: unknown, callback: (response: any) => void): void
    function captureVisibleTab(
      windowId: number | undefined,
      options: { format?: 'png' | 'jpeg' },
      callback: (dataUrl: string) => void,
    ): void
  }

  namespace scripting {
    function executeScript(
      details: unknown,
      callback: (results?: Array<{ result?: unknown }>) => void,
    ): void
  }

  namespace sidePanel {
    function setPanelBehavior(behavior: unknown): Promise<void>
  }

  namespace storage {
    interface StorageChange { oldValue?: unknown; newValue?: unknown }

    const onChanged: {
      addListener: (callback: (changes: Record<string, StorageChange>, areaName: string) => void) => void
      removeListener: (callback: (changes: Record<string, StorageChange>, areaName: string) => void) => void
    }

    namespace local {
      function get(key: string | string[], callback: (items: Record<string, unknown>) => void): void
      function set(items: Record<string, unknown>, callback?: () => void): void
      function remove(key: string | string[], callback?: () => void): void
    }
  }
}
