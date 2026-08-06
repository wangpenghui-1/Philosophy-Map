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
    "/conversations": { post: { summary: "创建匿名或登录会话", responses: { "201": { description: "成功" } } } },
    "/conversations/{id}/messages": { post: { summary: "发送问题并接收 SSE 回答", responses: { "200": { description: "SSE 事件流" } } } },
  },
};

export function GET() {
  return publicJson(specification);
}
