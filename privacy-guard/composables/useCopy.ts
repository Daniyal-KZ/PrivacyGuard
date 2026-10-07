import type { Locale } from './usePrivacy'

export const languages: { code: Locale; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'kk', label: 'Қазақша' },
  { code: 'en', label: 'English' },
]

const copy = {
  ru: {
    language: 'Язык интерфейса', navLabel: 'Разделы', navUpload: 'Видео', navAudio: 'Аудио', navCamera: 'Прямой эфир', navLibrary: 'Библиотека', navSettings: 'Настройки',
    settingsTitle: 'Настройки', settingsDesc: 'Параметры интерфейса и обработки.',
    interfaceTitle: 'Интерфейс', appearance: 'Оформление', themeLight: 'Светлое', themeDark: 'Тёмное', themeSystem: 'Как в системе',
    classesTitle: 'Категории маскирования',
    faces: 'Лица', plates: 'Номера автомобилей', cards: 'Банковские карты',
    documents: 'Документы', digital: 'Цифровые данные', voice: 'Изменение голоса',
    voiceModeLabel: 'Тип голоса', voiceDeep: 'Низкий', voiceRough: 'Грубый', voiceRobotic: 'Робот',
    profanity: 'Нецензурная речь', sensitive: 'Нежелательный контент',
    tobacco: 'Табак', cannabis: 'Каннабис', alcohol: 'Алкоголь', nudity: 'Обнажённость',
    whitelist: 'Белый список',
    manageWhitelist: 'Открыть список', whitelistEnabled: 'Использовать белый список',
    processingDisconnected: 'Автоматическая обработка не подключена',
  },
  kk: {
    language: 'Интерфейс тілі', navLabel: 'Бөлімдер', navUpload: 'Бейне', navAudio: 'Аудио', navCamera: 'Тікелей эфир', navLibrary: 'Кітапхана', navSettings: 'Баптаулар',
    settingsTitle: 'Баптаулар', settingsDesc: 'Интерфейс пен өңдеу параметрлері.',
    interfaceTitle: 'Интерфейс', appearance: 'Безендіру', themeLight: 'Ашық', themeDark: 'Қараңғы', themeSystem: 'Жүйедегідей',
    classesTitle: 'Жасыру санаттары',
    faces: 'Беттер', plates: 'Көлік нөмірлері', cards: 'Банк карталары',
    documents: 'Құжаттар', digital: 'Цифрлық деректер', voice: 'Дауысты өзгерту',
    voiceModeLabel: 'Дауыс түрі', voiceDeep: 'Төмен', voiceRough: 'Дөрекі', voiceRobotic: 'Робот',
    profanity: 'Балағат сөздер', sensitive: 'Орынсыз мазмұн',
    tobacco: 'Темекі', cannabis: 'Каннабис', alcohol: 'Алкоголь', nudity: 'Жалаңаштық',
    whitelist: 'Ақ тізім',
    manageWhitelist: 'Тізімді ашу', whitelistEnabled: 'Ақ тізімді қолдану',
    processingDisconnected: 'Автоматты өңдеу қосылмаған',
  },
  en: {
    language: 'Interface language', navLabel: 'Sections', navUpload: 'Video', navAudio: 'Audio', navCamera: 'Live', navLibrary: 'Library', navSettings: 'Settings',
    settingsTitle: 'Settings', settingsDesc: 'Interface and processing preferences.',
    interfaceTitle: 'Interface', appearance: 'Appearance', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System',
    classesTitle: 'Masking categories',
    faces: 'Faces', plates: 'License plates', cards: 'Bank cards',
    documents: 'Documents', digital: 'Digital data', voice: 'Voice change',
    voiceModeLabel: 'Voice type', voiceDeep: 'Deep', voiceRough: 'Rough', voiceRobotic: 'Robot',
    profanity: 'Profanity', sensitive: 'Sensitive content',
    tobacco: 'Tobacco', cannabis: 'Cannabis', alcohol: 'Alcohol', nudity: 'Nudity',
    whitelist: 'Whitelist',
    manageWhitelist: 'Open list', whitelistEnabled: 'Use whitelist',
    processingDisconnected: 'Automatic processing is not connected',
  },
} as const

export function useCopy() {
  const { locale } = useLocale()
  return computed(() => copy[locale.value])
}
