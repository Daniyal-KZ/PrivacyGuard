import { defineEventHandler, sendStream, setHeader } from 'h3'
import { assertWhitelistOrigin, whitelistRequest } from '../../../../utils/whitelist-http'
import { getRtspManager } from '../../../../utils/rtsp-manager'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(async () => {
    const stream = getRtspManager().subscribe(event.context.params?.id)
    setHeader(event, 'Content-Type', 'multipart/x-mixed-replace; boundary=frame')
    setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'X-Accel-Buffering', 'no')
    let close!: () => void
    const closed = new Promise<void>(resolve => { close = resolve })
    event.node.res.once('close', close)
    try {
      await Promise.race([sendStream(event, stream), closed])
      return ''
    }
    finally {
      event.node.res.off('close', close)
      stream.destroy()
    }
  })
})
