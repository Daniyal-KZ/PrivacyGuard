<script setup lang="ts">
type AudioRegion = { id: number; start: number; end: number }
type ExportedAudio = { blob: Blob; name: string; kind: 'result'; duration: number }
const props = defineProps<{ src: string; fileName?: string; disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; metadata: [value: { duration: number }]; exported: [value: ExportedAudio] }>()
const t = useAudioCopy()
const source = ref<HTMLAudioElement | null>(null)
const result = ref<HTMLAudioElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const opening = ref(true)
const encoding = ref(false)
const ready = ref(false)
const error = ref('')
const duration = ref(0)
const sampleRate = ref(0)
const channels = ref(0)
const currentTime = ref(0)
const startTime = ref<number | string>(0)
const endTime = ref<number | string>(0)
const regions = ref<AudioRegion[]>([])
const progress = ref(0)
const exportUrl = ref('')
const busy = computed(() => opening.value || encoding.value)
const locked = computed(() => busy.value || Boolean(props.disabled))
const downloadName = computed(() => {
  const base = (props.fileName?.replace(/\.[^.]+$/, '') || 'audio').slice(0, 165).replace(/[\uD800-\uDBFF]$/, '')
  return base + '-redacted.wav'
})
const MAX_INPUT_BYTES = 200 * 1024 * 1024
const MAX_PCM_BYTES = 200 * 1024 * 1024
const MAX_WAV_BYTES = 128 * 1024 * 1024
const MAX_DURATION = 30 * 60
let buffer: AudioBuffer | null = null
let peaks = new Float32Array(0)
let audioContext: AudioContext | null = null
let loadController: AbortController | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let removeMetadataListeners: (() => void) | null = null
let disposed = false
let loadGeneration = 0
let exportGeneration = 0
let regionId = 0
let frameId = 0
let pointerId: number | null = null
let pointerStart = 0
watch(busy, value => emit('busy', value), { immediate: true })

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.round(Math.max(0, seconds) * 10) / 10 : 0
  const minutes = Math.floor(safe / 60)
  const remainder = (safe - minutes * 60).toFixed(1).padStart(4, '0')
  return minutes + ':' + remainder
}
function invalidateOutput() {
  result.value?.pause()
  if (exportUrl.value) URL.revokeObjectURL(exportUrl.value)
  exportUrl.value = ''
}
function drawWaveform() {
  const surface = canvas.value
  if (!surface || !surface.clientWidth) return
  const width = surface.clientWidth
  const height = surface.clientHeight
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  if (surface.width !== Math.round(width * scale) || surface.height !== Math.round(height * scale)) {
    surface.width = Math.round(width * scale)
    surface.height = Math.round(height * scale)
  }
  const context = surface.getContext('2d')
  if (!context) return
  context.setTransform(scale, 0, 0, scale, 0, 0)
  const colors = getComputedStyle(document.documentElement)
  context.clearRect(0, 0, width, height)
  context.fillStyle = colors.getPropertyValue('--panel-soft')
  context.fillRect(0, 0, width, height)
  if (!duration.value || !peaks.length) return
  context.strokeStyle = colors.getPropertyValue('--line')
  context.beginPath()
  context.moveTo(0, height / 2)
  context.lineTo(width, height / 2)
  context.stroke()
  context.strokeStyle = colors.getPropertyValue('--accent')
  context.lineWidth = 1
  context.beginPath()
  const columns = Math.min(peaks.length, Math.ceil(width))
  for (let index = 0; index < columns; index++) {
    const value = peaks[Math.floor(index / columns * peaks.length)] || 0
    const x = (index + .5) / columns * width
    const amplitude = Math.max(.5, value * height * .42)
    context.moveTo(x, height / 2 - amplitude)
    context.lineTo(x, height / 2 + amplitude)
  }
  context.stroke()
  const selection: [number, number] = [Number(startTime.value), Number(endTime.value)]
  const visibleRegions: [number, number][] = [...regions.value.map(region => [region.start, region.end] as [number, number]), selection]
  for (const [start, end] of visibleRegions) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const x = Math.max(0, start) / duration.value * width
    const endX = Math.min(duration.value, end) / duration.value * width
    context.fillStyle = colors.getPropertyValue('--danger-soft')
    context.globalAlpha = .65
    context.fillRect(x, 0, Math.max(0, endX - x), height)
    context.globalAlpha = 1
    context.strokeStyle = colors.getPropertyValue('--danger')
    context.strokeRect(x + .5, .5, Math.max(0, endX - x - 1), height - 1)
  }
  const x = Math.min(width, currentTime.value / duration.value * width)
  context.strokeStyle = colors.getPropertyValue('--text')
  context.beginPath()
  context.moveTo(x + .5, 0)
  context.lineTo(x + .5, height)
  context.stroke()
}
function onTimeUpdate() {
  currentTime.value = source.value?.currentTime || 0
  drawWaveform()
}
function animatePlayhead() {
  onTimeUpdate()
  if (source.value && !source.value.paused && !disposed) frameId = requestAnimationFrame(animatePlayhead)
}
function onSourcePlay() {
  result.value?.pause()
  cancelAnimationFrame(frameId)
  animatePlayhead()
}
function onSourcePause() {
  cancelAnimationFrame(frameId)
  onTimeUpdate()
}
function waitForMetadata(element: HTMLAudioElement) {
  if (element.readyState >= 1) return Promise.resolve(element.duration)
  return new Promise<number>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(false), 15000)
    function cleanup() {
      clearTimeout(timeout)
      element.removeEventListener('loadedmetadata', onLoaded)
      element.removeEventListener('error', onError)
      removeMetadataListeners = null
    }
    function finish(success: boolean) {
      cleanup()
      if (success) resolve(element.duration)
      else reject(new Error('metadata'))
    }
    function onLoaded() { finish(true) }
    function onError() { finish(false) }
    element.addEventListener('loadedmetadata', onLoaded, { once: true })
    element.addEventListener('error', onError, { once: true })
    removeMetadataListeners = () => finish(false)
  })
}
function resolveAudioDuration(element: HTMLAudioElement, initialDuration: number, generation: number) {
  if (Number.isFinite(initialDuration) && initialDuration > 0) return Promise.resolve(initialDuration)
  // Recorded WebM files can omit their duration. A bounded seek lets the native
  // demuxer find the end before Web Audio allocates a decoded sample buffer.
  element.pause()
  return new Promise<number>((resolve, reject) => {
    let settled = false
    const timeout = window.setTimeout(() => finish(null, new Error('duration')), 15000)
    function cleanup() {
      clearTimeout(timeout)
      element.removeEventListener('durationchange', onDurationChange)
      element.removeEventListener('seeked', onSeeked)
      element.removeEventListener('error', onError)
      if (removeMetadataListeners === cancel) removeMetadataListeners = null
    }
    function finish(value: number | null, cause?: Error, reset = true) {
      if (settled) return
      settled = true
      cleanup()
      if (reset && !disposed && generation === loadGeneration) {
        try { element.currentTime = 0 } catch { /* The media may have been detached. */ }
      }
      if (cause || value === null) reject(cause || new Error('duration'))
      else resolve(value)
    }
    function onDurationChange() {
      if (Number.isFinite(element.duration) && element.duration > 0) finish(element.duration)
    }
    function onSeeked() {
      onDurationChange()
      if (!settled && element.currentTime >= MAX_DURATION) finish(null, new Error('decoded-large'))
    }
    function onError() { finish(null, new Error('duration')) }
    function cancel() { finish(null, new Error('duration-cancelled'), false) }
    element.addEventListener('durationchange', onDurationChange)
    element.addEventListener('seeked', onSeeked)
    element.addEventListener('error', onError)
    removeMetadataListeners = cancel
    onDurationChange()
    if (settled) return
    try { element.currentTime = MAX_DURATION + 1 } catch { onError() }
  })
}
async function readAudioBytes(response: Response, signal: AbortSignal) {
  if (!response.ok) throw new Error('decode')
  const declaredSize = Number(response.headers.get('content-length'))
  if (declaredSize > MAX_INPUT_BYTES) throw new Error('input-large')
  if (!response.body) {
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('input-large')
    return bytes
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_INPUT_BYTES) throw new Error('input-large')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes.buffer
}
async function buildPeaks(decoded: AudioBuffer, generation: number) {
  const values = new Float32Array(Math.min(1200, decoded.length))
  const channelData = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
  for (let index = 0; index < values.length; index++) {
    const start = Math.floor(index / values.length * decoded.length)
    const end = Math.floor((index + 1) / values.length * decoded.length)
    let peak = 0
    for (const channel of channelData) {
      for (let sample = start; sample < end; sample++) peak = Math.max(peak, Math.abs(channel[sample]!))
    }
    values[index] = peak
    if (index % 120 === 119) {
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
      if (disposed || generation !== loadGeneration) return null
    }
  }
  return values
}
async function openAudio() {
  const generation = ++loadGeneration
  loadController?.abort()
  removeMetadataListeners?.()
  cancelExport()
  invalidateOutput()
  opening.value = true
  ready.value = false
  error.value = ''
  buffer = null
  peaks = new Float32Array(0)
  regions.value = []
  duration.value = 0
  currentTime.value = 0
  startTime.value = 0
  endTime.value = 0
  drawWaveform()
  const controller = new AbortController()
  loadController = controller
  let context: AudioContext | null = null
  try {
    const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) throw new Error('unavailable')
    if (!source.value) throw new Error('decode')
    const initialDuration = await waitForMetadata(source.value)
    if (disposed || generation !== loadGeneration) return
    const mediaDuration = await resolveAudioDuration(source.value, initialDuration, generation)
    if (disposed || generation !== loadGeneration) return
    if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) throw new Error('decode')
    if (mediaDuration > MAX_DURATION) throw new Error('decoded-large')
    context = new Constructor()
    audioContext = context
    // Check the decoded stereo footprint before loading common compressed formats.
    if (mediaDuration * context.sampleRate * 2 * 4 > MAX_PCM_BYTES) throw new Error('decoded-large')
    const response = await fetch(props.src, { signal: controller.signal })
    const bytes = await readAudioBytes(response, controller.signal)
    if (disposed || generation !== loadGeneration) return
    if (!bytes.byteLength) throw new Error('decode')
    const decoded = await context.decodeAudioData(bytes)
    if (disposed || generation !== loadGeneration) return
    if (decoded.numberOfChannels > 2) throw new Error('channels')
    if (decoded.duration > MAX_DURATION || decoded.length * decoded.numberOfChannels * 4 > MAX_PCM_BYTES) throw new Error('decoded-large')
    const values = await buildPeaks(decoded, generation)
    if (!values || disposed || generation !== loadGeneration) return
    buffer = decoded
    peaks = values
    duration.value = decoded.duration
    sampleRate.value = decoded.sampleRate
    channels.value = decoded.numberOfChannels
    ready.value = true
    emit('metadata', { duration: decoded.duration })
    drawWaveform()
  } catch (cause) {
    if (disposed || generation !== loadGeneration || controller.signal.aborted) return
    const message = cause instanceof Error ? cause.message : ''
    error.value = message === 'unavailable' ? t.value.unavailable
      : message === 'input-large' ? t.value.largeFile
      : message === 'decoded-large' ? t.value.decodedTooLarge
      : message === 'channels' ? t.value.channelsUnsupported : t.value.decodeError
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => undefined)
    if (audioContext === context) audioContext = null
    if (!disposed && generation === loadGeneration) opening.value = false
  }
}
function addRegion() {
  if (locked.value || !ready.value) return
  const start = typeof startTime.value === 'number' ? startTime.value : startTime.value.trim() ? Number(startTime.value) : NaN
  const end = typeof endTime.value === 'number' ? endTime.value : endTime.value.trim() ? Number(endTime.value) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration.value + .000001 || end <= start) {
    error.value = t.value.invalidRegion
    return
  }
  regions.value.push({ id: ++regionId, start, end: Math.min(duration.value, end) })
  error.value = ''
  startTime.value = 0
  endTime.value = 0
  invalidateOutput()
  drawWaveform()
}
function removeRegion(id?: number) {
  if (locked.value) return
  regions.value = typeof id === 'number' ? regions.value.filter(region => region.id !== id) : []
  invalidateOutput()
  drawWaveform()
}
function undoRegion() {
  const last = regions.value.at(-1)
  if (last) removeRegion(last.id)
}
function pointerTime(event: PointerEvent) {
  const bounds = canvas.value!.getBoundingClientRect()
  return Math.min(duration.value, Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * duration.value * 1000) / 1000)
}
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || locked.value || !ready.value) return
  source.value?.pause()
  pointerId = event.pointerId
  pointerStart = pointerTime(event)
  startTime.value = pointerStart
  endTime.value = pointerStart
  canvas.value?.setPointerCapture(event.pointerId)
  drawWaveform()
}
function onPointerMove(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  const time = pointerTime(event)
  startTime.value = Math.min(pointerStart, time)
  endTime.value = Math.max(pointerStart, time)
  drawWaveform()
}
function onPointerUp(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  onPointerMove(event)
  cancelPointer()
}
function cancelPointer() {
  if (pointerId !== null && canvas.value?.hasPointerCapture(pointerId)) canvas.value.releasePointerCapture(pointerId)
  pointerId = null
}
function cancelExport() {
  exportGeneration++
  encoding.value = false
  progress.value = 0
}
function writeText(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index))
}
async function exportAudio() {
  if (!buffer || locked.value || !ready.value) return
  const generation = ++exportGeneration
  const decoded = buffer
  const byteLength = 44 + decoded.length * decoded.numberOfChannels * 2
  if (byteLength > MAX_WAV_BYTES) {
    error.value = t.value.exportTooLarge
    return
  }
  error.value = ''
  encoding.value = true
  progress.value = 0
  source.value?.pause()
  cancelPointer()
  invalidateOutput()
  try {
    const bytes = new ArrayBuffer(byteLength)
    const view = new DataView(bytes)
    writeText(view, 0, 'RIFF')
    view.setUint32(4, byteLength - 8, true)
    writeText(view, 8, 'WAVE')
    writeText(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, decoded.numberOfChannels, true)
    view.setUint32(24, decoded.sampleRate, true)
    view.setUint32(28, decoded.sampleRate * decoded.numberOfChannels * 2, true)
    view.setUint16(32, decoded.numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeText(view, 36, 'data')
    view.setUint32(40, byteLength - 44, true)
    const samples = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
    const intervals = regions.value.map(region => ({ start: Math.max(0, Math.floor(region.start * decoded.sampleRate)), end: Math.min(decoded.length, Math.ceil(region.end * decoded.sampleRate)) }))
      .sort((a, b) => a.start - b.start)
    const merged: { start: number; end: number }[] = []
    for (const interval of intervals) {
      const last = merged.at(-1)
      if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
      else merged.push({ ...interval })
    }
    let intervalIndex = 0
    let offset = 44
    const chunkFrames = 65536
    for (let chunkStart = 0; chunkStart < decoded.length; chunkStart += chunkFrames) {
      if (disposed || generation !== exportGeneration) return
      const chunkEnd = Math.min(decoded.length, chunkStart + chunkFrames)
      for (let frame = chunkStart; frame < chunkEnd; frame++) {
        while (intervalIndex < merged.length && frame >= merged[intervalIndex]!.end) intervalIndex++
        const interval = merged[intervalIndex]
        const hidden = interval && frame >= interval.start && frame < interval.end
        for (const channel of samples) {
          const sample = hidden ? 0 : Math.max(-1, Math.min(1, channel[frame]!))
          view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
          offset += 2
        }
      }
      progress.value = Math.floor(chunkEnd / decoded.length * 100)
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
    }
    if (disposed || generation !== exportGeneration) return
    const blob = new Blob([bytes], { type: 'audio/wav' })
    exportUrl.value = URL.createObjectURL(blob)
    emit('exported', { blob, name: downloadName.value, kind: 'result', duration: decoded.duration })
  } catch {
    if (!disposed && generation === exportGeneration) error.value = t.value.exportError
  } finally {
    if (!disposed && generation === exportGeneration) encoding.value = false
  }
}
watch([startTime, endTime], () => {
  if (!disposed && import.meta.client) drawWaveform()
})
watch(() => props.src, () => {
  if (!disposed && import.meta.client) nextTick(openAudio)
})
onMounted(() => {
  if (canvas.value) {
    resizeObserver = new ResizeObserver(drawWaveform)
    resizeObserver.observe(canvas.value)
  }
  themeObserver = new MutationObserver(drawWaveform)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  void openAudio()
})
onBeforeUnmount(() => {
  disposed = true
  loadGeneration++
  cancelExport()
  loadController?.abort()
  removeMetadataListeners?.()
  cancelAnimationFrame(frameId)
  cancelPointer()
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  source.value?.pause()
  invalidateOutput()
  buffer = null
  peaks = new Float32Array(0)
  if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => undefined)
})
</script>

<template>
  <section class="app-panel audio-editor">
    <div class="panel-heading">
      <h2>{{ t.original }}</h2>
      <span v-if="ready" class="status-text">{{ formatTime(duration) }} · {{ channels }} {{ t.channels }} · {{ sampleRate }} {{ t.sampleRate }}</span>
    </div>
    <div class="audio-body">
      <audio ref="source" :src="src" controls preload="metadata" :aria-label="t.original" @timeupdate="onTimeUpdate" @play="onSourcePlay" @pause="onSourcePause" @ended="onSourcePause" />
      <div class="audio-waveform" :class="{ ready }">
        <canvas ref="canvas" role="img" :aria-label="t.waveform" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="cancelPointer" />
        <p v-if="opening" class="waveform-status" role="status">{{ t.opening }}</p>
      </div>
      <div class="audio-timeline"><span>{{ formatTime(currentTime) }}</span><span>{{ formatTime(duration) }}</span></div>
      <p class="status-text audio-selection-hint">{{ t.waveformHint }}</p>
      <form class="audio-region-controls" @submit.prevent="addRegion">
        <label class="audio-time-field"><span class="field-label">{{ t.start }}</span><input v-model.number="startTime" class="field" type="number" min="0" :max="duration" step="any" :disabled="!ready || locked" /></label>
        <label class="audio-time-field"><span class="field-label">{{ t.end }}</span><input v-model.number="endTime" class="field" type="number" min="0" :max="duration" step="any" :disabled="!ready || locked" /></label>
        <button class="btn" type="submit" :disabled="!ready || locked">{{ t.addRegion }}</button>
        <button class="btn" type="button" :disabled="!regions.length || locked" @click="undoRegion">{{ t.undo }}</button>
        <button class="btn" type="button" :disabled="!regions.length || locked" @click="removeRegion()">{{ t.clear }}</button>
        <span class="status-text">{{ t.regionCount }}: {{ regions.length }}</span>
      </form>
      <ul v-if="regions.length" class="audio-regions">
        <li v-for="region in regions" :key="region.id"><span>{{ formatTime(region.start) }} — {{ formatTime(region.end) }}</span><button type="button" :disabled="locked" :aria-label="t.remove + ': ' + formatTime(region.start)" @click="removeRegion(region.id)">×</button></li>
      </ul>
      <p class="status-text">{{ t.regionHint }}</p>
      <p v-if="error" class="error-message audio-error" role="alert">{{ error }}</p>
    </div>
    <div class="audio-save toolbar">
      <button v-if="!encoding" class="btn btn-primary" type="button" :disabled="!ready || locked" @click="exportAudio">{{ t.export }}</button>
      <template v-else><button class="btn" type="button" @click="cancelExport">{{ t.cancelExport }}</button><span class="status-text" role="status">{{ t.processing }}: {{ progress }}%</span></template>
      <a v-if="exportUrl" class="btn" :href="exportUrl" :download="downloadName">{{ t.download }}</a>
    </div>
    <div v-if="exportUrl" class="audio-result">
      <h2 class="field-label">{{ t.result }}</h2>
      <audio ref="result" :src="exportUrl" controls preload="metadata" :aria-label="t.result" @play="source?.pause()" />
    </div>
  </section>
</template>

<style scoped>
.audio-editor { overflow: hidden; }
.audio-body { padding: 16px; }
audio { display: block; width: 100%; height: 40px; }
.audio-waveform { position: relative; margin-top: 16px; overflow: hidden; border: 1px solid var(--line); border-radius: 3px; }
.audio-waveform canvas { width: 100%; height: 154px; touch-action: none; }
.audio-waveform.ready canvas { cursor: crosshair; }
.waveform-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; background: var(--panel-soft); }
.audio-timeline { display: flex; justify-content: space-between; margin-top: 5px; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.audio-selection-hint { margin-top: 10px; }
.audio-region-controls { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 8px; margin: 13px 0 12px; }
.audio-time-field { width: 113px; }
.audio-time-field .field-label { margin-bottom: 4px; }
.audio-region-controls > .status-text { padding: 8px 0; }
.audio-regions { display: flex; flex-wrap: wrap; list-style: none; gap: 6px; margin-bottom: 12px; }
.audio-regions li { display: flex; align-items: center; gap: 8px; padding-left: 9px; border: 1px solid var(--line); border-radius: 3px; font-size: 12px; background: var(--panel-soft); font-variant-numeric: tabular-nums; }
.audio-regions button { background: transparent; color: var(--muted); min-width: 29px; min-height: 29px; font-size: 17px; }
.audio-regions button:hover { color: var(--danger); }
.audio-error { margin-top: 12px; }
.audio-save { padding: 12px 16px; border-top: 1px solid var(--line); background: var(--panel-soft); }
.audio-result { padding: 13px 16px 16px; border-top: 1px solid var(--line); }
@media (max-width: 640px) {
  .audio-body { padding: 12px; }
  .audio-waveform canvas { height: 128px; }
  .audio-time-field { width: calc(50% - 4px); }
  .audio-save, .audio-result { padding-left: 12px; padding-right: 12px; }
}
</style>
