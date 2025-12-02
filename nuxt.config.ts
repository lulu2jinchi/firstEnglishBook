// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    siliconflow: {
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
      model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3'
    }
  }
})
