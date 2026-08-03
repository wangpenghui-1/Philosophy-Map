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

当前公开站点不需要运行时密钥。后续功能如引入数据库、分析服务或外部API，应分别在Vercel的Development、Preview和Production环境中配置，并在本文记录变量名称、用途和是否必需。不要把真实值写入仓库、PR描述或构建日志。

## 持续部署

GitHub Actions负责内容完整性、Lint、TypeScript、生产构建、数据测试及桌面/移动浏览器回归。只有质量门禁通过的PR才能进入`main`。Vercel负责：

1. 为Pull Request生成隔离的Preview URL；
2. 在`main`更新后创建Production部署；
3. 保留可即时回滚的历史部署。

部署验证必须同时核对Git提交、Vercel部署状态和正式URL，不能只根据环境变量或控制台配置推断上线成功。

## 本地检查

```bash
npm run content:edit:check
npm run content:release:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

正式发布前使用`npm run review:full`生成完整审核报告。

Playwright默认使用独立的`3100`端口启动全新的Next.js生产服务器，避免复用本地开发服务或旧Vinext进程。只有明确设置`PLAYWRIGHT_REUSE_SERVER=1`时才复用已有测试服务器。

## 回滚

优先在Vercel中把上一个已验证的Production部署重新提升为正式版本，恢复服务后再通过普通revert提交修复`main`。不要通过force push重写生产历史。
