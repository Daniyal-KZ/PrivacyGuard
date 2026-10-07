export function readMediaDuration(file: Blob, kind: 'video' | 'audio', signal?: AbortSignal): Promise<number | null> {
  return new Promise(resolve => {
    const player = document.createElement(kind)
    const url = URL.createObjectURL(file)
    let finished = false
    const timer = window.setTimeout(() => finish(null), 5000)
    const abort = () => finish(null)

    function finish(duration: number | null) {
      if (finished) return
      finished = true
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      player.onloadedmetadata = null
      player.onerror = null
      player.removeAttribute('src')
      player.load()
      URL.revokeObjectURL(url)
      resolve(duration)
    }

    player.preload = 'metadata'
    player.onloadedmetadata = () => finish(Number.isFinite(player.duration) ? player.duration : null)
    player.onerror = () => finish(null)
    signal?.addEventListener('abort', abort, { once: true })
    player.src = url
    if (signal?.aborted) finish(null)
  })
}
