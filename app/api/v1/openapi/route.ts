import { publicJson } from "../../_lib/http";

const specification = {
  openapi: "3.1.0",
  info: {
    title: "思想星图 API",
    version: "1.0.0-alpha.1",
    description: "稳定的公开知识 API。候选和未复核内容不会出现在响应中。",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/catalog": { get: { summary: "公开知识目录统计", responses: { "200": { description: "成功" } } } },
    "/entities/{type}/{slug}": { get: { summary: "按类型和 slug 获取已发布实体", responses: { "200": { description: "成功" }, "404": { description: "未找到" } } } },
    "/search": { get: { summary: "搜索已发布知识实体", responses: { "200": { description: "成功" } } } },
    "/graph": { get: { summary: "读取有限深度关系图", responses: { "200": { description: "成功" } } } },
    "/journeys/{slug}": { get: { summary: "读取已发布思想旅程", responses: { "200": { description: "成功" } } } },
    "/atlas/snapshots/current": { get: { summary: "读取当前 3D 地球快照", responses: { "200": { description: "成功" }, "304": { description: "未变化" } } } },
    "/sources/{id}": { get: { summary: "读取已发布来源", responses: { "200": { description: "成功" } } } },
    "/auth/register": { post: { summary: "创建需要邮箱验证的会员账户", responses: { "202": { description: "已接受" } } } },
    "/auth/login": { post: { summary: "会员密码登录", responses: { "200": { description: "成功" }, "401": { description: "凭据无效、账户未验证或已锁定" } } } },
    "/auth/logout": { post: { summary: "注销当前会员会话", responses: { "200": { description: "成功" } } } },
    "/auth/verify": { post: { summary: "消费一次性邮箱验证令牌", responses: { "200": { description: "成功" } } } },
    "/auth/password-reset/request": { post: { summary: "申请密码重置邮件", responses: { "202": { description: "已接受" } } } },
    "/auth/password-reset": { post: { summary: "消费一次性令牌并重置密码", responses: { "200": { description: "成功" } } } },
    "/auth/sessions": { get: { summary: "读取当前账户的设备会话", responses: { "200": { description: "成功" } } } },
    "/me": { get: { summary: "读取当前会员资料", responses: { "200": { description: "成功" } } }, patch: { summary: "更新当前会员资料与记忆开关", responses: { "200": { description: "成功" } } } },
    "/me/library": { get: { summary: "读取收藏、阅读进度与旅程进度", responses: { "200": { description: "成功" } } } },
    "/me/favorites/{entityId}": { get: { summary: "读取收藏状态", responses: { "200": { description: "成功" } } }, put: { summary: "收藏知识实体", responses: { "200": { description: "成功" } } }, delete: { summary: "取消收藏", responses: { "204": { description: "成功" } } } },
    "/me/export": { post: { summary: "导出当前账户数据", responses: { "200": { description: "JSON 导出包" } } } },
    "/me/account": { delete: { summary: "硬删除账户与用户数据", responses: { "204": { description: "成功" } } } },
    "/conversations": { get: { summary: "列出当前匿名身份或账户的会话", responses: { "200": { description: "成功" } } }, post: { summary: "创建匿名或登录会话", responses: { "201": { description: "成功" }, "429": { description: "超过限额" } } } },
    "/conversations/{id}/messages": { post: { summary: "发送问题并接收 SSE 回答", responses: { "200": { description: "SSE 事件流" } } } },
  },
};

export function GET() {
  return publicJson(specification);
}
