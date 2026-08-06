# 后端实施与运行说明

## 当前交付

本阶段建立了可运行的模块化后端基础，同时保持现有公开站不依赖数据库：

- PostgreSQL/Drizzle 迁移当前包含42张表、pgvector、trigram、内容版本不可变触发器、用户数据RLS策略和Outbox。
- 静态兼容Repository只读取构建器生成的published快照；candidate不会进入公共API或AI检索。
- 已实现目录、实体、搜索、图谱、旅程、来源、Atlas Snapshot和OpenAPI端点。
- 匿名对话在无数据库时以临时模式运行；配置数据库后保存消息、引用快照、模型运行和用量。
- OpenAI适配器使用Responses API并固定`store: false`；没有模型配置时使用站内证据的抽取式回答。
- 已实现数据库会话适配器、个人设置、收藏、阅读进度、显式长期记忆、数据导出与账户硬删除端点。
- 已实现候选版本创建、乐观并发控制、审核状态机、发布审计和发布Outbox。

没有配置外部服务时，`npm run dev`、构建和现有页面仍使用静态兼容模式。

## 环境与命令

复制`.env.example`到本地环境文件并只填写需要启用的服务。真实密钥不得提交。

```bash
npm run db:generate
npm run db:migrate
npm run db:shadow:check
npm run db:shadow:apply
npm run backend:shadow-check
npm run worker:run-once
```

`db:shadow:check`只检查生成快照是否可以安全导入。`db:shadow:apply`才会连接数据库，并且只导入构建器已经判定为published的记录。相同实体版本不会被原位覆盖；内容变化必须增加版本号。

## 管理员登录与内容后台

管理后台入口为`/admin/login`。未配置数据库时，只在`127.0.0.1`或`localhost`提供只读预览；该身份不能创建、编辑、审核或发布内容。正式环境必须先执行迁移，再通过一次性环境变量创建首个owner：

```bash
ADMIN_BOOTSTRAP_EMAIL="owner@example.com" \
ADMIN_BOOTSTRAP_PASSWORD="使用密码管理器生成的长密码" \
npm run admin:bootstrap
```

初始化命令不会输出密码，也不会默认覆盖已有凭据。确需轮换现有owner密码时，单次设置`ADMIN_BOOTSTRAP_FORCE=1`。登录会话使用随机Token，数据库只保存SHA-256摘要；密码使用带随机盐的scrypt哈希。连续失败八次后锁定十五分钟。

首个后台版本包含总览、内容筛选、candidate创建、草稿编辑和状态推进。API继续执行角色权限与`If-Match`并发检查，界面隐藏按钮不能替代服务端授权。

## API 边界

公共API根路径为`/api/v1`，契约入口为`/api/v1/openapi`。公共读响应带CDN缓存策略；Atlas Snapshot支持ETag。

后台写路径为`/api/admin/v1`。内容版本更新必须携带读取时返回的`If-Match`，否则返回428；版本过期返回412。发布只能从reviewed推进，并在同一事务中写入发布事件、审计事件和Outbox。

个人数据端点必须持有`atlas_session`数据库会话Cookie。管理后台已经提供数据库密码账户登录；公开会员注册、邮件登录和OAuth/OIDC供应商仍未接入，不应把管理员登录入口当作普通用户注册入口。

## 数据安全边界

- PostgreSQL必须使用独立应用角色；表所有者会绕过普通RLS，不能作为生产应用连接角色。
- 应用角色访问用户表时应在事务中设置`app.user_id`，RLS策略以该值校验所有权。
- 高权限账户的MFA、邮件/OAuth供应商、Redis限流、Inngest托管接入和对象存储仍需要部署环境配置。
- 账户删除会级联删除会话、消息、记忆、收藏与进度；审计事件保留但不保存认证凭据。
- 音频、实时语音和原生移动端尚未进入本阶段运行范围，数据库与API只预留兼容边界。

## 后续阶段

1. 连接隔离的开发PostgreSQL，执行迁移、影子导入和数据库投影对比。
2. 接入稳定版Auth.js或OIDC身份供应商与MFA，并与现有owner账户绑定。
3. 在现有知识内容工作台基础上，继续实现来源、关系、旅程和媒体管理界面。
4. 接入Redis限流、Inngest事件传递、S3媒体和OpenTelemetry/Sentry导出器。
5. 以固定哲学问答集运行AI引用精确率、覆盖率和拒答评测，再开放公开入口。
