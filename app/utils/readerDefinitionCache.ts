import Dexie, { type Table } from 'dexie'
import { DEFINITION_CACHE_BUST_STORAGE_KEY } from '~/constants/storageKeys'

type DefinitionRecord = {
  key: string
  bookKey: string
  paragraphId: string
  sentence: string
  meaning: Record<string, string>
  updatedAt: number
}

class ReaderDefinitionCacheDB extends Dexie {
  definitions!: Table<DefinitionRecord, string>

  constructor() {
    super('reader-definition-cache')
    this.version(2).stores({
      definitions: 'key, bookKey, paragraphId, updatedAt',
      locations: 'bookKey, updatedAt'
    })
    this.definitions = this.table('definitions')
  }
}

let readerDefinitionCacheDb: ReaderDefinitionCacheDB | null = null

const ensureReaderDefinitionCacheDb = () => {
  if (readerDefinitionCacheDb) return readerDefinitionCacheDb
  if (typeof window === 'undefined') return null
  readerDefinitionCacheDb = new ReaderDefinitionCacheDB()
  return readerDefinitionCacheDb
}

export const clearDefinitionCacheSilently = async () => {
  const db = ensureReaderDefinitionCacheDb()
  if (!db) return
  try {
    await db.definitions.clear()
  } catch {
    // ignore cache clear failure
  }
}

export const broadcastDefinitionCacheBust = () => {
  if (typeof window === 'undefined') return
  try {
    const payload = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(DEFINITION_CACHE_BUST_STORAGE_KEY, payload)
  } catch {
    // ignore broadcast failure
  }
}
