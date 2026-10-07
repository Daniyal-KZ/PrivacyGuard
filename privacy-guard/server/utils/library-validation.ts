import type { LibraryKind, LibraryMediaType } from '../../shared/types/library'
import { WhitelistError } from './whitelist-validation'

export const VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
  'video/x-msvideo', 'video/x-matroska', 'video/ogg', 'video/mpeg',
])

export const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac',
])

const MIME_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-flac': 'audio/flac',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
  'audio/opus': 'audio/ogg',
}

export function libraryName(value: unknown): string {
  if (typeof value !== 'string') throw new WhitelistError(400, 'Укажите название файла.')
  const name = value.replace(/[\u0000-\u001f\u007f]/gu, '').trim()
  if (!name || name.length > 255) throw new WhitelistError(400, 'Название должно содержать от 1 до 255 символов.')
  return name
}

export function libraryKind(value: unknown): LibraryKind {
  if (value !== 'source' && value !== 'result' && value !== 'camera') {
    throw new WhitelistError(400, 'Выберите тип записи.')
  }
  return value
}

export function videoMime(value: unknown): string {
  if (typeof value !== 'string') throw new WhitelistError(415, 'Выберите видео или аудиофайл.')
  const requested = value.split(';', 1)[0]!.trim().toLowerCase()
  const mime = MIME_ALIASES[requested] || requested
  if (!VIDEO_MIMES.has(mime) && !AUDIO_MIMES.has(mime)) throw new WhitelistError(415, 'Этот формат файла не поддерживается.')
  return mime
}

export function libraryMediaType(mime: string): LibraryMediaType {
  return mime.startsWith('audio/') ? 'audio' : 'video'
}

export function videoDuration(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const duration = typeof value === 'string' ? Number(value) : value
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 || duration > 31_536_000) {
    throw new WhitelistError(400, 'Не удалось прочитать длительность записи.')
  }
  return duration
}

export function videoLimit(kind: LibraryKind, mediaType: LibraryMediaType = 'video'): number {
  return (kind === 'source' && mediaType === 'video' ? 2048 : 512) * 1024 * 1024
}
