import { createWriteStream } from 'node:fs'
import { getQuery, getRequestHeader, sendStream, setHeader, setResponseStatus, type H3Event } from 'h3'
import { downloadFileName } from '../../shared/utils/video'
import { getLibraryStore, type LibraryUpload } from './library-store'
import { libraryKind, libraryMediaType, libraryName, videoDuration, videoLimit, videoMime } from './library-validation'
import { validateId, WhitelistError } from './whitelist-validation'

export function readLibraryUpload(event: H3Event): LibraryUpload {
  let name: string
  try {
    name = decodeURIComponent(getRequestHeader(event, 'x-file-name') || '')
  }
  catch {
    throw new WhitelistError(400, 'Проверьте название файла.')
  }
  const kind = libraryKind(getRequestHeader(event, 'x-video-kind') || 'source')
  const mime = videoMime(getRequestHeader(event, 'content-type'))
  const mediaType = libraryMediaType(mime)
  const length = getRequestHeader(event, 'content-length')
  if (length && (!/^\d+$/u.test(length) || Number(length) > videoLimit(kind, mediaType))) {
    throw new WhitelistError(413, 'Файл слишком большой для сохранения.')
  }
  const parent = getRequestHeader(event, 'x-parent-id')
  return {
    name: libraryName(name), kind, mime, mediaType,
    duration: videoDuration(getRequestHeader(event, 'x-video-duration')),
    parentId: parent ? validateId(parent) : null,
  }
}

/** Backpressure keeps uploads bounded to the request and file stream buffers. */
export function receiveLibraryVideo(event: H3Event, path: string, limit: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = event.node.req
    const writer = createWriteStream(path, { flags: 'wx', mode: 0o600 })
    let bytes = 0
    let ended = false
    let written = false
    let failure: WhitelistError | undefined
    let timer: ReturnType<typeof setTimeout>
    const stopRequest = () => {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('error', onRequestError)
      request.off('aborted', onRequestError)
      writer.off('drain', onDrain)
      clearTimeout(timer)
    }
    const fail = (error: WhitelistError) => {
      if (failure || written) return
      failure = error
      stopRequest()
      request.pause()
      if (!event.node.res.headersSent && !event.node.res.destroyed) {
        setHeader(event, 'Connection', 'close')
        event.node.res.once('finish', () => request.destroy())
      }
      writer.destroy()
    }
    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => fail(new WhitelistError(408, 'Загрузка прервалась. Попробуйте ещё раз.')), 60_000)
      timer.unref()
    }
    const onDrain = () => {
      if (!failure && !ended) request.resume()
    }
    const onData = (data: Buffer | string) => {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data)
      bytes += chunk.length
      if (bytes > limit) {
        fail(new WhitelistError(413, 'Файл слишком большой для сохранения.'))
        return
      }
      resetTimer()
      if (!writer.write(chunk)) request.pause()
    }
    const onEnd = () => {
      ended = true
      clearTimeout(timer)
      if (!bytes) {
        fail(new WhitelistError(400, 'Файл пустой.'))
        return
      }
      writer.end()
    }
    const onRequestError = () => fail(new WhitelistError(400, 'Загрузка прервана. Попробуйте ещё раз.'))
    writer.on('drain', onDrain)
    writer.once('error', () => fail(new WhitelistError(503, 'Не удалось сохранить файл.')))
    writer.once('finish', () => { written = true })
    writer.once('close', () => {
      stopRequest()
      if (failure) reject(failure)
      else if (written) resolve(bytes)
      else reject(new WhitelistError(503, 'Не удалось сохранить файл.'))
    })
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onRequestError)
    request.once('aborted', onRequestError)
    resetTimer()
    if (request.readableEnded) onEnd()
    else request.resume()
  })
}

export function videoByteRange(header: string | undefined, size: number): { start: number, end: number } | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim())
  if (!match || (!match[1] && !match[2])) throw new WhitelistError(416, 'Этот фрагмент файла недоступен.')
  let start: number
  let end: number
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix < 1) throw new WhitelistError(416, 'Этот фрагмент файла недоступен.')
    start = Math.max(0, size - suffix)
    end = size - 1
  }
  else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      throw new WhitelistError(416, 'Этот фрагмент файла недоступен.')
    }
    end = Math.min(end, size - 1)
  }
  return { start, end }
}

export async function sendLibraryVideo(event: H3Event): Promise<unknown> {
  const { entry, file } = await getLibraryStore().openMedia(event.context.params?.id)
  let streamed = false
  try {
    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'Cache-Control', 'private, no-cache')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    let range: { start: number, end: number } | null
    try {
      range = videoByteRange(getRequestHeader(event, 'range'), entry.size)
    }
    catch (error) {
      setHeader(event, 'Content-Range', `bytes */${entry.size}`)
      throw error
    }
    setHeader(event, 'Content-Type', entry.mime)
    const disposition = getQuery(event).download === '1' ? 'attachment' : 'inline'
    setHeader(event, 'Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(downloadFileName(entry)).replace(/['()*]/gu, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`)
    setHeader(event, 'Content-Length', String(range ? range.end - range.start + 1 : entry.size))
    if (range) {
      setResponseStatus(event, 206)
      setHeader(event, 'Content-Range', `bytes ${range.start}-${range.end}/${entry.size}`)
    }
    if (event.method === 'HEAD') return ''
    const stream = file.createReadStream(range ? { start: range.start, end: range.end } : {})
    streamed = true
    event.node.res.once('close', () => stream.destroy())
    return await sendStream(event, stream)
  }
  finally {
    if (!streamed) await file.close()
  }
}
