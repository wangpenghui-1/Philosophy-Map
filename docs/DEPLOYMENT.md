# Vercel部署与维护约定

## 发布基线

- `main`是唯一生产分支，Vercel Production只跟踪`main`。
- 功能开发使用短期分支，通过Pull Request进入`main`。
- Pull Request和非生产分支只生成Preview，不直接影响正式站点。
- 不允许force push生产分支；回滚使用Vercel历史部署或普通revert提交。

## 构建环境

- Node.js：22.x；本地推荐使用`.nvmrc`中的版本。
- 包管理器：npm；依赖以`package-lock.json`为唯一锁定基线。
- 安装命令：`npm ci`。
- 构建命令：`npm run build`。
- 启动命令：`npm run start`，仅用于本地生产预览；Vercel自动托管Next.js运行时。

构建前会执行`npm run content:build`，校验并生成公开知识库索引。生成文件不提交，由本地、GitHub Actions和Vercel在各自构建环境中重新生成。

## 环境变量

公开静态阅读不需要运行时密钥；会员、后台、AI和媒体能力需要生产服务。变量按职责分组：

- 核心：`DATABASE_URL` 只用于迁移和受控运维，`DATABASE_APP_URL` 使用最小权限角色供 Web 与 Worker 运行；另需 `AUTH_SECRET`、`APP_BASE_URL`、`APP_ENV=production`。应用在两者同时存在时优先使用 `DATABASE_APP_URL`。
- 账户：`RESEND_API_KEY`、`EMAIL_FROM`。
- 限流：`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。
- AI：`OPENAI_API_KEY`、`OPENAI_RESPONSE_MODEL`、`DEEPSEEK_API_KEY`、`DEEPSEEK_RESPONSE_MODEL`、Token上限和价格配置。OpenAI为主模型，DeepSeek仅在主模型调用失败时接管；两个供应商都失败时继续使用站内证据摘录。
- 媒体：当前生产设置 `MEDIA_UPLOADS_ENABLED=0`，不创建 R2 按量计费订阅，后台与 API 都拒绝上传；现有 `/public` 静态媒体继续使用。未来启用时必须同时配置私有 S3/R2、扫描服务和费用保护，并重新完成发布验收。
- 监控：Sentry服务端/客户端DSN、构建期source map凭据、OpenTelemetry导出端点。
- 就绪门禁：生产设置`REQUIRE_PRODUCTION_SERVICES=1`；缺少关键依赖时ready返回503，但已部署公开快照仍可读。

生产值只配置到 Vercel Production。Preview 在需要联调时单独创建隔离数据库、Redis 与媒体桶；在隔离资源尚未建立前保持无后端密钥的静态兼容模式，绝不能复用 Production 凭据。`DATABASE_URL` 不进入 Web 或 Worker 运行环境，只在独立的迁移、备份和恢复作业中按需注入。不要把真实值写入仓库、PR 描述、构建日志或备份报告。

## 持续部署

GitHub Actions负责内容完整性、Lint、TypeScript、生产构建、数据测试及桌面/移动浏览器回归。只有质量门禁通过的PR才能进入`main`。Vercel负责：

1. 为Pull Request生成隔离的Preview URL；
2. 在`main`更新后创建Production部署；
3. 保留可即时回滚的历史部署。

构建后运行`npm run release:manifest`并把`artifacts/production/release-manifest.json`保存为发布证据。Production至少保留三个已验证部署。

部署验证必须同时核对Git提交、Vercel部署状态和正式URL，不能只根据环境变量或控制台配置推断上线成功。

## 本地检查

```bash
npm run content:edit:check
npm run content:release:check
npm run lint
npm run typecheck
npm run security:audit
npm run db:migrate:check
npm test
npm run test:e2e
npm run backup:verify
npm run restore:drill
npm run release:manifest
```

正式发布前使用`npm run review:full`生成完整审核报告。

最终 Production 验收使用两步命令：`npm run deployment:report` 用于生成当前差距且不阻断终端，`npm run deployment:check` 用于严格判定。两者都会校验部署 SHA、公开页面、live/ready、后台登录与保护、API、安全响应头、生产变量名称和人工恢复证据。完整输入格式与操作顺序见`infra/runbooks/deployment-acceptance.md`。

没有提供生产变量名称清单和逐项人工证据时，工具必须输出`blocked`。本地通过、Vercel 显示 Ready 或正式首页返回 200，任何单项都不能独立构成生产验收完成。

Playwright默认使用独立的`3100`端口启动全新的Next.js生产服务器，避免复用本地开发服务或旧Vinext进程。只有明确设置`PLAYWRIGHT_REUSE_SERVER=1`时才复用已有测试服务器。

## 回滚

优先在Vercel中把上一个已验证的Production部署重新提升为正式版本，恢复服务后再通过普通revert提交修复`main`。不要通过force push重写生产历史。

数据库迁移采用expand/migrate/contract：先新增兼容结构，再迁移数据并部署兼容代码，最后在至少两个稳定发布周期后移除旧结构。只有数据损坏且代码回滚无法解决时才执行PITR或备份恢复，流程见`infra/runbooks/backup-and-restore.md`。
