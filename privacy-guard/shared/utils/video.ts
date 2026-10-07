const MEDIA_EXTENSIONS = /\.(?:mp4|m4v|mov|webm|ogv|ogg|mkv|avi|mpg|mpeg|mpe|m2v|mpv|ts|mts|m2ts|mp3|wav|wave|m4a|aac|flac|oga|opus)$/iu

const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv',
  'video/mpeg': '.mpg',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/vnd.wave': '.wav',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/x-aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
}

export function downloadFileName(media: { name: string; mime: string }): string {
  const name = media.name.trim() || (media.mime.startsWith('audio/') ? 'audio' : 'video')
  if (MEDIA_EXTENSIONS.test(name)) return name
  const mime = media.mime.split(';', 1)[0]!.trim().toLowerCase()
  return name + (MIME_EXTENSIONS[mime] || '')
}
