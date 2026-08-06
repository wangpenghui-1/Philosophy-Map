# 生产部署验收运行手册

本手册用于区分三种状态：代码门禁通过、Production 已部署、Production 已完成安全与恢复验收。前两项不能替代第三项。

## 验收输入

最终验收必须同时具备：

1. 要部署的完整 Git SHA；
2. Vercel Production 的环境变量**名称**清单以及四个非敏感公开值断言；
3. `artifacts/production/production-evidence.json` 人工证据文件；
4. 正式域名可访问，`/api/health/live` 和 `/api/health/ready` 已上线；
5. 最新备份校验报告、隔离恢复演练报告和可回滚部署记录。

验收工具不会读取或输出环境变量值。数据库连接串、API Key、Token、Cookie、备份文件路径和 MFA 恢复码不得写进证据文件、Git、PR 或日志。

## 生成无密钥环境清单

在 Vercel 中核对 Production 和 Preview 完全隔离。把 Production 变量名导出为换行文本或以下 JSON；`assertions` 只允许填写公开配置值：

```json
{
  "names": ["DATABASE_URL", "AUTH_SECRET"],
  "assertions": {
    "APP_ENV": "production",
    "NEXT_PUBLIC_APP_ENV": "production",
    "REQUIRE_PRODUCTION_SERVICES": "1",
    "APP_BASE_URL": "https://www.ideaglobemap.cn"
  }
}
```

完整必需名称由 `infra/production-readiness.json` 统一维护。不要把真实值复制到此文件。证据文件和变量清单都放在已被 Git 忽略的 `artifacts/production/` 中。

## 准备人工证据

复制 `infra/templates/production-evidence.example.json` 到 `artifacts/production/production-evidence.json`，保持每个门禁为 `pending`，直到操作人员真正完成验证。通过项必须同时填写：

- `status: "passed"`；
- ISO 8601 格式的 `checkedAt`；
- 不含密钥的证据定位，例如工单号、Sentry Issue 链接、备份对象版本号、恢复报告文件名或 Vercel Deployment ID。

证据中的 `release` 必须是本次 Production 完整 SHA，`baseUrl` 必须是正式 `www` 域名。工具会拒绝沿用其他提交或其他环境的证据。

## 正式发布顺序

1. 确认 `main` 分支保护、必需检查和禁止强制推送已启用；本次 SHA 的 PR、GitHub Actions、依赖审查和代码审核通过。
2. 使用迁移专用角色执行向后兼容迁移；应用运行时使用非表所有者角色。
3. 在隔离 Preview 完成影子导入、投影对比、双用户 RLS、账户硬删除、管理员登录与 AI 引用测试。
4. 合并到 `main`，等待 Vercel Production 显示 Ready，并记录 Deployment ID 和 SHA。
5. 确认 `/api/health/live` 返回该完整 SHA，`/api/health/ready` 返回 `ready + production-required`。
6. 验证数据库 PITR、最新 `pg_dump -Fc`、SHA-256、`pg_restore --list` 和一次隔离临时库恢复。
7. 验证私有媒体桶版本控制、加密、生命周期、inventory 与 quarantine 隔离。
8. 完成桌面、390px、无 WebGL、弱网、SSE 中断恢复和数据库/Redis/AI 故障下的静态阅读回退。
9. 填完人工证据后运行严格验收；只有输出 `accepted` 才能标记生产验收完成。

## 命令

先检查不会联网、不会写文件的计划：

```bash
npm run deployment:check:plan
```

部署前或部署后生成当前差距报告；该命令即使发现阻断也以成功退出，便于保存报告：

```bash
npm run deployment:report -- \
  --expected-release <full-git-sha> \
  --env-source names-file \
  --env-names-file artifacts/production/production-env-names.json \
  --evidence artifacts/production/production-evidence.json
```

完成所有证据后执行严格验收：

```bash
npm run deployment:check -- \
  --expected-release <full-git-sha> \
  --env-source names-file \
  --env-names-file artifacts/production/production-env-names.json \
  --evidence artifacts/production/production-evidence.json
```

输出为 `artifacts/production/deployment-acceptance.json` 和 `.md`。任一线上探针、安全响应头、环境清单、公开值断言或人工门禁失败时，严格命令返回非零。

## 验收后的持续监控

- Vercel 每分钟检查 live，每五分钟检查 ready；ready 连续十分钟失败触发 P2。
- Sentry 告警服务端 5xx、浏览器崩溃、AI 运行失败和 Worker 异常；日志保持 PII 脱敏。
- Outbox failed 大于 0 或 pending 持续增长触发 P2；AI 费用按日预算告警。
- 每日验证备份新鲜度和校验和；每 90 天重做恢复演练。
- 每次 Production 发布重新生成验收报告，旧报告不得跨 release 复用。
