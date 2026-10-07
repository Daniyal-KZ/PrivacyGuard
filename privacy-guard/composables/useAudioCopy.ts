const audioCopy = {
  ru: {
    uploadTitle: 'Аудиофайлы', uploadDesc: 'Откройте запись, выделите фрагменты для скрытия и сохраните звук.',
    pick: 'Открыть аудио', replace: 'Другой файл', drop: 'Перетащите аудиофайл сюда', formats: 'MP3, WAV, M4A, OGG, FLAC и другие форматы браузера. До 200 МБ.',
    local: 'Локальный файл', invalidFile: 'Выберите аудиофайл.', largeFile: 'Размер аудио превышает 200 МБ.', emptyFile: 'Этот файл пуст.',
    original: 'Исходная запись', result: 'Результат', waveform: 'Звуковая дорожка', waveformHint: 'Выделите фрагмент на дорожке или укажите время ниже.',
    start: 'Начало, с', end: 'Конец, с', addRegion: 'Скрыть фрагмент', undo: 'Удалить последний', clear: 'Очистить', remove: 'Удалить фрагмент', regionCount: 'Фрагментов',
    regionHint: 'Выбранные фрагменты будут заменены тишиной.', invalidRegion: 'Укажите начало и конец в пределах записи. Конец должен быть позже начала.',
    opening: 'Открытие записи…', export: 'Сохранить WAV', processing: 'Сохранение', cancelExport: 'Отменить', download: 'Скачать WAV',
    decodeError: 'Не удалось открыть запись. Попробуйте MP3 или WAV.', unavailable: 'Обработка аудио недоступна в этом браузере.',
    decodedTooLarge: 'Запись слишком длинная для обработки. Откройте более короткий фрагмент.', channelsUnsupported: 'Поддерживаются моно- и стереозаписи.',
    exportTooLarge: 'Результат превышает 128 МБ. Откройте более короткую запись.', exportError: 'Не удалось сохранить звук. Повторите попытку.',
    channels: 'кан.', sampleRate: 'Гц',
  },
  en: {
    uploadTitle: 'Audio files', uploadDesc: 'Open a recording, select passages to hide, and save the audio.',
    pick: 'Open audio', replace: 'Another file', drop: 'Drop an audio file here', formats: 'MP3, WAV, M4A, OGG, FLAC and other browser formats. Up to 200 MB.',
    local: 'Local file', invalidFile: 'Choose an audio file.', largeFile: 'The audio exceeds 200 MB.', emptyFile: 'This file is empty.',
    original: 'Original recording', result: 'Result', waveform: 'Audio waveform', waveformHint: 'Select a passage on the waveform or enter its times below.',
    start: 'Start, s', end: 'End, s', addRegion: 'Hide passage', undo: 'Remove last', clear: 'Clear', remove: 'Remove passage', regionCount: 'Passages',
    regionHint: 'Selected passages will be replaced with silence.', invalidRegion: 'Enter times within the recording. The end must be after the start.',
    opening: 'Opening recording…', export: 'Save WAV', processing: 'Saving', cancelExport: 'Cancel', download: 'Download WAV',
    decodeError: 'Could not open the recording. Try MP3 or WAV.', unavailable: 'Audio processing is unavailable in this browser.',
    decodedTooLarge: 'The recording is too long to process. Open a shorter passage.', channelsUnsupported: 'Mono and stereo recordings are supported.',
    exportTooLarge: 'The result exceeds 128 MB. Open a shorter recording.', exportError: 'Could not save the audio. Try again.',
    channels: 'ch.', sampleRate: 'Hz',
  },
  kk: {
    uploadTitle: 'Аудиофайлдар', uploadDesc: 'Жазбаны ашып, жасырылатын бөліктерді белгілеңіз және дыбысты сақтаңыз.',
    pick: 'Аудионы ашу', replace: 'Басқа файл', drop: 'Аудиофайлды осында сүйреңіз', formats: 'MP3, WAV, M4A, OGG, FLAC және браузер қолдайтын басқа форматтар. 200 МБ дейін.',
    local: 'Жергілікті файл', invalidFile: 'Аудиофайл таңдаңыз.', largeFile: 'Аудио көлемі 200 МБ-тан асады.', emptyFile: 'Бұл файл бос.',
    original: 'Бастапқы жазба', result: 'Нәтиже', waveform: 'Дыбыс жолы', waveformHint: 'Жолда бөлікті белгілеңіз немесе төменде уақытын көрсетіңіз.',
    start: 'Басы, с', end: 'Соңы, с', addRegion: 'Бөлікті жасыру', undo: 'Соңғысын жою', clear: 'Тазалау', remove: 'Бөлікті жою', regionCount: 'Бөліктер',
    regionHint: 'Таңдалған бөліктер үнсіздікпен ауыстырылады.', invalidRegion: 'Жазба шегінде уақытты көрсетіңіз. Соңы басталуынан кейін болуы керек.',
    opening: 'Жазбаны ашу…', export: 'WAV сақтау', processing: 'Сақтау', cancelExport: 'Тоқтату', download: 'WAV жүктеу',
    decodeError: 'Жазбаны ашу мүмкін болмады. MP3 немесе WAV қолданып көріңіз.', unavailable: 'Бұл браузерде аудионы өңдеу қолжетімсіз.',
    decodedTooLarge: 'Жазба өңдеу үшін тым ұзақ. Қысқа бөлікті ашыңыз.', channelsUnsupported: 'Моно және стерео жазбалар қолдау табады.',
    exportTooLarge: 'Нәтиже 128 МБ-тан асады. Қысқа жазбаны ашыңыз.', exportError: 'Дыбысты сақтау мүмкін болмады. Қайталаңыз.',
    channels: 'арна', sampleRate: 'Гц',
  },
} as const

export function useAudioCopy() {
  const { locale } = useLocale()
  return computed(() => audioCopy[locale.value])
}
