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
- app/composables/useReader.ts：阅读器逻辑（加载、模式切换、进度、事件）。
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
  "sentence": "The old <1>lighthouse</1> stood against the <2>relentless</2> winds, its keeper <3>devising</3> ways to preserve the <4>fragile</4> glass.",
  "meaning": {
    "1": "灯塔，一种用于指引船只航行的建筑物。",
    "2": "持续不断的，形容风势强劲且不停歇。",
    "3": "想出或设计出方法或计划。",
    "4": "易碎的，形容玻璃等物品容易破损。"
  }
}
```
