import { getRtspManager } from '../utils/rtsp-manager'

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('close', async () => {
    await getRtspManager().close()
  })
})
