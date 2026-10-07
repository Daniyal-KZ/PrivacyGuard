import type { LibraryEntry, LibraryKind } from '~/shared/types/library'

interface UploadOptions {
  name: string
  kind?: LibraryKind
  duration?: number | null
  parentId?: string | null
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export function useVideoLibrary() {
  const entries = useState<LibraryEntry[]>('video-library', () => [])
  const revision = useState('video-library-revision', () => 0)
  const loading = ref(false)
  const t = useLibraryCopy()
  let pendingLoad: Promise<void> | null = null

  function message(cause: unknown, fallback: string): string {
    const failure = cause as { data?: { data?: { message?: string }; message?: string } }
    return failure?.data?.data?.message || failure?.data?.message || fallback
  }

  function remember(entry: LibraryEntry) {
    entries.value = [entry, ...entries.value.filter(item => item.id !== entry.id)]
    revision.value++
    return entry
  }

  function load(): Promise<void> {
    if (pendingLoad) return pendingLoad
    const requestedRevision = revision.value
    loading.value = true
    pendingLoad = (async () => {
      try {
        const result = await $fetch<{ entries: LibraryEntry[] }>('/api/library')
        if (revision.value === requestedRevision) entries.value = result.entries
      } catch (cause) {
        throw new Error(message(cause, t.value.openError))
      } finally {
        loading.value = false
        pendingLoad = null
      }
    })()
    return pendingLoad
  }

  async function get(id: string): Promise<LibraryEntry> {
    try {
      return await $fetch<LibraryEntry>(`/api/library/${encodeURIComponent(id)}`)
    } catch (cause) {
      throw new Error(message(cause, t.value.openError))
    }
  }

  function upload(blob: Blob, options: UploadOptions): Promise<LibraryEntry> {
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'))
        return
      }
      const request = new XMLHttpRequest()
      const abort = () => request.abort()
      const cleanup = () => options.signal?.removeEventListener('abort', abort)
      request.open('POST', '/api/library')
      const blobMime = blob.type.split(';')[0]?.trim().toLowerCase()
      const mime = blobMime && /^(audio|video)\//.test(blobMime) ? blobMime : mimeFromName(options.name)
      request.setRequestHeader('Content-Type', mime)
      request.setRequestHeader('X-File-Name', encodeURIComponent(options.name))
      request.setRequestHeader('X-Video-Kind', options.kind || 'source')
      if (options.duration != null && Number.isFinite(options.duration)) {
        request.setRequestHeader('X-Video-Duration', String(options.duration))
      }
      if (options.parentId) request.setRequestHeader('X-Parent-Id', options.parentId)
      request.upload.onprogress = event => {
        if (event.lengthComputable) options.onProgress?.(Math.round(event.loaded / event.total * 100))
      }
      request.onload = () => {
        cleanup()
        let response: unknown
        try { response = JSON.parse(request.responseText) } catch { /* Handle an incomplete response below. */ }
        if (request.status >= 200 && request.status < 300 && response && typeof response === 'object' && 'id' in response) {
          options.onProgress?.(100)
          resolve(remember(response as LibraryEntry))
        } else {
          reject(new Error(message({ data: response }, t.value.saveError)))
        }
      }
      request.onerror = () => { cleanup(); reject(new Error(t.value.saveError)) }
      request.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')) }
      options.signal?.addEventListener('abort', abort, { once: true })
      request.send(blob)
    })
  }

  async function update(id: string, changes: Partial<Pick<LibraryEntry, 'name' | 'favorite'>>): Promise<LibraryEntry> {
    try {
      return remember(await $fetch<LibraryEntry>(`/api/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }))
    } catch (cause) {
      throw new Error(message(cause, t.value.saveError))
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await $fetch(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' })
      entries.value = entries.value.filter(entry => entry.id !== id)
        .map(entry => entry.parentId === id ? { ...entry, parentId: null } : entry)
      revision.value++
    } catch (cause) {
      throw new Error(message(cause, t.value.saveError))
    }
  }

  function videoUrl(id: string, download = false) {
    return `/api/library/${encodeURIComponent(id)}/video${download ? '?download=1' : ''}`
  }

  return { entries, loading, load, get, upload, update, remove, videoUrl }
}

function mimeFromName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    ogv: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mpg: 'video/mpeg', mpeg: 'video/mpeg',
    mp3: 'audio/mpeg', wav: 'audio/wav', wave: 'audio/wav', m4a: 'audio/mp4',
    aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', weba: 'audio/webm',
  }
  return types[extension] || 'application/octet-stream'
}
