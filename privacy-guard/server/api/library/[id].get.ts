import { defineEventHandler, getRouterParam } from 'h3'
import { getLibraryStore } from '../../utils/library-store'
import { assertWhitelistOrigin, whitelistRequest } from '../../utils/whitelist-http'

export default defineEventHandler(event => {
  assertWhitelistOrigin(event)
  return whitelistRequest(() => getLibraryStore().getEntry(getRouterParam(event, 'id')))
})
