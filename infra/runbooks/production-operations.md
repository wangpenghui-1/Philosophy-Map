# 生产运行手册

## 每日检查

- `/api/health/live` 返回 200；`/api/health/ready` 在生产强制模式返回 ready。
- `/admin/system` 中 PostgreSQL、Redis、对象存储、邮件、扫描、AI 与 Sentry 均正常或已配置。
- Outbox failed 为 0，pending 不持续增长；24 小时 AI 失败率和费用未超过预算。
- 最近一次 PostgreSQL 逻辑备份小于 26 小时，最近恢复演练不超过 90 天。
- 公开知识页、Atlas Snapshot 和一个人物页从 CDN 可读。

## 告警建议

- P1：公开站完全不可读、数据泄露、账户越权、生产数据损坏。
- P2：登录/后台/AI 全面失败、ready 连续 10 分钟 503、Outbox failed 增长。
- P3：单一外部集成失败、延迟或费用异常，但静态阅读正常。

Sentry 负责异常聚合；OpenTelemetry 串联请求、数据库和 Worker；Vercel 监控 live/ready；备份平台单独告警。日志只记录 `x-request-id`、模块、操作、耗时和脱敏错误码。

## 发布与回滚

发布前完成 `docs/RELEASE_CHECKLIST.md`。数据库迁移遵守向后兼容的 expand/migrate/contract 顺序；先迁移，再部署兼容代码，最后在至少两个稳定发布周期后清理旧字段。出现故障先恢复上一个 Vercel Production 部署；数据库只有在数据损坏且回滚代码无法解决时才走 PITR/恢复流程。

每个 Production 发布都按 `infra/runbooks/deployment-acceptance.md` 重做严格验收。验收报告绑定完整 Git SHA，不得复用上一版本的人工证据。
