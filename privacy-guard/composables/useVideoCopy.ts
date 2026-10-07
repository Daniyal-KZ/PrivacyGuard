const videoCopy = {
  ru: {
    uploadTitle: 'Видеофайлы', uploadDesc: 'Откройте видео, выделите области скрытия и сохраните результат.',
    pick: 'Открыть видео', replace: 'Другой файл', drop: 'Перетащите видео сюда', formats: 'MP4, WebM и другие форматы, поддерживаемые браузером. До 2 ГБ.',
    local: 'Локальный файл', invalidFile: 'Выберите видеофайл.', largeFile: 'Размер видео превышает 2 ГБ.', emptyFile: 'Этот файл пуст.',
    original: 'Оригинал', result: 'Области скрытия', addRegion: 'Добавить область', cancelDrawing: 'Отменить выделение', clear: 'Удалить области', undo: 'Удалить последнюю',
    drawHint: 'Выделите прямоугольник на изображении справа.', regionCount: 'Областей', playbackError: 'Не удалось открыть видео. Попробуйте MP4 или WebM.',
    export: 'Сохранить видео', cancelExport: 'Отменить сохранение', preparing: 'Подготовка', recording: 'Сохранение', download: 'Скачать WebM',
    exportHint: 'Сохранение проходит за время воспроизведения видео.', audio: 'Сохранить исходный звук', audioError: 'Не удалось сохранить звук. Снимите флажок «Сохранить исходный звук» и повторите.',
    exportUnavailable: 'Сохранение видео недоступно в этом браузере.', exportError: 'Не удалось сохранить видео. Повторите попытку.', exportTooLarge: 'Запись превышает 512 МБ. Используйте более короткое видео.',
    exportBackground: 'Вернитесь на эту вкладку, чтобы продолжить сохранение.', resume: 'Продолжить сохранение', regionLabel: 'Область',
    cameraTitle: 'Прямой эфир', cameraDesc: 'Камера, показ экрана или внешний видеопоток.', cameraStart: 'Подключить', cameraStop: 'Отключить', cameraPending: 'Подключение…',
    screenSource: 'Мой экран', screenChoose: 'Выберите экран, окно или вкладку браузера.', screenStart: 'Выбрать экран', screenPending: 'Выбор экрана…', screenUnavailable: 'Показ экрана недоступен. Откройте приложение через localhost или HTTPS.', screenDenied: 'Показ экрана не начат.', screenError: 'Не удалось начать показ экрана. Повторите выбор.', cameraSource: 'Источник', cameraComputer: 'Камера компьютера', cameraRtsp: 'Поток по ссылке (RTSP)', cameraCancel: 'Отменить', rtspAddress: 'Адрес потока', rtspInvalid: 'Укажите полный адрес потока: rtsp://адрес:порт/путь.', rtspTimeout: 'Камера не передаёт изображение. Проверьте адрес и подключение к сети.', rtspStreamError: 'Видеопоток прерван. Подключите камеру повторно.',
    cameraOff: 'Трансляция отключена', cameraOn: 'Трансляция подключена', cameraSelect: 'Устройство', cameraDefault: 'Камера по умолчанию', cameraName: 'Камера',
    cameraUnavailable: 'Доступ к камере недоступен. Откройте приложение через localhost или HTTPS.', cameraDenied: 'Нет разрешения на камеру. Разрешите доступ в браузере и повторите.',
    cameraMissing: 'Камера не найдена.', cameraError: 'Не удалось подключить камеру. Возможно, её использует другое приложение.', cameraRecording: 'Запись', cameraRecord: 'Начать запись', cameraRecordStop: 'Завершить запись',
  },
  en: {
    uploadTitle: 'Video files', uploadDesc: 'Open a video, select regions to hide, and save the result.',
    pick: 'Open video', replace: 'Another file', drop: 'Drop a video here', formats: 'MP4, WebM and other browser-supported formats. Up to 2 GB.',
    local: 'Local file', invalidFile: 'Choose a video file.', largeFile: 'The video exceeds 2 GB.', emptyFile: 'This file is empty.',
    original: 'Original', result: 'Hidden regions', addRegion: 'Add region', cancelDrawing: 'Cancel selection', clear: 'Clear regions', undo: 'Remove last',
    drawHint: 'Draw a rectangle on the image on the right.', regionCount: 'Regions', playbackError: 'Could not open this video. Try MP4 or WebM.',
    export: 'Save video', cancelExport: 'Cancel saving', preparing: 'Preparing', recording: 'Saving', download: 'Download WebM',
    exportHint: 'Saving takes the duration of the video.', audio: 'Keep original audio', audioError: 'Could not record audio. Uncheck “Keep original audio” and try again.',
    exportUnavailable: 'Video saving is unavailable in this browser.', exportError: 'Could not save the video. Try again.', exportTooLarge: 'Recording exceeds 512 MB. Use a shorter video.',
    exportBackground: 'Return to this tab to continue saving.', resume: 'Continue saving', regionLabel: 'Region',
    cameraTitle: 'Live', cameraDesc: 'Camera, screen sharing or an external video stream.', cameraStart: 'Connect', cameraStop: 'Disconnect', cameraPending: 'Connecting…',
    screenSource: 'My screen', screenChoose: 'Choose a screen, window or browser tab.', screenStart: 'Choose screen', screenPending: 'Choosing screen…', screenUnavailable: 'Screen sharing is unavailable. Open the app using localhost or HTTPS.', screenDenied: 'Screen sharing was not started.', screenError: 'Could not start screen sharing. Try selecting again.', cameraSource: 'Source', cameraComputer: 'Computer camera', cameraRtsp: 'Stream link (RTSP)', cameraCancel: 'Cancel', rtspAddress: 'Stream address', rtspInvalid: 'Enter the full stream address: rtsp://address:port/path.', rtspTimeout: 'No image received. Check the address and network connection.', rtspStreamError: 'The video stream was interrupted. Connect the camera again.',
    cameraOff: 'Stream disconnected', cameraOn: 'Stream connected', cameraSelect: 'Device', cameraDefault: 'Default camera', cameraName: 'Camera',
    cameraUnavailable: 'Camera access is unavailable. Open the app using localhost or HTTPS.', cameraDenied: 'Camera permission denied. Allow access in your browser and try again.',
    cameraMissing: 'No camera found.', cameraError: 'Could not connect to the camera. Another app may be using it.', cameraRecording: 'Recording', cameraRecord: 'Start recording', cameraRecordStop: 'Finish recording',
  },
  kk: {
    uploadTitle: 'Бейнефайлдар', uploadDesc: 'Бейнені ашып, жасырылатын аймақтарды белгілеңіз және нәтижені сақтаңыз.',
    pick: 'Бейнені ашу', replace: 'Басқа файл', drop: 'Бейнені осында сүйреңіз', formats: 'MP4, WebM және браузер қолдайтын басқа форматтар. 2 ГБ дейін.',
    local: 'Жергілікті файл', invalidFile: 'Бейнефайл таңдаңыз.', largeFile: 'Бейне көлемі 2 ГБ-тан асады.', emptyFile: 'Бұл файл бос.',
    original: 'Түпнұсқа', result: 'Жасырылатын аймақтар', addRegion: 'Аймақ қосу', cancelDrawing: 'Белгілеуді тоқтату', clear: 'Аймақтарды жою', undo: 'Соңғысын жою',
    drawHint: 'Оң жақтағы суретте тіктөртбұрыш белгілеңіз.', regionCount: 'Аймақтар', playbackError: 'Бейнені ашу мүмкін болмады. MP4 немесе WebM қолданып көріңіз.',
    export: 'Бейнені сақтау', cancelExport: 'Сақтауды тоқтату', preparing: 'Дайындау', recording: 'Сақтау', download: 'WebM жүктеу',
    exportHint: 'Сақтау бейненің ұзақтығына тең уақыт алады.', audio: 'Бастапқы дыбысты сақтау', audioError: 'Дыбысты сақтау мүмкін болмады. «Бастапқы дыбысты сақтау» белгісін алып, қайталаңыз.',
    exportUnavailable: 'Бұл браузерде бейнені сақтау қолжетімсіз.', exportError: 'Бейнені сақтау мүмкін болмады. Қайталаңыз.', exportTooLarge: 'Жазба 512 МБ-тан асады. Қысқа бейнені пайдаланыңыз.',
    exportBackground: 'Сақтауды жалғастыру үшін осы қойындыға оралыңыз.', resume: 'Сақтауды жалғастыру', regionLabel: 'Аймақ',
    cameraTitle: 'Тікелей эфир', cameraDesc: 'Камера, экранды көрсету немесе сыртқы бейне ағыны.', cameraStart: 'Қосу', cameraStop: 'Ажырату', cameraPending: 'Қосылуда…',
    screenSource: 'Менің экраным', screenChoose: 'Экранды, терезені немесе браузер қойындысын таңдаңыз.', screenStart: 'Экранды таңдау', screenPending: 'Экран таңдалуда…', screenUnavailable: 'Экранды көрсету қолжетімсіз. Қосымшаны localhost немесе HTTPS арқылы ашыңыз.', screenDenied: 'Экранды көрсету басталмады.', screenError: 'Экранды көрсетуді бастау мүмкін болмады. Қайта таңдаңыз.', cameraSource: 'Көз', cameraComputer: 'Компьютер камерасы', cameraRtsp: 'Сілтеме арқылы ағын (RTSP)', cameraCancel: 'Болдырмау', rtspAddress: 'Ағын мекенжайы', rtspInvalid: 'Толық ағын мекенжайын көрсетіңіз: rtsp://мекенжай:порт/жол.', rtspTimeout: 'Камера бейне жібермейді. Мекенжай мен желі қосылымын тексеріңіз.', rtspStreamError: 'Бейне ағыны үзілді. Камераны қайта қосыңыз.',
    cameraOff: 'Трансляция өшірулі', cameraOn: 'Трансляция қосылған', cameraSelect: 'Құрылғы', cameraDefault: 'Әдепкі камера', cameraName: 'Камера',
    cameraUnavailable: 'Камера қолжетімсіз. Қосымшаны localhost немесе HTTPS арқылы ашыңыз.', cameraDenied: 'Камераға рұқсат жоқ. Браузерде рұқсат беріп, қайталаңыз.',
    cameraMissing: 'Камера табылмады.', cameraError: 'Камераны қосу мүмкін болмады. Оны басқа қосымша пайдаланып жатқан болуы мүмкін.', cameraRecording: 'Жазу', cameraRecord: 'Жазуды бастау', cameraRecordStop: 'Жазуды аяқтау',
  },
} as const

export function useVideoCopy() {
  const { locale } = useLocale()
  return computed(() => videoCopy[locale.value])
}

