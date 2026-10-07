<script setup lang="ts">
import { FilmIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{ compact?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ uploaded: [file: File] }>()
const t = useVideoCopy()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const error = ref('')

function select(file?: File) {
  if (!file || props.disabled) return
  error.value = ''
  if (!file.size) error.value = t.value.emptyFile
  else if (file.size > 2 * 1024 ** 3) error.value = t.value.largeFile
  else if (!file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|ogv|ogg|mkv|avi)$/i.test(file.name)) error.value = t.value.invalidFile
  else {
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const types: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo' }
    const mime = file.type.startsWith('video/') ? file.type : types[extension] || file.type
    emit('uploaded', mime === file.type ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified }))
  }
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  select(target.files?.[0])
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  select(event.dataTransfer?.files?.[0])
}
</script>

<template>
  <div>
    <input ref="input" class="sr-only" type="file" accept="video/*,.mov,.mkv,.avi" :aria-label="t.pick" :disabled="props.disabled" @change="onInput" />
    <div v-if="props.compact" class="toolbar">
      <span class="muted">{{ t.local }}</span>
      <button type="button" class="btn" :disabled="props.disabled" @click="input?.click()">{{ t.replace }}</button>
    </div>
    <div v-else class="app-panel video-dropzone" :class="{ dragging }"
      @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <FilmIcon class="upload-icon" aria-hidden="true" />
      <div class="upload-description"><p>{{ t.drop }}</p><p class="muted">{{ t.formats }}</p></div>
      <button type="button" class="btn btn-primary" :disabled="props.disabled" @click="input?.click()">{{ t.pick }}</button>
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.video-dropzone { display: grid; justify-items: center; align-content: center; gap: 20px; width: 100%; min-height: 300px; padding: 40px 28px; border-style: dashed; text-align: center; }
.upload-icon { width: 40px; height: 40px; color: var(--muted); }
.upload-description p:first-child { font-size: 16px; font-weight: 500; }
.upload-description .muted { margin-top: 9px; font-size: 13px; }
.video-dropzone .btn { min-width: 150px; min-height: 38px; }
.video-dropzone.dragging { border-color: var(--accent); background: var(--accent-soft); }
@media (max-width: 620px) { .video-dropzone { min-height: 260px; padding: 30px 20px; } }
</style>
