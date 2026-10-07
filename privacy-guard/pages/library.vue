<script setup lang="ts">
import { ArrowDownTrayIcon, FilmIcon, MusicalNoteIcon, PencilSquareIcon, StarIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { LibraryEntry } from '~/shared/types/library'
import { downloadFileName } from '~/shared/utils/video'
import { readMediaDuration } from '~/utils/readMediaDuration'

type LibraryTab = 'all' | LibraryEntry['kind']
const t = useLibraryCopy()
const { locale } = useLocale()
const { entries, loading, load, upload, update, remove, videoUrl } = useVideoLibrary()
const fileInput = ref<HTMLInputElement | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewPlayer = ref<HTMLMediaElement | null>(null)
const renameDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const previewEntry = ref<LibraryEntry | null>(null)
const editingEntry = ref<LibraryEntry | null>(null)
const deletingEntry = ref<LibraryEntry | null>(null)
const newName = ref('')
const tab = ref<LibraryTab>('all')
const mediaFilter = ref<'all' | 'video' | 'audio'>('all')
const search = ref('')
const favoritesOnly = ref(false)
const sort = ref<'newest' | 'oldest' | 'name'>('newest')
const pendingId = ref('')
const pageError = ref('')
const dialogError = ref('')
const previewError = ref(false)
const uploading = ref(false)
const preparing = ref(false)
const uploadProgress = ref(0)
let uploadController: AbortController | null = null
let disposed = false

const tabs = computed(() => [
  { key: 'all' as const, label: t.value.all },
  { key: 'source' as const, label: t.value.source },
  { key: 'result' as const, label: t.value.result },
  { key: 'camera' as const, label: t.value.camera },
])
const visibleEntries = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return entries.value.filter(entry => (tab.value === 'all' || entry.kind === tab.value)
    && (mediaFilter.value === 'all' || mediaType(entry) === mediaFilter.value)
    && (!favoritesOnly.value || entry.favorite)
    && (!query || entry.name.toLocaleLowerCase().includes(query)))
    .sort((a, b) => sort.value === 'name'
      ? a.name.localeCompare(b.name, locale.value, { numeric: true })
      : sort.value === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))
})
const totalSize = computed(() => entries.value.reduce((total, entry) => total + entry.size, 0))

function kindLabel(entry: LibraryEntry) {
  return entry.kind === 'source' ? t.value.original : entry.kind === 'result' ? t.value.resultVideo : t.value.cameraVideo
}
function mediaType(entry: LibraryEntry): 'video' | 'audio' {
  return entry.mediaType || (entry.mime.startsWith('audio/') ? 'audio' : 'video')
}
function editorLink(entry: LibraryEntry) {
  return { path: mediaType(entry) === 'audio' ? '/audio' : '/upload', query: { library: entry.id } }
}
function sizeLabel(size: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(3, Math.max(0, Math.floor(Math.log(size || 1) / Math.log(1024))))
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: index ? 1 : 0 }).format(size / 1024 ** index)} ${units[index]}`
}
function durationLabel(duration: number | null) {
  if (duration === null || !Number.isFinite(duration)) return '—'
  const seconds = Math.max(0, Math.floor(duration))
  const minutes = Math.floor(seconds / 60)
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat({ ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' }[locale.value], {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}
async function refresh() {
  pageError.value = ''
  try { await load() }
  catch { pageError.value = t.value.loadError }
}
function tabKey(event: KeyboardEvent, index: number) {
  const last = tabs.value.length - 1
  let target = index
  if (event.key === 'ArrowRight') target = (index + 1) % tabs.value.length
  else if (event.key === 'ArrowLeft') target = (index + last) % tabs.value.length
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = last
  else return
  event.preventDefault()
  const next = tabs.value[target]!
  tab.value = next.key
  document.getElementById(`library-tab-${next.key}`)?.focus()
}
async function toggleFavorite(entry: LibraryEntry) {
  if (pendingId.value) return
  pendingId.value = entry.id
  pageError.value = ''
  try { await update(entry.id, { favorite: !entry.favorite }) }
  catch { pageError.value = t.value.actionError }
  finally { pendingId.value = '' }
}
async function preview(entry: LibraryEntry) {
  previewError.value = false
  previewEntry.value = entry
  await nextTick()
  if (!disposed) previewDialog.value?.showModal()
}
function closePreview() { previewDialog.value?.close() }
function clearPreview() {
  if (previewPlayer.value) {
    previewPlayer.value.pause()
    previewPlayer.value.removeAttribute('src')
    previewPlayer.value.load()
  }
  previewEntry.value = null
  previewError.value = false
}
function askRename(entry: LibraryEntry) {
  editingEntry.value = entry
  newName.value = entry.name
  dialogError.value = ''
  renameDialog.value?.showModal()
}
async function confirmRename() {
  if (!editingEntry.value || pendingId.value) return
  const name = newName.value.trim()
  if (!name) { dialogError.value = t.value.nameRequired; return }
  pendingId.value = editingEntry.value.id
  dialogError.value = ''
  try {
    await update(editingEntry.value.id, { name })
    renameDialog.value?.close()
  } catch { dialogError.value = t.value.actionError }
  finally { pendingId.value = '' }
}
function askRemove(entry: LibraryEntry) {
  deletingEntry.value = entry
  dialogError.value = ''
  deleteDialog.value?.showModal()
}
async function confirmRemove() {
  if (!deletingEntry.value || pendingId.value) return
  pendingId.value = deletingEntry.value.id
  dialogError.value = ''
  try {
    await remove(deletingEntry.value.id)
    deleteDialog.value?.close()
  } catch { dialogError.value = t.value.actionError }
  finally { pendingId.value = '' }
}
function fileMediaType(file: File): 'video' | 'audio' | null {
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (/\.(mp3|wav|wave|ogg|oga|flac|m4a|aac|opus|weba)$/i.test(file.name)) return 'audio'
  if (/\.(mp4|m4v|mov|webm|ogv|mkv|avi)$/i.test(file.name)) return 'video'
  return null
}
async function addFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploading.value) return
  pageError.value = ''
  if (!file.size) { pageError.value = t.value.emptyFile; return }
  const type = fileMediaType(file)
  if (!type) { pageError.value = t.value.invalidFile; return }
  const limit = type === 'audio' ? 512 * 1024 ** 2 : 2 * 1024 ** 3
  if (file.size > limit) { pageError.value = type === 'audio' ? t.value.largeAudioFile : t.value.largeVideoFile; return }
  const controller = new AbortController()
  uploadController = controller
  uploading.value = true
  preparing.value = true
  uploadProgress.value = 0
  try {
    const duration = await readMediaDuration(file, type, controller.signal)
    if (controller.signal.aborted) return
    preparing.value = false
    await upload(file, { name: file.name, kind: 'source', duration, signal: controller.signal,
      onProgress: percent => { uploadProgress.value = percent },
    })
  } catch {
    if (!controller.signal.aborted && !disposed) pageError.value = t.value.saveError
  } finally {
    uploadController = null
    uploading.value = false
    preparing.value = false
  }
}

onMounted(() => { void refresh() })
onBeforeUnmount(() => {
  disposed = true
  uploadController?.abort()
  clearPreview()
  previewDialog.value?.close()
})
</script>

<template>
  <div class="library-page">
    <header class="page-header">
      <div><h1 class="page-heading">{{ t.title }}</h1><p class="page-description">{{ t.description }}</p></div>
      <input ref="fileInput" class="sr-only" type="file" tabindex="-1" accept="video/*,audio/*,.mp4,.m4v,.mov,.webm,.ogv,.ogg,.mkv,.avi,.mp3,.wav,.wave,.oga,.flac,.m4a,.aac,.opus,.weba" :aria-label="t.addVideo" :disabled="uploading" @change="addFile" />
      <button type="button" class="btn btn-primary" :disabled="uploading" @click="fileInput?.click()">{{ t.addVideo }}</button>
    </header>
    <section class="app-panel">
      <div class="tabs library-tabs" role="tablist" :aria-label="t.types">
        <button v-for="(item, index) in tabs" :id="`library-tab-${item.key}`" :key="item.key" type="button" class="tab" :class="{ active: tab === item.key }" role="tab" :aria-selected="tab === item.key" :tabindex="tab === item.key ? 0 : -1" aria-controls="library-list" @click="tab = item.key" @keydown="tabKey($event, index)">{{ item.label }}</button>
      </div>
      <div class="toolbar library-toolbar">
        <label class="library-search"><span class="sr-only">{{ t.search }}</span><input v-model="search" class="field" type="search" :placeholder="t.search" /></label>
        <label class="library-media-filter"><span class="sr-only">{{ t.mediaType }}</span><select v-model="mediaFilter" class="field"><option value="all">{{ t.allFiles }}</option><option value="video">{{ t.videoFiles }}</option><option value="audio">{{ t.audioFiles }}</option></select></label>
        <label class="favorites-filter"><input v-model="favoritesOnly" type="checkbox" />{{ t.favoritesOnly }}</label>
        <label class="library-sort"><span class="sr-only">{{ t.sort }}</span><select v-model="sort" class="field"><option value="newest">{{ t.newest }}</option><option value="oldest">{{ t.oldest }}</option><option value="name">{{ t.byName }}</option></select></label>
        <button type="button" class="btn" :disabled="loading || uploading || !!pendingId" @click="refresh">{{ t.refresh }}</button>
      </div>
      <div v-if="uploading" class="library-upload" role="status" aria-live="polite">
        <span>{{ preparing ? t.preparing : `${t.uploading} · ${Math.floor(uploadProgress)}%` }}</span>
        <progress :value="uploadProgress" max="100" :aria-label="t.uploading" />
        <button type="button" class="btn" @click="uploadController?.abort()">{{ t.cancel }}</button>
      </div>
      <p v-if="pageError" class="error-message library-error" role="alert">{{ pageError }}</p>
      <div id="library-list" class="library-table-wrap" role="tabpanel" :aria-labelledby="`library-tab-${tab}`" :aria-busy="loading">
        <table class="data-table library-table">
          <thead><tr><th scope="col" class="favorite-column"><span class="sr-only">{{ t.favoritesOnly }}</span></th><th scope="col">{{ t.name }}</th><th scope="col">{{ t.duration }}</th><th scope="col">{{ t.size }}</th><th scope="col">{{ t.added }}</th><th scope="col"><span class="sr-only">{{ t.actions }}</span></th></tr></thead>
          <tbody>
            <tr v-for="entry in visibleEntries" :key="entry.id">
              <td><button type="button" class="favorite-button" :class="{ selected: entry.favorite }" :disabled="!!pendingId" :aria-pressed="entry.favorite" :aria-label="`${entry.favorite ? t.unfavorite : t.favorite}: ${entry.name}`" :title="entry.favorite ? t.unfavorite : t.favorite" @click="toggleFavorite(entry)"><StarIcon aria-hidden="true" /></button></td>
              <td class="name-column"><div class="media-name"><MusicalNoteIcon v-if="mediaType(entry) === 'audio'" class="file-icon" aria-hidden="true" /><FilmIcon v-else class="file-icon" aria-hidden="true" /><div class="file-details"><button type="button" class="file-name" :title="entry.name" @click="preview(entry)">{{ entry.name }}</button><span class="file-kind muted">{{ kindLabel(entry) }}</span></div></div></td>
              <td class="numeric-column muted">{{ durationLabel(entry.duration) }}</td>
              <td class="numeric-column muted">{{ sizeLabel(entry.size) }}</td>
              <td class="date-column muted">{{ dateLabel(entry.createdAt) }}</td>
              <td><div class="library-actions"><NuxtLink class="btn editor-button" :to="editorLink(entry)">{{ t.openEditor }}</NuxtLink><a class="icon-btn" :href="videoUrl(entry.id, true)" :download="downloadFileName(entry)" :aria-label="`${t.download}: ${entry.name}`" :title="t.download"><ArrowDownTrayIcon aria-hidden="true" /></a><button type="button" class="icon-btn" :disabled="!!pendingId" :aria-label="`${t.rename}: ${entry.name}`" :title="t.rename" @click="askRename(entry)"><PencilSquareIcon aria-hidden="true" /></button><button type="button" class="icon-btn delete-button" :disabled="!!pendingId" :aria-label="`${t.remove}: ${entry.name}`" :title="t.remove" @click="askRemove(entry)"><TrashIcon aria-hidden="true" /></button></div></td>
            </tr>
          </tbody>
        </table>
        <div v-if="loading && !entries.length" class="empty-state" role="status">{{ t.loading }}</div>
        <div v-else-if="!visibleEntries.length" class="empty-state">{{ entries.length || search || favoritesOnly || mediaFilter !== 'all' ? t.noMatches : t.empty }}</div>
      </div>
      <div class="library-footer muted"><span>{{ t.files }}: {{ visibleEntries.length }} / {{ entries.length }}</span><span>{{ t.storage }}: {{ sizeLabel(totalSize) }}</span></div>
    </section>

    <dialog ref="previewDialog" class="library-dialog preview-dialog" aria-labelledby="library-preview-title" @close="clearPreview">
      <div class="dialog-header"><h2 id="library-preview-title">{{ previewEntry?.name }}</h2><button type="button" class="btn" @click="closePreview">{{ t.close }}</button></div>
      <div v-if="previewEntry" class="preview-body"><audio v-if="mediaType(previewEntry) === 'audio'" ref="previewPlayer" :src="videoUrl(previewEntry.id)" controls preload="metadata" :aria-label="`${t.preview}: ${previewEntry.name}`" @error="previewError = true" /><video v-else ref="previewPlayer" :src="videoUrl(previewEntry.id)" controls playsinline preload="metadata" :aria-label="`${t.preview}: ${previewEntry.name}`" @error="previewError = true" /><p v-if="previewError" class="error-message" role="alert">{{ t.previewError }}</p><p class="preview-details muted">{{ kindLabel(previewEntry) }} · {{ durationLabel(previewEntry.duration) }} · {{ sizeLabel(previewEntry.size) }}</p></div>
      <div v-if="previewEntry" class="dialog-footer"><a class="btn" :href="videoUrl(previewEntry.id, true)" :download="downloadFileName(previewEntry)">{{ t.download }}</a><NuxtLink class="btn btn-primary" :to="editorLink(previewEntry)" @click="closePreview">{{ t.openEditor }}</NuxtLink></div>
    </dialog>

    <dialog ref="renameDialog" class="library-dialog small-dialog" aria-labelledby="library-rename-title" @close="editingEntry = null" @cancel="pendingId ? $event.preventDefault() : undefined">
      <form @submit.prevent="confirmRename"><div class="dialog-header"><h2 id="library-rename-title">{{ t.renameTitle }}</h2></div><div class="dialog-body"><label for="library-new-name" class="field-label">{{ t.name }}</label><input id="library-new-name" v-model="newName" class="field" maxlength="255" required autofocus :disabled="!!pendingId" /><p v-if="dialogError" class="error-message" role="alert">{{ dialogError }}</p></div><div class="dialog-footer"><button type="button" class="btn" :disabled="!!pendingId" @click="renameDialog?.close()">{{ t.cancel }}</button><button type="submit" class="btn btn-primary" :disabled="!!pendingId">{{ pendingId ? t.saving : t.save }}</button></div></form>
    </dialog>

    <dialog ref="deleteDialog" class="library-dialog small-dialog" aria-labelledby="library-delete-title" @close="deletingEntry = null" @cancel="pendingId ? $event.preventDefault() : undefined">
      <form @submit.prevent="confirmRemove"><div class="dialog-header"><h2 id="library-delete-title">{{ t.deleteTitle }}</h2></div><div class="dialog-body"><p class="delete-name">{{ deletingEntry?.name }}</p><p class="muted">{{ t.deleteDescription }}</p><p v-if="dialogError" class="error-message" role="alert">{{ dialogError }}</p></div><div class="dialog-footer"><button type="button" class="btn" :disabled="!!pendingId" @click="deleteDialog?.close()">{{ t.cancel }}</button><button type="submit" class="btn btn-danger" :disabled="!!pendingId">{{ pendingId ? t.deleting : t.remove }}</button></div></form>
    </dialog>
  </div>
</template>

<style scoped>
.library-tabs { overflow-x: auto; overflow-y: hidden; padding: 0 6px; }
.tab { white-space: nowrap; }
.library-toolbar { padding: 12px 16px; gap: 12px; border-bottom: 1px solid var(--line); }
.library-search { width: min(320px, 100%); }
.library-media-filter { width: 130px; }
.library-media-filter .field { font-size: 13px; }
.favorites-filter { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; white-space: nowrap; }
.library-sort { width: 174px; margin-left: auto; }
.library-sort .field { font-size: 13px; }
.library-error { margin: 12px 16px; }
.library-upload { padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); font-size: 13px; }
.library-upload progress { width: min(230px, 100%); height: 8px; accent-color: var(--accent); }
.library-upload .btn { margin-left: auto; }
.library-table-wrap { position: relative; overflow-x: auto; }
.library-table .favorite-column { width: 48px; }
.library-table td:first-child { padding-right: 0; }
.favorite-button { display: grid; place-items: center; width: 28px; height: 30px; background: transparent; color: var(--muted); border-radius: 3px; }
.favorite-button:hover { background: var(--accent-soft); }
.favorite-button svg { width: 19px; height: 19px; }
.favorite-button.selected { color: #ad812b; }
.favorite-button.selected svg { fill: currentColor; }
.name-column { min-width: 210px; max-width: 420px; width: 100%; }
.media-name { display: flex; align-items: center; gap: 10px; }
.file-icon { width: 22px; height: 22px; flex-shrink: 0; color: var(--muted); }
.file-details { min-width: 0; }
.file-name { display: block; text-align: left; font-weight: 600; color: var(--text); background: none; max-width: 330px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-name:hover { color: var(--accent); text-decoration: underline; }
.file-kind { display: block; font-size: 12px; margin-top: 3px; }
.numeric-column { white-space: nowrap; font-variant-numeric: tabular-nums; }
.date-column { white-space: nowrap; font-size: 12px; }
.library-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
.library-actions .btn { font-size: 12px; min-height: 31px; padding: 5px 8px; }
.library-actions .icon-btn { width: 31px; min-height: 31px; padding: 6px; }
.icon-btn svg { width: 17px; height: 17px; }
.delete-button:hover { color: var(--danger); background: var(--danger-soft); }
.library-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 12px; }
.library-dialog { border: 1px solid var(--line); border-radius: 6px; color: var(--text); background: var(--panel); padding: 0; box-shadow: 0 12px 40px #0003; max-height: calc(100dvh - 32px); }
.library-dialog::backdrop { background: #0006; }
.preview-dialog { width: min(880px, calc(100vw - 32px)); }
.preview-dialog .dialog-header h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-body { padding: 16px; }
.preview-body video { width: 100%; max-height: 65dvh; background: #111; border-radius: 3px; object-fit: contain; }
.preview-body audio { display: block; width: 100%; }
.preview-details { margin-top: 10px; font-size: 12px; }
.preview-body .error-message { margin-top: 12px; }
.small-dialog { width: min(440px, calc(100vw - 32px)); }
.dialog-body { padding: 18px; }
.dialog-body p + p { margin-top: 10px; }
.dialog-body .error-message { margin-top: 12px; }
.delete-name { font-weight: 500; overflow-wrap: anywhere; }
@media (max-width: 1100px) { .file-name { max-width: 250px; } }
@media (max-width: 640px) { .library-toolbar { gap: 10px; padding: 12px; } .library-search { width: 100%; } .library-sort { width: auto; flex: 1; margin-left: 0; } .library-sort select { max-width: 190px; margin-left: auto; } .library-table { min-width: 800px; } .library-table .file-name { max-width: 230px; } .library-upload { padding: 12px; } .preview-body { padding: 12px; } }
</style>
