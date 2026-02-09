Always use Chinese to response.

每次修改完执行一下npm run build,确保没有编译错误

项目目录结构（需随结构调整同步更新本文件）：
- app/app.vue：入口，渲染路由页面。
- app/pages/index.vue：默认重定向到 Home。
- app/pages/home.vue：书架首页（Figma 书架布局）。
- app/pages/user.vue：个人中心页面，设置词汇量（浏览器本地）与模型配置。
- app/pages/reader.vue：阅读器路由，挂载 ReaderShell 组件。
- app/components/ReaderShell.vue：页面 UI、样式与基础布局。
- app/components/BottomTabBar.vue：主页/个人中心共用底部导航。
- app/composables/useReader.ts：阅读器逻辑（加载、模式切换、进度、事件、段落释义请求队列与批处理）。
- server/api/readerLevel.get.ts：读取 prompt.md 的词汇量水平配置。
- server/api/readerLevel.post.ts：更新 prompt.md 的词汇量水平配置。
- server/api/querySentenceDefination.post.ts：后端接口，调用硅基流模型生成词汇标注 JSON。
- server/utils/prompt.ts：读写 prompt.md 并解析/更新英语水平。
- server/assets/prompt.md：部署环境使用的 prompt 模板。
- nuxt.config.ts、package.json、public/ 等保持默认 Nuxt 配置与静态资源。

API 测试（curl）：
```bash
curl -sS -X POST "http://localhost:3000/api/querySentenceDefination" \
  -H "Content-Type: application/json" \
  -d '{"text":"The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass."}'
```
example output: 

```json
{
  "sentence": "The old [lighthouse] stood against the [relentless] winds, its keeper [devising] ways to preserve the [fragile] glass.",
  "meaning": {
    "lighthouse": "灯塔，用于给船只导航定位的塔状建筑。",
    "relentless": "持续不断的，形容风势强且没有停歇。",
    "devising": "设法想出，指在当时情境中构思办法。",
    "fragile": "易碎的，指玻璃这种材料容易破裂。"
  }
}
```

阅读器释义请求（最新）：
- 可见段落先做去重与缓存命中判断，再进入释义流程。
- 短段落批量策略：`<= 120` 字符的段落，最多 `3` 段聚合为一次请求；长段落保持单段请求。
- 批量请求仍调用 `/api/querySentenceDefination`，前端拼接 `text/annotatedText` 并合并 `targetWords`，返回后再按段落拆分并渲染。
- 队列请求间隔为 `1000ms`，限流沿用退避逻辑。
- 失败重试策略：同一批次立即重试，最多 `3` 次（含首次）。
