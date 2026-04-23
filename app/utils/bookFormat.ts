export type BookFormat = 'epub' | 'txt'

const normalizeMimeType = (value: string) => value.trim().toLowerCase()

export const normalizeBookFormat = (value: unknown): BookFormat | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'epub') return 'epub'
  if (normalized === 'txt') return 'txt'
  return null
}

export const inferBookFormatFromNameAndType = (
  fileName: string,
  mimeType?: string | null
): BookFormat | null => {
  const normalizedName = fileName.trim().toLowerCase()
  const normalizedType = normalizeMimeType(mimeType || '')

  if (normalizedName.endsWith('.epub') || normalizedType === 'application/epub+zip') {
    return 'epub'
  }

  if (
    normalizedName.endsWith('.txt') ||
    normalizedType === 'text/plain' ||
    normalizedType === 'application/text'
  ) {
    return 'txt'
  }

  return null
}

export const inferBookFormatFromBlob = (blob: Blob): BookFormat | null => {
  const normalizedType = normalizeMimeType(blob.type || '')
  if (normalizedType === 'application/epub+zip') return 'epub'
  if (normalizedType === 'text/plain' || normalizedType === 'application/text') return 'txt'
  return null
}

export const deriveBookTitleFromFileName = (fileName: string) => {
  const trimmed = fileName.trim()
  const noExt = trimmed.replace(/\.(epub|txt)$/i, '').trim()
  return noExt || '未命名书籍'
}
