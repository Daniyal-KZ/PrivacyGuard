import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import type { RtspConnection } from '../../shared/types/camera'
import { ffmpegExecutable } from './rtsp-ffmpeg'
import { rtspSessionId } from './rtsp-validation'
import { WhitelistError } from './whitelist-validation'

const MAX_SESSIONS = 4
const MAX_FRAME_BYTES = 8 * 1024 * 1024
const MAX_HEADER_BYTES = 8192
const FIRST_FRAME_TIMEOUT = 30_000
const IDLE_TIMEOUT = 15_000

interface Viewer {
  stream: PassThrough
  pending: Buffer | null
  blocked: boolean
}

interface Session {
  id: string
  child: ChildProcessWithoutNullStreams
  viewers: Set<Viewer>
  latestFrame: Buffer | null
  pendingOutput: Buffer
  stderr: string
  ready: Promise<void>
  resolveReady: () => void
  rejectReady: (error: WhitelistError) => void
  closed: Promise<void>
  connectTimer: ReturnType<typeof setTimeout> | null
  idleTimer: ReturnType<typeof setTimeout> | null
  killTimer: ReturnType<typeof setTimeout> | null
  stopped: boolean
  everViewed: boolean
}

function unavailable(stderr: string): WhitelistError {
  if (/\b401\b|\b403\b|unauthorized|authentication|authorization/iu.test(stderr)) {
    return new WhitelistError(502, 'Камера отклонила подключение. Проверьте логин и пароль в RTSP-адресе.')
  }
  return new WhitelistError(502, 'Не удалось подключиться к камере. Проверьте адрес и доступность камеры в сети.')
}

function multipartFrame(frame: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`, 'ascii'),
    frame,
    Buffer.from('\r\n', 'ascii'),
  ])
}

class RtspManager {
  private readonly sessions = new Map<string, Session>()
  private readonly closing = new Set<Promise<void>>()

  async connect(url: string, signal?: AbortSignal): Promise<RtspConnection> {
    if (signal?.aborted) throw new WhitelistError(400, 'Подключение отменено.')
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new WhitelistError(409, 'Закройте одно из подключений к камерам и попробуйте ещё раз.')
    }
    const executable = ffmpegExecutable()
    const child = spawn(executable, [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-rtsp_transport', 'tcp', '-timeout', '8000000', '-i', url,
      '-map', '0:v:0', '-an', '-sn', '-dn',
      '-vf', "fps=15,scale=w='min(1280,iw)':h=-2",
      '-c:v', 'mjpeg', '-q:v', '5', '-threads', '2',
      '-f', 'mpjpeg', '-boundary_tag', 'frame', '-flush_packets', '1', 'pipe:1',
    ], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    child.stdin.end()
    let resolveReady!: () => void
    let rejectReady!: (error: WhitelistError) => void
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
    const closed = new Promise<void>(resolve => { child.once('close', () => resolve()) })
    const session: Session = {
      id: randomUUID(), child, viewers: new Set(), latestFrame: null, pendingOutput: Buffer.alloc(0), stderr: '',
      ready, resolveReady, rejectReady, closed, connectTimer: null, idleTimer: null, killTimer: null,
      stopped: false, everViewed: false,
    }
    this.sessions.set(session.id, session)
    this.closing.add(closed)
    void closed.finally(() => this.closing.delete(closed))
    child.stdout.on('data', (chunk: Buffer) => this.receive(session, chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      // Only retain a small private diagnostic window; never print camera credentials.
      session.stderr = (session.stderr + chunk.toString('utf8')).slice(-8192)
    })
    child.once('error', () => {
      this.stop(session, new WhitelistError(503, 'FFmpeg не найден. Установите зависимости приложения или укажите путь к FFmpeg.'))
    })
    child.once('close', () => {
      if (session.killTimer) clearTimeout(session.killTimer)
      session.killTimer = null
      this.stop(session, unavailable(session.stderr))
    })
    session.connectTimer = setTimeout(() => this.stop(session, new WhitelistError(502, 'Камера не передала изображение. Проверьте RTSP-адрес и подключение к сети.')), FIRST_FRAME_TIMEOUT)
    session.connectTimer.unref()
    const abort = () => this.stop(session, new WhitelistError(400, 'Подключение отменено.'))
    signal?.addEventListener('abort', abort, { once: true })
    try {
      await ready
      if (signal?.aborted || session.stopped) throw new WhitelistError(400, 'Подключение отменено.')
      session.idleTimer = setTimeout(() => this.stop(session), IDLE_TIMEOUT)
      session.idleTimer.unref()
      return { id: session.id, streamUrl: `/api/camera/rtsp/${session.id}/stream` }
    }
    finally {
      signal?.removeEventListener('abort', abort)
    }
  }

  subscribe(value: unknown): PassThrough {
    const session = this.sessions.get(rtspSessionId(value))
    if (!session || session.stopped || !session.latestFrame) {
      throw new WhitelistError(404, 'Подключение к камере завершено. Подключитесь ещё раз.')
    }
    if (session.viewers.size >= 4) throw new WhitelistError(409, 'Слишком много открытых просмотров этой камеры.')
    if (session.idleTimer) clearTimeout(session.idleTimer)
    session.idleTimer = null
    session.everViewed = true
    const stream = new PassThrough({ highWaterMark: 256 * 1024 })
    const viewer: Viewer = { stream, pending: null, blocked: false }
    session.viewers.add(viewer)
    stream.on('drain', () => {
      viewer.blocked = false
      const pending = viewer.pending
      viewer.pending = null
      if (pending && !session.stopped && !stream.destroyed) this.write(viewer, pending)
    })
    stream.once('close', () => {
      viewer.pending = null
      session.viewers.delete(viewer)
      if (!session.viewers.size && session.everViewed) this.stop(session)
    })
    this.write(viewer, session.latestFrame)
    return stream
  }

  disconnect(value: unknown): void {
    const session = this.sessions.get(rtspSessionId(value))
    if (session) this.stop(session)
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) this.stop(session)
    await Promise.all([...this.closing])
  }

  private write(viewer: Viewer, frame: Buffer): void {
    if (viewer.stream.destroyed || viewer.stream.writableEnded) return
    if (viewer.blocked) {
      viewer.pending = frame
      return
    }
    viewer.blocked = !viewer.stream.write(multipartFrame(frame))
  }

  private receive(session: Session, chunk: Buffer): void {
    if (session.stopped) return
    if (session.pendingOutput.length + chunk.length > MAX_FRAME_BYTES + MAX_HEADER_BYTES) {
      this.stop(session, unavailable(''))
      return
    }
    session.pendingOutput = Buffer.concat([session.pendingOutput, chunk])
    while (session.pendingOutput.length) {
      const headerEnd = session.pendingOutput.indexOf('\r\n\r\n')
      if (headerEnd < 0) {
        if (session.pendingOutput.length > MAX_HEADER_BYTES) this.stop(session, unavailable(''))
        return
      }
      if (headerEnd > MAX_HEADER_BYTES) {
        this.stop(session, unavailable(''))
        return
      }
      const header = session.pendingOutput.subarray(0, headerEnd).toString('ascii')
      const length = Number(/content-length:\s*(\d+)/iu.exec(header)?.[1])
      if (!Number.isSafeInteger(length) || length < 4 || length > MAX_FRAME_BYTES) {
        this.stop(session, unavailable(''))
        return
      }
      const frameEnd = headerEnd + 4 + length
      if (session.pendingOutput.length < frameEnd) return
      const frame = Buffer.from(session.pendingOutput.subarray(headerEnd + 4, frameEnd))
      session.pendingOutput = session.pendingOutput.subarray(frameEnd)
      if (frame[0] !== 0xff || frame[1] !== 0xd8 || frame[length - 2] !== 0xff || frame[length - 1] !== 0xd9) {
        this.stop(session, unavailable(''))
        return
      }
      const first = !session.latestFrame
      session.latestFrame = frame
      if (first) {
        if (session.connectTimer) clearTimeout(session.connectTimer)
        session.connectTimer = null
        session.resolveReady()
      }
      if (session.everViewed) {
        if (session.idleTimer) clearTimeout(session.idleTimer)
        session.idleTimer = setTimeout(() => this.stop(session), IDLE_TIMEOUT)
        session.idleTimer.unref()
      }
      for (const viewer of session.viewers) this.write(viewer, frame)
    }
  }

  private stop(session: Session, error = unavailable('')): void {
    if (session.stopped) return
    session.stopped = true
    this.sessions.delete(session.id)
    if (session.connectTimer) clearTimeout(session.connectTimer)
    if (session.idleTimer) clearTimeout(session.idleTimer)
    session.connectTimer = session.idleTimer = null
    session.rejectReady(error)
    session.latestFrame = null
    session.pendingOutput = Buffer.alloc(0)
    for (const viewer of session.viewers) {
      viewer.pending = null
      viewer.stream.end()
    }
    session.viewers.clear()
    session.child.stdout.destroy()
    session.child.stderr.destroy()
    if (session.child.exitCode === null && session.child.signalCode === null && session.child.pid) {
      session.child.kill('SIGTERM')
      session.killTimer = setTimeout(() => {
        if (session.child.exitCode === null && session.child.signalCode === null) session.child.kill('SIGKILL')
      }, 3000)
      session.killTimer.unref()
    }
  }
}

const shared = globalThis as typeof globalThis & { __privacyGuardRtspManager?: RtspManager }

export function getRtspManager(): RtspManager {
  return shared.__privacyGuardRtspManager ??= new RtspManager()
}
