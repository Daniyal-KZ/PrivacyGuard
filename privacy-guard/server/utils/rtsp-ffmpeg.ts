import { accessSync, constants } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { WhitelistError } from './whitelist-validation'

/** Resolve from the application root in both Nuxt dev and a bundled Nitro server. */
export function ffmpegExecutable(): string {
  const configured = process.env.PRIVACY_GUARD_FFMPEG || process.env.FFMPEG_PATH
  if (configured) {
    try {
      accessSync(configured, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
      return configured
    }
    catch {
      throw new WhitelistError(503, 'FFmpeg недоступен. Проверьте путь к программе.')
    }
  }
  try {
    const require = createRequire(join(process.cwd(), 'package.json'))
    const executable = require('ffmpeg-static') as unknown
    if (typeof executable === 'string' && executable) {
      accessSync(executable, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
      return executable
    }
  }
  catch { /* A system FFmpeg installation is also supported. */ }
  return 'ffmpeg'
}
