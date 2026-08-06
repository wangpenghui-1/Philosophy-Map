# 备份与恢复运行手册

## 恢复目标

- 业务数据库 RPO 不超过 24 小时，RTO 不超过 4 小时。
- 托管 PostgreSQL 必须开启连续恢复/PITR；另做每日 `pg_dump -Fc` 逻辑备份。
- 日备保留 35 天，每季度保留一份 400 天；备份使用独立私有桶、服务端加密和受限恢复身份。
- 每个归档同时保存 `.sha256`，每天运行 `BACKUP_ARCHIVE_PATH=/absolute/file npm run backup:verify:archive`。
- 每 90 天执行一次隔离恢复演练并记录实际 RPO、RTO、行数和 RLS 检查结果。

## PostgreSQL 备份

备份任务使用只读备份身份，输出 custom-format 归档，再生成 SHA-256。连接串和归档路径由 Secret Store 注入，日志不得打印连接串。备份成功不等于可恢复：只有完整性检查和最近一次恢复演练同时有效才算健康。

## 隔离恢复演练

1. 创建名字以 `atlas_restore_` 开头的空临时数据库，严禁使用生产应用角色或生产数据库。
2. 先执行 `npm run backup:verify:archive`。
3. 执行 `npm run restore:drill` 查看不会改动数据的计划。
4. 明确设置 `RESTORE_DATABASE_URL`、`BACKUP_ARCHIVE_PATH` 和 `RESTORE_DRILL_CONFIRM=atlas-temporary-database` 后，运行 `npm run restore:drill:execute`。
5. 脚本拒绝与 `DATABASE_URL` 相同、名字不符合前缀或已有数据表的目标；它不会清库，也不会自动删除临时数据库。
6. 在临时环境运行迁移一致性、影子投影、双用户 RLS、账户删除、后台登录和公开 API smoke test。
7. 保存 `artifacts/production/restore-drill-report.json` 到受控审计存储，随后由运维人员手工销毁临时数据库。

## 对象存储

- 媒体桶保持私有，开启版本控制、默认加密、访问日志和每日 inventory。
- 未完成分段上传 7 天清理；非当前版本保留至少 90 天；quarantine 对象不进入公开 CDN。
- 数据库中的 `storage_key`、SHA-256、授权与扫描状态必须能和 inventory 对账。
- 恢复时先恢复数据库元数据，再按 inventory 核对对象；缺失媒体只影响媒体展示，不应阻断文字知识快照。

## 公开快照

每次构建先运行 `npm run release:manifest`，记录公开 JSON 的 SHA-256、大小、内容数量和 Git SHA。至少保留三个已验证 Vercel Production 部署。数据库故障时不重新生成快照，直接保留最近一次已验证部署；回滚使用 Vercel 历史部署或普通 Git revert，不重写历史。
