import { WhitelistError, objectBody, onlyFields, UUID_PATTERN } from './whitelist-validation'

export function rtspAddress(value: unknown): string {
  const body = objectBody(value)
  onlyFields(body, ['url'])
  if (typeof body.url !== 'string') throw new WhitelistError(400, 'Укажите RTSP-адрес камеры.')
  if (/[\u0000-\u001f\u007f]/u.test(body.url)) throw new WhitelistError(400, 'Проверьте RTSP-адрес камеры.')
  const address = body.url.trim()
  if (!address || address.length > 2048 || /[\u0000-\u0020\u007f]/u.test(address)) {
    throw new WhitelistError(400, 'Проверьте RTSP-адрес камеры.')
  }
  let parsed: URL
  try {
    parsed = new URL(address)
  }
  catch {
    throw new WhitelistError(400, 'Проверьте RTSP-адрес камеры.')
  }
  if (!['rtsp:', 'rtsps:'].includes(parsed.protocol) || !parsed.hostname || parsed.hash) {
    throw new WhitelistError(400, 'Нужна ссылка, начинающаяся с rtsp:// или rtsps://.')
  }
  if (parsed.port && (Number(parsed.port) < 1 || Number(parsed.port) > 65535)) {
    throw new WhitelistError(400, 'Проверьте порт в адресе камеры.')
  }
  return parsed.href
}

export function rtspSessionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new WhitelistError(404, 'Подключение к камере не найдено.')
  }
  return value.toLowerCase()
}
