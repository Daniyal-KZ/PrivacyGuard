<script setup lang="ts">
import type { LibraryEntry, LibraryKind } from '~/shared/types/library'
import { readMediaDuration } from '~/utils/readMediaDuration'

type ExportedVideo = { blob: Blob; name: string; kind: 'result' | 'camera'; duration: number | null }
type SaveCandidate = { blob: Blob; name: string; kind: LibraryKind; duration: number | null; parentId: string | null }
const t = useVideoCopy()
const libraryCopy = useLibraryCopy()
const library = useVideoLibrary()
const route = useRoute()
const router = useRouter()
const fileName = ref('')
const videoUrl = ref('')
const busy = ref(false)
const opening = ref(false)
const saving = ref(false)
const saveProgress = ref(0)
const remember = ref(true)
const saveError = ref('')
const openError = ref('')
const savedEntry = shallowRef<LibraryEntry | null>(null)
const sourceFile = shallowRef<File | null>(null)
const sourceId = ref<string | null>(null)
let candidate: SaveCandidate | null = null
let uploadController: AbortController | null = null
let generation = 0
let disposed = false
let requestedLibraryId = ''
const unavailable = computed(() => busy.value || saving.value || opening.value)

function replaceVideo(src: string, name: string) {
  const previous = videoUrl.value
  videoUrl.value = src
  fileName.value = name
  if (previous.startsWith('blob:')) nextTick(() => URL.revokeObjectURL(previous))
}

async function save(value: SaveCandidate) {
  if (saving.value || disposed) return
  const request = generation
  const controller = new AbortController()
  uploadController = controller
  candidate = value
  saveError.value = ''
  savedEntry.value = null
  saveProgress.value = 0
  saving.value = true
  try {
    if (value.kind === 'source' && value.blob instanceof File && value.duration === null) {
      value.duration = await readMediaDuration(value.blob, 'video', controller.signal)
    }
    if (controller.signal.aborted || disposed || request !== generation) return
    const entry = await library.upload(value.blob, {
      name: value.name,
      kind: value.kind,
      duration: value.duration,
      parentId: value.parentId,
      signal: controller.signal,
      onProgress: percent => {
        if (!disposed && request === generation) saveProgress.value = percent
      },
    })
    if (disposed || request !== generation) return
    savedEntry.value = entry
    candidate = null
    if (value.kind === 'source') {
      sourceId.value = entry.id
      sourceFile.value = null
    }
  } catch (cause) {
    if (disposed || request !== generation || controller.signal.aborted) return
    saveError.value = cause instanceof Error ? cause.message : libraryCopy.value.saveError
  } finally {
    if (request === generation) {
      uploadController = null
      saving.value = false
    }
  }
}

function saveSource() {
  if (!sourceFile.value || sourceId.value) return
  void save({ blob: sourceFile.value, name: sourceFile.value.name, kind: 'source', duration: null, parentId: null })
}

function onUploaded(file: File) {
  if (unavailable.value) return
  generation++
  requestedLibraryId = ''
  uploadController?.abort()
  candidate = null
  sourceId.value = null
  sourceFile.value = file
  savedEntry.value = null
  saveError.value = ''
  openError.value = ''
  replaceVideo(URL.createObjectURL(file), file.name)
  if (route.query.library) {
    const query = { ...route.query }
    delete query.library
    void router.replace({ query })
  }
  if (remember.value) saveSource()
}

function onExported(output: ExportedVideo) {
  if (!remember.value || disposed) return
  void save({ ...output, parentId: sourceId.value })
}

function changeRemember() {
  try { localStorage.setItem('privacy-guard-save-library', String(remember.value)) } catch { /* The selection still applies to this session. */ }
  if (remember.value && !unavailable.value) saveSource()
}

async function openSaved(id: string) {
  if (busy.value || saving.value || disposed || requestedLibraryId === id) return
  requestedLibraryId = id
  const request = ++generation
  uploadController?.abort()
  candidate = null
  savedEntry.value = null
  saveError.value = ''
  openError.value = ''
  opening.value = true
  try {
    const entry = await library.get(id)
    if (disposed || request !== generation) return
    if (entry.mediaType === 'audio') {
      await router.replace({ path: '/audio', query: { library: id } })
      return
    }
    sourceFile.value = null
    sourceId.value = entry.id
    replaceVideo(library.videoUrl(entry.id), entry.name)
  } catch (cause) {
    if (!disposed && request === generation) openError.value = cause instanceof Error ? cause.message : libraryCopy.value.openError
  } finally {
    if (request === generation) opening.value = false
  }
}

watch(() => route.query.library, id => {
  if (import.meta.client && typeof id === 'string' && id) void openSaved(id)
  else if (opening.value) {
    generation++
    requestedLibraryId = ''
    opening.value = false
  }
})
watch([busy, saving], ([exporting, uploading]) => {
  const id = route.query.library
  if (!exporting && !uploading && import.meta.client && typeof id === 'string' && id) void openSaved(id)
})
onMounted(() => {
  try { remember.value = localStorage.getItem('privacy-guard-save-library') !== 'false' } catch { /* Use the default selection. */ }
  if (typeof route.query.library === 'string' && route.query.library) void openSaved(route.query.library)
})
onBeforeUnmount(() => {
  disposed = true
  generation++
  uploadController?.abort()
  if (videoUrl.value.startsWith('blob:')) URL.revokeObjectURL(videoUrl.value)
  candidate = null
})
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1 class="page-heading">{{ t.uploadTitle }}</h1><p class="page-description">{{ t.uploadDesc }}</p></div>
    </div>
    <VideoUploader :compact="Boolean(videoUrl)" :disabled="unavailable" @uploaded="onUploaded" />
    <div class="toolbar library-toolbar">
      <label class="library-option"><input v-model="remember" type="checkbox" :disabled="unavailable" @change="changeRemember" />{{ libraryCopy.saveToLibrary }}</label>
      <span v-if="saving" class="status-text" role="status">{{ libraryCopy.saving }}: {{ saveProgress }}%</span>
      <button v-if="saving" type="button" class="btn" @click="uploadController?.abort()">{{ libraryCopy.cancel }}</button>
      <button v-else-if="candidate" type="button" class="btn" :disabled="unavailable" @click="candidate && save(candidate)">{{ libraryCopy.saveRetry }}</button>
      <span v-else-if="savedEntry" class="status-text" role="status">{{ libraryCopy.saved }}</span>
      <NuxtLink v-if="savedEntry" class="library-link" to="/library">{{ libraryCopy.viewLibrary }}</NuxtLink>
    </div>
    <div v-if="saveError" class="save-error">
      <p class="error-message" role="alert">{{ saveError }}</p>
    </div>
    <p v-if="openError" class="error-message" role="alert">{{ openError }}</p>
    <div v-if="videoUrl" class="video-file-workspace">
      <p class="video-filename" :title="fileName">{{ fileName }}</p>
      <VideoRedactor :key="videoUrl" :src="videoUrl" :file-name="fileName" :disabled="saving || opening" @busy="busy = $event" @exported="onExported" />
    </div>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 20px; }
.library-toolbar { margin-top: 12px; min-height: 25px; }
.library-option { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; }
.library-link { color: var(--accent); font-size: 13px; }
.save-error { display: grid; gap: 8px; justify-items: start; margin-top: 10px; }
.video-file-workspace { margin-top: 18px; }
.video-filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 12px; font-weight: 500; }
</style>
