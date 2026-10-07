export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  css: ['~/assets/css/main.css'],
  typescript: { strict: true },
  nitro: { preset: 'node-server' },
  devtools: { enabled: false },
  telemetry: false,
  debug: false,
  routeRules: {
    '/camera': { redirect: '/live' },
    '/login': { redirect: '/whitelist' },
    '/profile': { redirect: '/whitelist' },
  },
  app: {
    head: {
      title: 'Privacy Guard',
      meta: [
        { name: 'description', content: 'Privacy Guard — скрытие конфиденциальных данных в видео, аудиофайлах и изображении с камеры.' },
        { name: 'theme-color', content: '#edf0f3' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
