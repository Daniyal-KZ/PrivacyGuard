<script setup lang="ts">
const props = defineProps<{ src: string }>()
const emit = defineEmits<{ ready: [stream: MediaStream]; error: [message: string] }>()
const t = useVideoCopy()
const canvas = ref<HTMLCanvasElement | null>(null)
const controller = new AbortController()
const maxFrameBytes = 4 * 1024 * 1024
const maxHeaderBytes = 16 * 1024
let capture: MediaStream | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let timeout: ReturnType<typeof setTimeout> | null = null
let mounted = true
let timedOut = false

function resetTimeout() {
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 15_000)
}

function headerEnd(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length - 3; index++) {
    if (bytes[index] === 13 && bytes[index + 1] === 10 && bytes[index + 2] === 13 && bytes[index + 3] === 10) return index
  }
  return -1
}

function close() {
  if (timeout) clearTimeout(timeout)
  timeout = null
  controller.abort()
  void reader?.cancel().catch(() => {})
  capture?.getTracks().forEach(track => track.stop())
  capture = null
}

async function drawFrame(frame: Uint8Array) {
  const surface = canvas.value
  if (!mounted || !surface) return
  const bitmap = await createImageBitmap(new Blob([frame.slice().buffer], { type: 'image/jpeg' }))
  try {
    if (!mounted) return
    if (!bitmap.width || !bitmap.height) throw new Error(t.value.rtspStreamError)
    if (surface.width !== bitmap.width || surface.height !== bitmap.height) {
      surface.width = bitmap.width
      surface.height = bitmap.height
    }
    const context = surface.getContext('2d', { alpha: false })
    if (!context) throw new Error(t.value.cameraUnavailable)
    context.drawImage(bitmap, 0, 0)
    resetTimeout()
    if (!capture) {
      if (!surface.captureStream) throw new Error(t.value.cameraUnavailable)
      capture = surface.captureStream(15)
      emit('ready', capture)
    }
  } finally {
    bitmap.close()
  }
}

async function connect() {
  resetTimeout()
  try {
    const response = await fetch(props.src, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok || !response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('multipart/x-mixed-replace')) {
      throw new Error(t.value.rtspStreamError)
    }
    reader = response.body.getReader()
    let buffered = new Uint8Array(0)
    let expected: number | null = null
    const decoder = new TextDecoder('ascii')
    while (mounted) {
      const part = await reader.read()
      if (part.done) throw new Error(t.value.rtspStreamError)
      if (!part.value.length) continue
      if (buffered.length + part.value.length > maxFrameBytes + maxHeaderBytes) throw new Error(t.value.rtspStreamError)
      const joined = new Uint8Array(buffered.length + part.value.length)
      joined.set(buffered)
      joined.set(part.value, buffered.length)
      buffered = joined
      while (mounted) {
        if (expected == null) {
          const end = headerEnd(buffered)
          if (end < 0) {
            if (buffered.length > maxHeaderBytes) throw new Error(t.value.rtspStreamError)
            break
          }
          const header = decoder.decode(buffered.subarray(0, end))
          const length = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i)
          expected = Number(length?.[1])
          if (!length || !Number.isSafeInteger(expected) || expected < 4 || expected > maxFrameBytes || !/(?:^|\r\n)Content-Type:\s*image\/jpeg\s*(?:\r\n|$)/i.test(header)) {
            throw new Error(t.value.rtspStreamError)
          }
          buffered = buffered.slice(end + 4)
        }
        if (buffered.length < expected) break
        const frame = buffered.slice(0, expected)
        buffered = buffered.slice(expected)
        expected = null
        await drawFrame(frame)
      }
    }
  } catch {
    if (mounted) {
      const message = timedOut ? t.value.rtspTimeout : t.value.rtspStreamError
      emit('error', message)
    }
  } finally {
    close()
  }
}

onMounted(() => { void connect() })
onBeforeUnmount(() => {
  mounted = false
  close()
})
</script>

<template>
  <canvas ref="canvas" class="rtsp-source" aria-hidden="true" />
</template>

<style scoped>
.rtsp-source { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; overflow: hidden; }
</style>
