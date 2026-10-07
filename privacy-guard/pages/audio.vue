<script setup lang="ts">
import type { LibraryEntry } from '~/shared/types/library'
import { readMediaDuration } from '~/utils/readMediaDuration'

type ExportedAudio = { blob: Blob; name: string; kind: 'result'; duration: number }
type SaveCandidate = { blob: Blob; name: string; kind: 'source' | 'result'; duration: number | null; parentId: string | null }
const t = useAudioCopy()
const libraryCopy = useLibraryCopy()
const library = useVideoLibrary()
const route = useRoute()
const router = useRouter()
const sourceUrl = ref('')
const fileName = ref('')
const sourceFile = shallowRef<File | null>(null)
const sourceId = ref<string | null>(null)
const candidate = shallowRef<SaveCandidate | null>(null)
const savedEntry = shallowRef<LibraryEntry | null>(null)
const remember = ref(true)
const busy = ref(false)
const opening = ref(false)
const saving = ref(false)
const saveProgress = ref(0)
const error = ref('')
let controller: AbortController | null = null
let generation = 0
let requestedId = ''
let disposed = false
const unavailable = computed(() => busy.value || opening.value || saving.value)

function replaceSource(url: string, name: string) {
  const previous = sourceUrl.value
  sourceUrl.value = url
  fileName.value = name
  if (previous.startsWith('blob:')) nextTick(() => URL.revokeObjectURL(previous))
}

async function save(value: SaveCandidate) {
  if (saving.value || disposed) return
  const request = generation
  const upload = new AbortController()
  controller = upload
  candidate.value = value
  savedEntry.value = null
  error.value = ''
  saving.value = true
  saveProgress.value = 0
  try {
    if (value.kind === 'source' && value.duration === null) {
      value.duration = await readMediaDuration(value.blob, 'audio', upload.signal)
    }
    if (disposed || upload.signal.aborted || request !== generation) return
    const entry = await library.upload(value.blob, { ...value, signal: upload.signal,
      onProgress: percent => { if (!disposed && request === generation) saveProgress.value = percent },
    })
    if (disposed || request !== generation) return
    savedEntry.value = entry
    candidate.value = null
    if (value.kind === 'source') { sourceId.value = entry.id; sourceFile.value = null }
  } catch (cause) {
    if (!disposed && request === generation && !upload.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : libraryCopy.value.saveError
    }
  } finally {
    if (request === generation) { saving.value = false; controller = null }
  }
}

function saveSource() {
  if (sourceFile.value && !sourceId.value) {
    void save({ blob: sourceFile.value, name: sourceFile.value.name, kind: 'source', duration: null, parentId: null })
  }
}
function onUploaded(file: File) {
  if (unavailable.value) return
  generation++
  requestedId = ''
  controller?.abort()
  candidate.value = null
  savedEntry.value = null
  sourceId.value = null
  sourceFile.value = file
  error.value = ''
  replaceSource(URL.createObjectURL(file), file.name)
  if (route.query.library) {
    const query = { ...route.query }
    delete query.library
    void router.replace({ query })
  }
  if (remember.value) saveSource()
}
function onExported(output: ExportedAudio) {
  if (remember.value && !disposed) void save({ ...output, parentId: sourceId.value })
}
function changeRemember() {
  try { localStorage.setItem('privacy-guard-save-library', String(remember.value)) } catch { /* Keep the choice for this session. */ }
  if (remember.value && !unavailable.value) saveSource()
}

async function openSaved(id: string) {
  if (busy.value || saving.value || disposed || requestedId === id) return
  const request = ++generation
  requestedId = id
  candidate.value = null
  savedEntry.value = null
  error.value = ''
  opening.value = true
  try {
    const entry = await library.get(id)
    if (disposed || request !== generation) return
    if (entry.mediaType !== 'audio') {
      await router.replace({ path: '/upload', query: { library: id } })
      return
    }
    sourceFile.value = null
    sourceId.value = entry.id
    replaceSource(library.videoUrl(entry.id), entry.name)
  } catch (cause) {
    if (!disposed && request === generation) error.value = cause instanceof Error ? cause.message : libraryCopy.value.openError
  } finally {
    if (request === generation) opening.value = false
  }
}
watch(() => route.query.library, id => {
  if (import.meta.client && typeof id === 'string' && id) void openSaved(id)
  else if (opening.value) { generation++; requestedId = ''; opening.value = false }
})
watch([busy, saving], ([editing, uploading]) => {
  const id = route.query.library
  if (!editing && !uploading && import.meta.client && typeof id === 'string' && id) void openSaved(id)
})
onMounted(() => {
  try { remember.value = localStorage.getItem('privacy-guard-save-library') !== 'false' } catch { /* Use the default choice. */ }
  if (typeof route.query.library === 'string' && route.query.library) void openSaved(route.query.library)
})
onBeforeUnmount(() => {
  disposed = true
  generation++
  controller?.abort()
  candidate.value = null
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
})
</script>

<template>
  <div>
    <header class="page-header">
      <div><h1 class="page-heading">{{ t.uploadTitle }}</h1><p class="page-description">{{ t.uploadDesc }}</p></div>
    </header>
    <AudioUploader :compact="Boolean(sourceUrl)" :disabled="unavailable" @uploaded="onUploaded" />
    <div class="toolbar library-toolbar">
      <label class="library-option"><input v-model="remember" type="checkbox" :disabled="unavailable" @change="changeRemember" />{{ libraryCopy.saveToLibrary }}</label>
      <span v-if="saving" class="status-text" role="status">{{ libraryCopy.saving }}: {{ saveProgress }}%</span>
      <button v-if="saving" type="button" class="btn" @click="controller?.abort()">{{ libraryCopy.cancel }}</button>
      <button v-else-if="candidate" type="button" class="btn" :disabled="unavailable" @click="save(candidate)">{{ libraryCopy.saveRetry }}</button>
      <span v-else-if="savedEntry" class="status-text" role="status">{{ libraryCopy.saved }}</span>
      <NuxtLink v-if="savedEntry" class="library-link" to="/library">{{ libraryCopy.viewLibrary }}</NuxtLink>
    </div>
    <p v-if="error" class="error-message save-error" role="alert">{{ error }}</p>
    <div v-if="sourceUrl" class="audio-file-workspace">
      <p class="audio-filename" :title="fileName">{{ fileName }}</p>
      <AudioEditor :key="sourceUrl" :src="sourceUrl" :file-name="fileName" :disabled="saving || opening" @busy="busy = $event" @exported="onExported" />
    </div>
  </div>
</template>

<style scoped>
.library-toolbar { margin-top: 12px; min-height: 25px; }
.library-option { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; }
.library-link { color: var(--accent); font-size: 13px; }
.save-error { margin-top: 10px; }
.audio-file-workspace { max-width: 1040px; margin-top: 18px; }
.audio-filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 12px; font-weight: 500; }
</style>
