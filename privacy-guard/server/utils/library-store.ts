import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { LibraryEntry, LibraryKind, LibraryMediaType, LibraryState } from '../../shared/types/library'
import { libraryKind, libraryMediaType, libraryName, videoDuration, videoLimit, videoMime } from './library-validation'
import { enabledFlag, objectBody, onlyFields, validateId, WhitelistError } from './whitelist-validation'

interface SavedState extends LibraryState {
  version: 1
}

export interface LibraryUpload {
  name: string
  kind: LibraryKind
  mediaType: LibraryMediaType
  mime: string
  duration: number | null
  parentId: string | null
}

function missing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function parseState(value: unknown): SavedState {
  const body = objectBody(value)
  if (body.version !== 1 || !Array.isArray(body.entries)) throw new Error('Invalid library')
  const ids = new Set<string>()
  const entries = body.entries.map((value: unknown): LibraryEntry => {
    const entry = objectBody(value)
    const id = validateId(entry.id)
    const name = libraryName(entry.name)
    const kind = libraryKind(entry.kind)
    const mime = videoMime(entry.mime)
    const mediaType = libraryMediaType(mime)
    const duration = videoDuration(entry.duration)
    if (ids.has(id) || name !== entry.name || mime !== entry.mime || typeof entry.size !== 'number'
      || (entry.mediaType !== undefined && entry.mediaType !== mediaType)
      || !Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > videoLimit(kind, mediaType)
      || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))
      || new Date(entry.createdAt).toISOString() !== entry.createdAt || entry.thumbnail !== null) {
      throw new Error('Invalid library entry')
    }
    ids.add(id)
    return {
      id, name, kind, mediaType, mime, duration, size: entry.size, createdAt: entry.createdAt,
      favorite: enabledFlag(entry.favorite), thumbnail: null,
      parentId: entry.parentId === null ? null : validateId(entry.parentId),
    }
  })
  return { version: 1, entries }
}

/** Metadata commits are serialized; media is streamed directly to disk. */
export class LibraryStore {
  readonly directory: string
  private state: SavedState | undefined
  private queue: Promise<unknown> = Promise.resolve()

  constructor(directory: string) {
    this.directory = resolve(directory)
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }

  private async load(): Promise<SavedState> {
    if (this.state) return this.state
    let contents: string
    try {
      contents = await readFile(join(this.directory, 'library.json'), 'utf8')
    }
    catch (error) {
      if (missing(error)) return this.state = { version: 1, entries: [] }
      throw new WhitelistError(503, 'Не удалось открыть библиотеку.')
    }
    try {
      return this.state = parseState(JSON.parse(contents))
    }
    catch {
      throw new WhitelistError(503, 'Не удалось прочитать библиотеку. Сохранённые файлы не изменены.')
    }
  }

  private async commit(next: SavedState): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const temporary = join(this.directory, `library-${randomUUID()}.tmp`)
    try {
      const file = await open(temporary, 'wx', 0o600)
      try {
        await file.writeFile(`${JSON.stringify(next, null, 2)}\n`, 'utf8')
        await file.sync()
      }
      finally {
        await file.close()
      }
      await rename(temporary, join(this.directory, 'library.json'))
      this.state = next
    }
    catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }
  }

  private mediaPath(id: string): string {
    return join(this.directory, 'library', 'media', `${validateId(id)}.video`)
  }

  private find(state: SavedState, id: string): LibraryEntry {
    const entry = state.entries.find(item => item.id === id)
    if (!entry) throw new WhitelistError(404, 'Запись не найдена.')
    return entry
  }

  private publicEntry(entry: LibraryEntry, state: SavedState): LibraryEntry {
    return {
      ...entry,
      parentId: entry.parentId && state.entries.some(item => item.id === entry.parentId) ? entry.parentId : null,
    }
  }

  getState(): Promise<LibraryState> {
    return this.serialized(async () => {
      const state = await this.load()
      return { entries: state.entries.map(entry => this.publicEntry(entry, state)) }
    })
  }

  getEntry(value: unknown): Promise<LibraryEntry> {
    const id = validateId(value)
    return this.serialized(async () => {
      const state = await this.load()
      return this.publicEntry(this.find(state, id), state)
    })
  }

  async add(input: LibraryUpload, receive: (path: string, limit: number) => Promise<number>): Promise<LibraryEntry> {
    await this.getState()
    const id = randomUUID()
    await mkdir(join(this.directory, 'library', 'media'), { recursive: true, mode: 0o700 })
    const temporary = join(this.directory, 'library', 'media', `${id}.upload`)
    let moved = false
    try {
      const size = await receive(temporary, videoLimit(input.kind, input.mediaType))
      if (!Number.isSafeInteger(size) || size < 1) throw new WhitelistError(400, 'Файл пустой.')
      const file = await open(temporary, 'r+')
      try {
        await file.sync()
      }
      finally {
        await file.close()
      }
      return await this.serialized(async () => {
        const state = await this.load()
        const entry: LibraryEntry = {
          ...input, id, size, createdAt: new Date().toISOString(), favorite: false, thumbnail: null,
          parentId: input.parentId && state.entries.some(item => item.id === input.parentId) ? input.parentId : null,
        }
        await rename(temporary, this.mediaPath(id))
        moved = true
        await this.commit({ version: 1, entries: [entry, ...state.entries] })
        return entry
      })
    }
    catch (error) {
      await unlink(moved ? this.mediaPath(id) : temporary).catch(() => undefined)
      throw error
    }
  }

  update(value: unknown, input: unknown): Promise<LibraryEntry> {
    const id = validateId(value)
    const body = objectBody(input)
    onlyFields(body, ['name', 'favorite'])
    if (!Object.keys(body).length) throw new WhitelistError(400, 'Нет изменений для сохранения.')
    return this.serialized(async () => {
      const state = await this.load()
      const previous = this.find(state, id)
      const entry = {
        ...previous,
        ...('name' in body ? { name: libraryName(body.name) } : {}),
        ...('favorite' in body ? { favorite: enabledFlag(body.favorite) } : {}),
      }
      const next = { version: 1 as const, entries: state.entries.map(item => item.id === id ? entry : item) }
      await this.commit(next)
      return this.publicEntry(entry, next)
    })
  }

  remove(value: unknown): Promise<{ ok: true }> {
    const id = validateId(value)
    return this.serialized(async () => {
      const state = await this.load()
      this.find(state, id)
      await this.commit({ version: 1, entries: state.entries.filter(entry => entry.id !== id) })
      try {
        await unlink(this.mediaPath(id))
      }
      catch (error) {
        if (!missing(error)) {
          await this.commit(state)
          throw new WhitelistError(503, 'Не удалось удалить файл. Попробуйте ещё раз.')
        }
      }
      return { ok: true }
    })
  }

  openMedia(value: unknown): Promise<{ entry: LibraryEntry, file: FileHandle }> {
    const id = validateId(value)
    return this.serialized(async () => {
      const state = await this.load()
      const entry = this.publicEntry(this.find(state, id), state)
      try {
        const file = await open(this.mediaPath(id), 'r')
        try {
          const stat = await file.stat()
          if (stat.size !== entry.size || !stat.isFile()) throw new WhitelistError(503, 'Не удалось открыть файл.')
          return { entry, file }
        }
        catch (error) {
          await file.close().catch(() => undefined)
          throw error
        }
      }
      catch (error) {
        if (missing(error)) throw new WhitelistError(404, 'Файл не найден.')
        throw error
      }
    })
  }
}

const GLOBAL_STORE = Symbol.for('privacy-guard.library-store')
const storeGlobal = globalThis as typeof globalThis & { [GLOBAL_STORE]?: LibraryStore }

export function getLibraryStore(): LibraryStore {
  return storeGlobal[GLOBAL_STORE] ??= new LibraryStore(process.env.PRIVACY_GUARD_DATA_DIR || resolve(process.cwd(), 'data'))
}
