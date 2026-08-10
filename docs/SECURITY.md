# 安全策略与供应链门禁

## 生产安全边界

- 浏览器会话使用 `HttpOnly + Secure + SameSite=Strict` Cookie；所有Cookie写请求校验同源Origin或浏览器同源信号。Bearer API客户端不依赖CSRF Cookie。
- 登录、注册、验证、重置、AI、导出和账户删除分别限流。生产必须配置Redis；内存限流只用于本地和单实例降级。
- CSP使用逐请求nonce，禁止object和任意frame；HSTS、nosniff、Referrer Policy、Permissions Policy、COOP/CORP由服务端统一设置。
- Sentry关闭默认PII，删除请求Cookie、Authorization和正文；日志按字段脱敏，不保存密码、Token、密钥或完整用户Prompt。
- 媒体先进入quarantine，经对象HEAD校验与恶意文件扫描后才能ready；私有桶不允许匿名列举或读取原件。
- candidate、未复核和撤回内容不能进入公开API、静态投影和AI证据检索。

## 供应链门禁

CI必须通过`npm ci`锁文件安装、`npm run security:audit`、Dependabot依赖审查、迁移日志检查和完整测试。生产依赖出现moderate及以上漏洞即阻断。

截至2026-08-07，完整`npm audit`报告的4个moderate均来自`drizzle-kit`CLI内嵌的旧`esbuild`，只在开发/迁移生成时使用，不进入生产运行依赖；`npm audit --omit=dev`为0。该例外每周由Dependabot复查，不允许使用`npm audit fix --force`破坏性降级Drizzle来清零数字。若漏洞进入运行依赖、可由不可信输入触发或严重性升高，立即改为发布阻断项。

## 密钥与漏洞处理

密钥只保存在Vercel/供应商Secret Store，按Development、Preview、Production隔离。Sentry source map Token仅在构建阶段可见。疑似泄露时先撤销和轮换，再清理日志或Git历史；不得在issue、PR或聊天中粘贴原始凭据。

安全问题应私下报告给项目owner，内容至少包含影响范围、复现条件、受影响版本和建议缓解措施。确认数据泄露或越权后按`infra/runbooks/incident-response.md`执行。
