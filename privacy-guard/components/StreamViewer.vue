<script setup lang="ts">
import type { LibraryEntry } from '~/shared/types/library'
type ExportedVideo = { blob: Blob; name: string; kind: 'result' | 'camera'; duration: number | null }
const t = useVideoCopy()
const libraryCopy = useLibraryCopy()
const library = useVideoLibrary()
const stream = shallowRef<MediaStream | null>(null)
const pending = ref(false)
const error = ref('')
const devices = ref<MediaDeviceInfo[]>([])
const selectedDevice = ref('')
const source = ref<'computer' | 'rtsp' | 'screen'>('computer')
const rtspAddress = ref('')
const rtspSession = shallowRef<{ id: string; streamUrl: string } | null>(null)
const redactor = ref<{ finishRecording: () => void } | null>(null)
const busy = ref(false)
const saving = ref(false)
const saveProgress = ref(0)
const saveError = ref('')
const savedEntry = shallowRef<LibraryEntry | null>(null)
const pendingRecording = shallowRef<ExportedVideo | null>(null)
const recordingUrl = ref('')
let generation = 0
let connectionController: AbortController | null = null
let uploadController: AbortController | null = null
let disposed = false
let disconnectAfterRecording = false
const active = computed(() => Boolean(stream.value))
const connectedOrPending = computed(() => active.value || pending.value || Boolean(rtspSession.value))

watch(busy, value => {
  if (!value && disconnectAfterRecording) stop()
})

async function closeRtsp(id: string) {
  try { await $fetch(`/api/camera/rtsp/${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch { /* The server also releases a session when its stream closes. */ }
}

function streamFailed(message: string) {
  if (disposed) return
  error.value = message
  pending.value = false
  if (busy.value && redactor.value) {
    disconnectAfterRecording = true
    redactor.value.finishRecording()
  } else stop()
}

function rtspReady(connected: MediaStream) {
  if (disposed || !rtspSession.value || source.value !== 'rtsp') {
    connected.getTracks().forEach(track => track.stop())
    return
  }
  stream.value = connected
  pending.value = false
}

async function saveRecording(output: ExportedVideo) {
  if (saving.value || disposed) return
  if (pendingRecording.value !== output) {
    if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
    recordingUrl.value = URL.createObjectURL(output.blob)
  }
  pendingRecording.value = output
  savedEntry.value = null
  saveError.value = ''
  saveProgress.value = 0
  saving.value = true
  const controller = new AbortController()
  uploadController = controller
  try {
    const entry = await library.upload(output.blob, {
      name: output.name,
      kind: 'camera',
      duration: output.duration,
      signal: controller.signal,
      onProgress: percent => { if (!disposed) saveProgress.value = percent },
    })
    if (disposed) return
    savedEntry.value = entry
    pendingRecording.value = null
    if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
    recordingUrl.value = ''
  } catch (cause) {
    if (!disposed && !controller.signal.aborted) saveError.value = cause instanceof Error ? cause.message : libraryCopy.value.saveError
  } finally {
    uploadController = null
    if (!disposed) saving.value = false
  }
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const available = await navigator.mediaDevices.enumerateDevices()
    if (!disposed) devices.value = available.filter(device => device.kind === 'videoinput')
  } catch { /* Device selection is optional; the default camera remains available. */ }
}
async function start() {
  if (connectedOrPending.value || busy.value) return
  const request = ++generation
  error.value = ''
  if (source.value === 'rtsp') {
    let url: URL
    try {
      url = new URL(rtspAddress.value.trim())
      if (!['rtsp:', 'rtsps:'].includes(url.protocol) || !url.hostname) throw new Error('Invalid RTSP address')
    } catch {
      error.value = t.value.rtspInvalid
      return
    }
    pending.value = true
    const controller = new AbortController()
    connectionController = controller
    try {
      const session = await $fetch<{ id: string; streamUrl: string }>('/api/camera/rtsp', {
        method: 'POST', body: { url: rtspAddress.value.trim() }, signal: controller.signal,
      })
      if (disposed || request !== generation) {
        void closeRtsp(session.id)
        return
      }
      rtspSession.value = session
    } catch (cause) {
      if (disposed || request !== generation) return
      const failure = cause as { data?: { data?: { message?: string }; message?: string } }
      error.value = failure?.data?.data?.message || failure?.data?.message || t.value.rtspStreamError
      pending.value = false
    } finally {
      if (connectionController === controller) connectionController = null
    }
    return
  }
  if (source.value === 'screen') {
    if (!navigator.mediaDevices?.getDisplayMedia) { error.value = t.value.screenUnavailable; return }
    pending.value = true
    try {
      const connected = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } }, audio: true,
      })
      if (disposed || request !== generation) {
        connected.getTracks().forEach(track => track.stop())
        return
      }
      stream.value = connected
      connected.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (request === generation && !disposed) streamFailed('')
      }, { once: true })
    } catch (cause) {
      if (disposed || request !== generation) return
      const name = cause instanceof DOMException ? cause.name : ''
      error.value = name === 'NotAllowedError' ? t.value.screenDenied : t.value.screenError
    } finally {
      if (request === generation) pending.value = false
    }
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) { error.value = t.value.cameraUnavailable; return }
  pending.value = true
  try {
    const connected = await navigator.mediaDevices.getUserMedia({
      video: selectedDevice.value ? { deviceId: { exact: selectedDevice.value } } : { facingMode: 'user' },
      audio: false,
    })
    if (disposed || request !== generation) {
      connected.getTracks().forEach(track => track.stop())
      return
    }
    stream.value = connected
    connected.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (request === generation && !disposed) streamFailed(t.value.cameraError)
    }, { once: true })
    await refreshDevices()
  } catch (cause) {
    if (disposed || request !== generation) return
    const name = cause instanceof DOMException ? cause.name : ''
    error.value = name === 'NotAllowedError' || name === 'SecurityError' ? t.value.cameraDenied
      : name === 'NotFoundError' || name === 'OverconstrainedError' ? t.value.cameraMissing : t.value.cameraError
    stream.value = null
  } finally {
    if (request === generation) pending.value = false
  }
}
function stop() {
  generation++
  connectionController?.abort()
  connectionController = null
  disconnectAfterRecording = false
  const session = rtspSession.value
  rtspSession.value = null
  if (session) void closeRtsp(session.id)
  stream.value?.getTracks().forEach(track => track.stop())
  stream.value = null
  pending.value = false
  busy.value = false
}
onMounted(() => {
  void refreshDevices()
  navigator.mediaDevices?.addEventListener('devicechange', refreshDevices)
})
onBeforeUnmount(() => {
  disposed = true
  uploadController?.abort()
  pendingRecording.value = null
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
  stop()
  navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices)
})
</script>

<template>
  <section class="camera-workspace">
    <div class="app-panel camera-toolbar">
      <form class="toolbar camera-controls" @submit.prevent="connectedOrPending ? stop() : start()">
        <label class="camera-source">
          <span class="field-label">{{ t.cameraSource }}</span>
          <select v-model="source" class="field" :disabled="connectedOrPending || busy">
            <option value="computer">{{ t.cameraComputer }}</option>
            <option value="screen">{{ t.screenSource }}</option>
            <option value="rtsp">{{ t.cameraRtsp }}</option>
          </select>
        </label>
        <label v-if="source === 'computer'" class="camera-device">
          <span class="field-label">{{ t.cameraSelect }}</span>
          <select v-model="selectedDevice" class="field" :disabled="connectedOrPending || busy">
            <option value="">{{ t.cameraDefault }}</option>
            <option v-for="(device, index) in devices" :key="device.deviceId || index" :value="device.deviceId">{{ device.label || t.cameraName + ' ' + (index + 1) }}</option>
          </select>
        </label>
        <label v-else-if="source === 'rtsp'" class="camera-address">
          <span class="field-label">{{ t.rtspAddress }}</span>
          <input v-model="rtspAddress" class="field" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="rtsp://192.168.0.100:554/stream" :disabled="connectedOrPending || busy" />
        </label>
        <p v-else class="screen-description muted">{{ t.screenChoose }}</p>
        <button type="submit" class="btn" :class="{ 'btn-primary': !connectedOrPending }" :disabled="busy">
          {{ pending ? t.cameraCancel : active ? t.cameraStop : source === 'screen' ? t.screenStart : t.cameraStart }}
        </button>
        <span class="status-text" role="status">{{ pending ? (source === 'screen' ? t.screenPending : t.cameraPending) : active ? t.cameraOn : t.cameraOff }}</span>
      </form>
    </div>
    <RtspStreamCanvas v-if="rtspSession" :key="rtspSession.id" :src="rtspSession.streamUrl" @ready="rtspReady" @error="streamFailed" />
    <VideoRedactor v-if="stream" ref="redactor" :key="stream.id" :stream="stream" :file-name="source === 'screen' ? 'screen' : source === 'rtsp' ? 'stream' : 'camera'" :disabled="saving" @busy="busy = $event" @exported="saveRecording" />
    <div v-else class="app-panel empty-state camera-empty">{{ pending ? (source === 'screen' ? t.screenPending : t.cameraPending) : t.cameraOff }}</div>
    <div v-if="saving || savedEntry || pendingRecording" class="toolbar recording-library-status">
      <span v-if="saving" class="status-text" role="status">{{ libraryCopy.saving }}: {{ saveProgress }}%</span>
      <button v-if="saving" type="button" class="btn" @click="uploadController?.abort()">{{ libraryCopy.cancel }}</button>
      <template v-else-if="savedEntry">
        <span class="status-text" role="status">{{ libraryCopy.saved }}</span>
        <NuxtLink class="recording-library-link" to="/library">{{ libraryCopy.viewLibrary }}</NuxtLink>
      </template>
      <button v-else-if="pendingRecording" type="button" class="btn" :disabled="busy" @click="saveRecording(pendingRecording)">{{ libraryCopy.saveRetry }}</button>
      <a v-if="pendingRecording && recordingUrl && (!active || saveError)" class="btn" :href="recordingUrl" :download="pendingRecording.name">{{ t.download }}</a>
    </div>
    <p v-if="saveError" class="error-message" role="alert">{{ saveError }}</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.camera-workspace { display: grid; gap: 16px; }
.camera-toolbar { padding: 18px; }
.camera-controls { align-items: end; gap: 12px; }
.camera-source, .camera-device, .camera-address { display: grid; gap: 7px; }
.camera-source .field { min-width: 200px; }
.camera-device .field { width: min(280px, 60vw); }
.camera-address { flex: 1; min-width: 240px; }
.screen-description { flex: 1; min-width: 0; margin: 0; padding-bottom: 10px; }
.camera-controls .status-text { padding-bottom: 10px; }
.camera-empty { min-height: 380px; display: grid; place-items: center; background: #16191d; color: #bcc2ca; }
.recording-library-link { color: var(--accent); font-size: 13px; }
@media (max-width: 680px) { .camera-source, .camera-device, .camera-address { width: 100%; min-width: 0; } .camera-device .field { width: 100%; } }
</style>
