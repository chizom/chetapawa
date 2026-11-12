// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  typescript: {
    strict: true,
    typeCheck: false
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Chetapawa',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Pawa your ideas, get gifts. Fans tip with any token on any chain, creators get paid in their own wallet. Powered by NEAR Intents.' },
        { name: 'theme-color', content: '#FF6B4A' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap' }
      ]
    }
  },
  // Server secrets (SUPABASE_SERVICE_ROLE_KEY, ONE_CLICK_JWT, ...) are NOT listed here.
  // They are read from process.env at runtime in server/utils/env.ts, so they are
  // never baked into build output. Public values below are overridden at runtime
  // by the matching NUXT_PUBLIC_* env vars.
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      siteUrl: 'http://localhost:3000'
    }
  }
})
