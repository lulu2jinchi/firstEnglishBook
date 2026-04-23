type TxtManifestBuildResult = {
  manifestUrl: string
  resources: Array<{
    url: string
    contentType: string
    body: string
  }>
}

const maxChapterParagraphs = 80
const maxChapterChars = 12000

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char)

const normalizeTxtContent = (rawText: string) => rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

const splitParagraphs = (rawText: string) => {
  const text = normalizeTxtContent(rawText)
  const blocks = text.split(/\n{2,}/)
  const paragraphs = blocks
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean).join(' '))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  if (paragraphs.length > 0) return paragraphs
  const fallback = text.trim()
  return fallback ? [fallback] : ['(Empty text file)']
}

const chunkParagraphs = (paragraphs: string[]) => {
  const chapters: string[][] = []
  let current: string[] = []
  let currentChars = 0

  paragraphs.forEach((paragraph) => {
    const nextChars = currentChars + paragraph.length
    const shouldSplit =
      current.length > 0 &&
      (current.length >= maxChapterParagraphs || nextChars > maxChapterChars)
    if (shouldSplit) {
      chapters.push(current)
      current = []
      currentChars = 0
    }
    current.push(paragraph)
    currentChars += paragraph.length
  })

  if (current.length > 0) {
    chapters.push(current)
  }

  return chapters
}

const createChapterHtml = (bookTitle: string, chapterTitle: string, paragraphs: string[]) => {
  const body = paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n')
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(chapterTitle)}</title>`,
    '</head>',
    '<body>',
    `<section aria-label="${escapeHtml(bookTitle)}">`,
    body,
    '</section>',
    '</body>',
    '</html>'
  ].join('\n')
}

export const buildTxtManifestFromBlob = async (
  blob: Blob,
  bookTitle: string
): Promise<TxtManifestBuildResult> => {
  const rawText = await blob.text()
  const paragraphs = splitParagraphs(rawText)
  const chapters = chunkParagraphs(paragraphs)
  const bookId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const baseUrl = `https://txt.local/${bookId}/`
  const manifestUrl = `${baseUrl}manifest.json`

  const chapterResources = chapters.map((chapterParagraphs, index) => {
    const relativeHref = `chapters/chapter-${index + 1}.html`
    const chapterTitle =
      chapters.length > 1 ? `${bookTitle} - Chapter ${index + 1}` : `${bookTitle}`
    const html = createChapterHtml(bookTitle, chapterTitle, chapterParagraphs)
    return {
      href: relativeHref,
      url: `${baseUrl}${relativeHref}`,
      body: html
    }
  })

  const toc = chapterResources.map((resource, index) => ({
    href: resource.href,
    title: chapters.length > 1 ? `Chapter ${index + 1}` : 'Text'
  }))

  const manifest = {
    metadata: {
      title: bookTitle,
      identifier: `txt-${Date.now()}`,
      language: 'en'
    },
    readingOrder: chapterResources.map((resource, index) => ({
      id: `chapter-${index + 1}`,
      href: resource.href,
      type: 'text/html',
      properties: [],
      linear: 'yes'
    })),
    resources: chapterResources.map((resource, index) => ({
      id: `res-chapter-${index + 1}`,
      href: resource.href,
      type: 'text/html',
      properties: []
    })),
    toc
  }

  return {
    manifestUrl,
    resources: [
      {
        url: manifestUrl,
        contentType: 'application/webpub+json',
        body: JSON.stringify(manifest)
      },
      ...chapterResources.map((resource) => ({
        url: resource.url,
        contentType: 'text/html;charset=utf-8',
        body: resource.body
      }))
    ]
  }
}
