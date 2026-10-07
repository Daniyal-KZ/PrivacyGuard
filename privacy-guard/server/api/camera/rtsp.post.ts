import { defineEventHandler, setResponseStatus } from 'h3'
import { assertWhitelistOrigin, readWhitelistJson, whitelistRequest } from '../../utils/whitelist-http'
import { getRtspManager } from '../../utils/rtsp-manager'
import { rtspAddress } from '../../utils/rtsp-validation'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(async () => {
    const address = rtspAddress(await readWhitelistJson(event))
    const controller = new AbortController()
    const cancelled = () => { if (!event.node.res.writableEnded) controller.abort() }
    event.node.res.once('close', cancelled)
    if (event.node.req.aborted || event.node.res.destroyed) controller.abort()
    try {
      const connection = await getRtspManager().connect(address, controller.signal)
      setResponseStatus(event, 201)
      return connection
    }
    finally {
      event.node.res.off('close', cancelled)
    }
  })
})
