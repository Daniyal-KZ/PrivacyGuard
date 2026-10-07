import { defineEventHandler } from 'h3'
import { assertWhitelistOrigin, whitelistRequest } from '../../../utils/whitelist-http'
import { getRtspManager } from '../../../utils/rtsp-manager'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(() => {
    getRtspManager().disconnect(event.context.params?.id)
    return { ok: true }
  })
})
