import { defineEventHandler, setResponseStatus } from 'h3'
import { readLibraryUpload, receiveLibraryVideo } from '../../utils/library-http'
import { getLibraryStore } from '../../utils/library-store'
import { assertWhitelistOrigin, whitelistRequest } from '../../utils/whitelist-http'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(async () => {
    const input = readLibraryUpload(event)
    const entry = await getLibraryStore().add(input, (path, limit) => receiveLibraryVideo(event, path, limit))
    setResponseStatus(event, 201)
    return entry
  })
})
