import { defineEventHandler, getRouterParam } from 'h3'
import { getLibraryStore } from '../../utils/library-store'
import { assertWhitelistOrigin, readWhitelistJson, whitelistRequest } from '../../utils/whitelist-http'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(async () => getLibraryStore().update(getRouterParam(event, 'id'), await readWhitelistJson(event)))
})
