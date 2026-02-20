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
    llm: {
      provider: process.env.LLM_PROVIDER || "siliconflow",
      apiKey: process.env.LLM_API_KEY || "",
      baseUrl: process.env.LLM_BASE_URL || "",
      model: process.env.LLM_MODEL || "",
      headersJson: process.env.LLM_HEADERS_JSON || "",
    },
    llmProviders: {
      siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY || "",
        baseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
        model: process.env.SILICONFLOW_MODEL || "Qwen/Qwen3-14B",
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3.1",
        siteUrl: process.env.OPENROUTER_SITE_URL || "",
        appName: process.env.OPENROUTER_APP_NAME || "First English Book",
      },
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
