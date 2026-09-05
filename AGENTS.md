# 开发协作与自动发布流程

本项目采用“完成实现 → 一次统一审核 → 自动发布”的工作方式。用户授权实施修复或更新后，代理应完成实现与验证；统一审核通过后，无需再逐步等待 Git 操作授权，自动完成整个发布流程。

## 职责边界

- 代理可在用户明确的任务范围内自主阅读代码、实现修改、运行验证并完成发布。
- 代理不得索取、显示、保存或转发 GitHub 密码、个人访问令牌、cookie、会话文件或其他原始凭据。
- 设计、诊断、解释或只读审查请求不触发发布；只有实际产生项目修改的修复或更新才进入自动发布流程。
- 涉及付费套餐、密钥策略、生产数据删除、破坏性迁移或超出原任务范围的变更，仍须先取得用户明确授权。

## 一次统一审核

每次修复或更新完成后，只设置一次发布检查点。代理应在此检查点统一完成：

1. 核对变更范围，区分本任务文件与既有或无关修改；
2. 审查正确性、安全性、兼容性、迁移风险和回滚路径；
3. 运行与风险相称的 lint、类型检查、单元、集成、端到端及构建验证；
4. 确认版本号、变更日志、发布说明和生产验收方案；
5. 报告审核结论和发布范围。

审核通过后，代理自动继续发布，不再分别等待暂存、提交、推送、PR、合并、标签或部署授权。审核失败、必要验证失败、发现无法隔离的无关修改，或者需要新的高风险授权时，必须停止发布并向用户报告。

## 自动发布流程

统一审核通过后，按顺序自动执行：

1. 仅精确暂存本任务文件，禁止使用 `git add -A`；
2. 创建符合 Conventional Commits 的本地提交；
3. 按语义化版本更新版本号和变更日志，并创建发布提交；
4. 推送当前维护分支；
5. 创建准备审阅的 PR；
6. 等待并核验所有必需 CI、Preview 和分支保护检查；
7. 检查通过后合并至默认分支，不绕过保护规则；
8. 同步默认分支，在合并提交上创建并推送对应版本标签，触发或执行 Production 部署；
9. 对线上页面、关键 API、健康检查、监控和回滚点执行生产验收；
10. 向用户报告提交、PR、合并、标签、部署地址和验收结果。

任何步骤失败时应保留可恢复状态，停止后续步骤并报告明确原因；不得强推、伪造检查结果或绕过 CI。生产验收失败时，应优先使用既定回滚机制恢复最近稳定版本。

## 范围保护

- 禁止批量删除文件或目录；删除时只能逐个操作明确路径。
- 绝不使用 `git add -A` 或类似方式默认纳入整个工作区。
- 推送前再次核对分支、上游、待推送提交和未提交改动。
- 自动发布只覆盖本次审核确认的文件；无法安全隔离时立即停止。
- 不得使用 `git reset --hard`、强制推送或其他会覆盖用户工作的操作。

## 分支与版本约定

- 小型修复和维护更新集中使用当前长期维护分支，发布后同步默认分支，不为每个小改动重复创建分支。
- 新的大型功能或相互独立的高风险工作可使用 `codex/<简短任务名>` 分支。
- 修复默认提升补丁版本，新功能默认提升次版本，破坏性变更提升主版本；检测到例外时在统一审核中说明。
- 已存在的版本标签不得移动或覆盖；发布失败时创建后续修复版本。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
