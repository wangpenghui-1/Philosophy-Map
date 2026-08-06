# 生产基础设施入口

本目录只保存无密钥的策略、检查表和运行手册。真实连接串、Token、备份文件和恢复报告不得提交 Git。

- `backup-policy.json`：机器可检查的 RPO、RTO、保留与加密要求。
- `production-readiness.json`：生产变量名称、线上探针、安全响应头与人工证据门禁的唯一清单。
- `runbooks/production-operations.md`：日常运行、告警与发布操作。
- `runbooks/backup-and-restore.md`：PostgreSQL、对象存储和公开快照的备份恢复。
- `runbooks/deployment-acceptance.md`：从 Git SHA、环境变量名称到正式域名的最终验收流程。
- `runbooks/incident-response.md`：故障分级、止损、沟通与复盘。

`templates/production-evidence.example.json` 只提供无密钥证据结构。实际证据保存在 Git 已忽略的 `artifacts/production/`，不得提交真实凭据或连接信息。

本项目以 Vercel + 托管 PostgreSQL + Upstash Redis + S3/R2 为推荐生产组合，但脚本只依赖标准 PostgreSQL 和 S3 语义，避免把恢复能力锁死在单一供应商。
