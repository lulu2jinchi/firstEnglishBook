Always use Chinese to response.

每次修改完执行一下npm run build,确保没有编译错误

项目目录结构（需随结构调整同步更新本文件）：
- app/app.vue：入口，渲染路由页面。
- app/pages/index.vue：默认重定向到 Home。
- app/pages/home.vue：书架首页（Figma 书架布局）。
- app/pages/reader.vue：阅读器路由，挂载 ReaderShell 组件。
- app/components/ReaderShell.vue：页面 UI、样式与基础布局。
- app/composables/useReader.ts：阅读器逻辑（加载、模式切换、进度、事件）。
- server/api/querySentenceDefination.post.ts：后端接口，调用硅基流模型生成词汇标注 JSON。
- nuxt.config.ts、package.json、public/ 等保持默认 Nuxt 配置与静态资源。

API 测试（curl）：
```bash
curl -sS -X POST "http://localhost:3000/api/querySentenceDefination" \
  -H "Content-Type: application/json" \
  -d '{"text":"The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass."}'
```
