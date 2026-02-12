// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },
  css: ["~/assets/css/tailwind.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      link: [
        {
          rel: "stylesheet",
          href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
        },
      ],
    },
  },
  runtimeConfig: {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model: "Qwen/Qwen3-14B",
      siteUrl: "",
      appName: "First English Book",
    },
  },
  nitro: {
    serverAssets: [
      {
        baseName: "prompt",
        dir: ".",
        pattern: "prompt.md",
      },
    ],
  },
});
