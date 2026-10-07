import { defineEventHandler } from 'h3'
import { sendLibraryVideo } from '../../../utils/library-http'
import { assertWhitelistOrigin, whitelistRequest } from '../../../utils/whitelist-http'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(() => sendLibraryVideo(event))
})
