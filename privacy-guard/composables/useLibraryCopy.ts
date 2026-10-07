import type { Locale } from './usePrivacy'

const copy = {
  ru: {
    title: 'Библиотека', description: 'Видео, аудиофайлы, сохранённые результаты и записи эфира.',
    addVideo: 'Добавить файл', all: 'Все', source: 'Оригиналы', result: 'Результаты', camera: 'Записи эфира',
    types: 'Тип файла', mediaType: 'Формат', allFiles: 'Все файлы', videoFiles: 'Видео', audioFiles: 'Аудио',
    search: 'Поиск по названию', favoritesOnly: 'Избранное', sort: 'Порядок', newest: 'Сначала новые', oldest: 'Сначала старые', byName: 'По названию',
    name: 'Название', kind: 'Тип', duration: 'Длительность', size: 'Размер', added: 'Добавлено', actions: 'Действия',
    refresh: 'Обновить', loading: 'Загрузка библиотеки…', empty: 'В библиотеке пока нет файлов', noMatches: 'Файлы не найдены', files: 'Файлов', storage: 'На диске',
    original: 'Оригинал', resultVideo: 'Результат', cameraVideo: 'Запись эфира', favorite: 'В избранное', unfavorite: 'Убрать из избранного',
    preview: 'Просмотреть', openEditor: 'Открыть в редакторе', download: 'Скачать', rename: 'Переименовать', remove: 'Удалить',
    renameTitle: 'Переименовать файл', nameRequired: 'Введите название файла.', save: 'Сохранить', cancel: 'Отмена', close: 'Закрыть',
    deleteTitle: 'Удалить файл?', deleteDescription: 'Файл будет удалён из библиотеки и с диска.', deleting: 'Удаление…',
    loadError: 'Не удалось загрузить библиотеку. Повторите попытку.', actionError: 'Не удалось сохранить изменения. Повторите попытку.', previewError: 'Не удалось воспроизвести файл. Скачайте его или попробуйте другой браузер.',
    saveToLibrary: 'Добавлять в библиотеку', saving: 'Сохранение в библиотеку', saved: 'Сохранено в библиотеке', saveError: 'Не удалось сохранить файл в библиотеку.',
    openError: 'Не удалось открыть файл из библиотеки.', saveRetry: 'Повторить сохранение', viewLibrary: 'Открыть библиотеку', uploading: 'Добавление файла', preparing: 'Подготовка файла…',
    emptyFile: 'Файл пуст.', invalidFile: 'Выберите видео или аудиофайл.', largeVideoFile: 'Размер видео не должен превышать 2 ГБ.', largeAudioFile: 'Размер аудиофайла не должен превышать 512 МБ.',
  },
  kk: {
    title: 'Кітапхана', description: 'Бейне, аудиофайлдар, сақталған нәтижелер және эфир жазбалары.',
    addVideo: 'Файл қосу', all: 'Барлығы', source: 'Түпнұсқалар', result: 'Нәтижелер', camera: 'Эфир жазбалары',
    types: 'Файл түрі', mediaType: 'Пішім', allFiles: 'Барлық файлдар', videoFiles: 'Бейне', audioFiles: 'Аудио',
    search: 'Атауы бойынша іздеу', favoritesOnly: 'Таңдаулылар', sort: 'Реті', newest: 'Алдымен жаңалары', oldest: 'Алдымен ескілері', byName: 'Атауы бойынша',
    name: 'Атауы', kind: 'Түрі', duration: 'Ұзақтығы', size: 'Көлемі', added: 'Қосылған күні', actions: 'Әрекеттер',
    refresh: 'Жаңарту', loading: 'Кітапхана жүктелуде…', empty: 'Кітапханада әзірге файл жоқ', noMatches: 'Файлдар табылмады', files: 'Файлдар', storage: 'Дискіде',
    original: 'Түпнұсқа', resultVideo: 'Нәтиже', cameraVideo: 'Эфир жазбасы', favorite: 'Таңдаулыларға қосу', unfavorite: 'Таңдаулылардан алып тастау',
    preview: 'Көру', openEditor: 'Редакторда ашу', download: 'Жүктеу', rename: 'Атауын өзгерту', remove: 'Жою',
    renameTitle: 'Файл атауын өзгерту', nameRequired: 'Файл атауын енгізіңіз.', save: 'Сақтау', cancel: 'Болдырмау', close: 'Жабу',
    deleteTitle: 'Файлды жою керек пе?', deleteDescription: 'Файл кітапханадан және дискіден жойылады.', deleting: 'Жойылуда…',
    loadError: 'Кітапхананы жүктеу мүмкін болмады. Қайталаңыз.', actionError: 'Өзгерістерді сақтау мүмкін болмады. Қайталаңыз.', previewError: 'Файлды ойнату мүмкін болмады. Оны жүктеңіз немесе басқа браузерді пайдаланыңыз.',
    saveToLibrary: 'Кітапханаға қосу', saving: 'Кітапханаға сақталуда', saved: 'Кітапханаға сақталды', saveError: 'Файлды кітапханаға сақтау мүмкін болмады.',
    openError: 'Кітапханадан файлды ашу мүмкін болмады.', saveRetry: 'Қайта сақтау', viewLibrary: 'Кітапхананы ашу', uploading: 'Файл қосылуда', preparing: 'Файл дайындалуда…',
    emptyFile: 'Файл бос.', invalidFile: 'Бейне немесе аудиофайл таңдаңыз.', largeVideoFile: 'Бейне көлемі 2 ГБ-тан аспауы керек.', largeAudioFile: 'Аудиофайл көлемі 512 МБ-тан аспауы керек.',
  },
  en: {
    title: 'Library', description: 'Video, audio files, saved results and live recordings.',
    addVideo: 'Add file', all: 'All', source: 'Originals', result: 'Results', camera: 'Live recordings',
    types: 'File type', mediaType: 'Format', allFiles: 'All files', videoFiles: 'Video', audioFiles: 'Audio',
    search: 'Search by name', favoritesOnly: 'Favorites', sort: 'Sort order', newest: 'Newest first', oldest: 'Oldest first', byName: 'By name',
    name: 'Name', kind: 'Type', duration: 'Duration', size: 'Size', added: 'Added', actions: 'Actions',
    refresh: 'Refresh', loading: 'Loading library…', empty: 'No files in the library yet', noMatches: 'No matching files', files: 'Files', storage: 'On disk',
    original: 'Original', resultVideo: 'Result', cameraVideo: 'Live recording', favorite: 'Add to favorites', unfavorite: 'Remove from favorites',
    preview: 'Preview', openEditor: 'Open in editor', download: 'Download', rename: 'Rename', remove: 'Delete',
    renameTitle: 'Rename file', nameRequired: 'Enter a file name.', save: 'Save', cancel: 'Cancel', close: 'Close',
    deleteTitle: 'Delete file?', deleteDescription: 'The file will be removed from the library and deleted from disk.', deleting: 'Deleting…',
    loadError: 'Could not load the library. Try again.', actionError: 'Could not save changes. Try again.', previewError: 'Could not play this file. Download it or try another browser.',
    saveToLibrary: 'Add to library', saving: 'Saving to library', saved: 'Saved to library', saveError: 'Could not save the file to the library.',
    openError: 'Could not open this library file.', saveRetry: 'Retry saving', viewLibrary: 'Open library', uploading: 'Adding file', preparing: 'Preparing file…',
    emptyFile: 'The file is empty.', invalidFile: 'Choose a video or audio file.', largeVideoFile: 'Video size must not exceed 2 GB.', largeAudioFile: 'Audio size must not exceed 512 MB.',
  },
} satisfies Record<Locale, Record<string, string>>

export function useLibraryCopy() {
  const { locale } = useLocale()
  return computed(() => copy[locale.value])
}
