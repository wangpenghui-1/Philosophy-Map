# 思想星图 · Atlas of Ideas

一个以风格化3D地球为叙事入口、以仓库化内容为核心的世界哲学知识库。第一阶段公开30位人物，并建立了扩展至240人的覆盖矩阵；新增210人仍处于候选队列，不进入网站。

## 当前范围

- 30位人物：从苏格拉底、柏拉图、奥古斯丁、阿奎那，经笛卡尔、休谟、康德、黑格尔，延伸至马克思、尼采、维特根斯坦、波伏娃、阿伦特、法农与福柯
- 5段、约69秒的样片故事
- 故事模式与自由探索模式
- 5类关系：直接影响、文本传播、批判反驳、传统延展、主题共鸣
- 人物、著作、地点、关系证据与学术来源
- 搜索、问题筛选、时间轴、两人比较、稳定公开路径
- WebGL2地球与完整文字替代入口
- 人物、概念、传统、著作四类知识库目录与服务端详情页
- 240人覆盖矩阵、7个跨区域编辑批次与覆盖率报告

新增人物记录以Stanford Encyclopedia of Philosophy条目为主要二级来源；上线前仍需按内容规范进行逐条编辑与学术复核。

## 内容治理

规范内容位于 `content/knowledge/`，按人物、概念、传统、著作、语境、地点、来源和关系拆分为独立JSON。`app/_data/atlas.ts` 只是读取生成结果的3D兼容层，不再保存完整正文。

每次开发、构建、代码检查和类型检查前，生成器都会使用Zod校验内容，并更新本地生成物：

- `knowledge.json`：服务端详情数据；
- `knowledge-index.json` 与 `search-index.json`：轻量目录和搜索索引；
- `atlas.json`：不含正文段落的3D投影数据；
- `coverage-report.json`：发布数量、编辑状态、地区与深度覆盖报告。

生成的JSON不手工维护，也不提交版本库。所有正式关系必须满足：

1. 至少绑定一条学术来源及定位说明；
2. 起点和终点均为有效人物；
3. 主题共鸣为非方向性关系；
4. 主题相似不得升级为直接影响；
5. 不确定地点、年代和著作归属必须标注。

内容深度使用 `index`、`standard`、`deep`，编辑状态使用 `candidate`、`edited`、`reviewed`、`published`；只有 `published` 会进入公开生成物。详细规则见 `docs/CONTENT_POLICY.md`。

## 知识库路由

- `/knowledge`：统一目录，支持类型、地区、时代、传统、内容深度与关键词筛选，筛选状态保存在URL；
- `/thinker/[slug]`：人物分层阅读页，并可返回3D地球定位；
- `/concept/[slug]`、`/tradition/[slug]`、`/work/[slug]`：概念、传统与著作详情页；
- `/compare/[leftSlug]/[rightSlug]`：请求时校验并规范化顺序，不预生成全部两两组合。

原有 `/explore`、`/story/[chapter]` 和人物slug保持可用。`/explore?thinker=<slug>` 可恢复当前地球人物状态。

## 技术基线

- React 19、TypeScript、Vite/Vinext静态部署结构
- Three.js r184、React Three Fiber 9、WebGL2
- GSAP负责3D镜头，Motion负责DOM微交互
- Zustand共享故事与探索状态
- world-atlas与TopoJSON生成球面历史空间轮廓
- Cloudflare Sites静态托管

## 本地验证

```bash
npm run content:build
npm run content:audit
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:all
```

`npm run content:audit`会阻止无效引用、缺失端点、不合格发布状态和不满足内容层级的条目进入生成物。`npm test`会先生成发布构建，再检查知识库路由、30/27/31迁移基线、候选隔离、240人规模模拟、媒体文件、关系语义和客户端分包预算。`npm run test:e2e`使用桌面与移动端 Chromium 检查核心交互、知识库URL恢复、降级模式和视觉快照。

公开演示版的发布验收记录见 `docs/RELEASE_CHECKLIST.md`。
