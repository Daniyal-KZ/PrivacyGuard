<script setup lang="ts">
import { MusicalNoteIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{ compact?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ uploaded: [file: File] }>()
const t = useAudioCopy()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const error = ref('')
const audioTypes: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', wave: 'audio/wav', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', webm: 'audio/webm', weba: 'audio/webm',
}

function select(file?: File) {
  if (!file || props.disabled) return
  error.value = ''
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mime = file.type.startsWith('audio/') ? file.type : audioTypes[extension]
  if (!file.size) error.value = t.value.emptyFile
  else if (file.size > 200 * 1024 ** 2) error.value = t.value.largeFile
  else if (!mime) error.value = t.value.invalidFile
  else emit('uploaded', mime === file.type ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified }))
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
    <input ref="input" class="sr-only" type="file" accept="audio/*,.mp3,.wav,.wave,.m4a,.aac,.flac,.ogg,.oga,.opus,.webm,.weba" :aria-label="t.pick" :disabled="props.disabled" @change="onInput" />
    <div v-if="props.compact" class="toolbar">
      <span class="muted">{{ t.local }}</span>
      <button type="button" class="btn" :disabled="props.disabled" @click="input?.click()">{{ t.replace }}</button>
    </div>
    <div v-else class="app-panel audio-dropzone" :class="{ dragging }"
      @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <MusicalNoteIcon class="upload-icon" aria-hidden="true" />
      <div class="upload-description"><p>{{ t.drop }}</p><p class="muted">{{ t.formats }}</p></div>
      <button type="button" class="btn btn-primary" :disabled="props.disabled" @click="input?.click()">{{ t.pick }}</button>
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.audio-dropzone { display: grid; justify-items: center; align-content: center; gap: 20px; width: 100%; min-height: 300px; padding: 40px 28px; border-style: dashed; text-align: center; }
.upload-icon { width: 40px; height: 40px; color: var(--muted); }
.upload-description p:first-child { font-size: 16px; font-weight: 500; }
.upload-description .muted { margin-top: 9px; font-size: 13px; }
.audio-dropzone .btn { min-width: 150px; min-height: 38px; }
.audio-dropzone.dragging { border-color: var(--accent); background: var(--accent-soft); }
@media (max-width: 620px) { .audio-dropzone { min-height: 260px; padding: 30px 20px; } }
</style>
