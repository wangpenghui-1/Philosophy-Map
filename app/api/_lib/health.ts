import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { databaseSchema, getDatabase, isDatabaseConfigured } from "@atlas/db";
import { isEmailConfigured } from "./email";
import { isMediaStorageConfigured, isMediaUploadPolicyEnabled, probeMediaStorage } from "./media-storage";
import { redisEnvironment } from "./rate-limit";

export type ServiceHealthStatus = "healthy" | "configured" | "missing" | "unhealthy";

export interface ServiceHealth {
  name: string;
  label: string;
  status: ServiceHealthStatus;
  required: boolean;
  latencyMs?: number;
  detail: string;
}

export interface SystemHealthReport {
  status: "ready" | "degraded" | "not-ready";
  checkedAt: string;
  mode: "production-required" | "static-compatible";
  snapshotAvailable: true;
  services: ServiceHealth[];
}

const requiredServiceNames = new Set(["database", "redis", "object-storage", "email", "media-scanner", "ai", "error-monitoring"]);
let cachedReport: { expiresAt: number; value: SystemHealthReport } | null = null;

function isRequired(name: string) {
  if (["object-storage", "media-scanner"].includes(name) && !isMediaUploadPolicyEnabled()) return false;
  return process.env.REQUIRE_PRODUCTION_SERVICES === "1" && requiredServiceNames.has(name);
}

function configured(name: string, label: string, available: boolean, detail: string): ServiceHealth {
  return {
    name,
    label,
    status: available ? "configured" : "missing",
    required: isRequired(name),
    detail: available ? detail : "缺少生产环境配置",
  };
}

async function activeProbe(name: string, label: string, available: boolean, operation: () => Promise<void>): Promise<ServiceHealth> {
  const required = isRequired(name);
  if (!available) return { name, label, status: "missing", required, detail: "缺少生产环境配置" };
  const startedAt = performance.now();
  try {
    await operation();
    return { name, label, status: "healthy", required, latencyMs: Math.round(performance.now() - startedAt), detail: "连接正常" };
  } catch {
    return { name, label, status: "unhealthy", required, latencyMs: Math.round(performance.now() - startedAt), detail: "连接检查失败" };
  }
}

async function probeDatabase() {
  return activeProbe("database", "PostgreSQL", isDatabaseConfigured(), async () => {
    await getDatabase().execute(sql`select 1 as healthy`);
  });
}

async function probeRedis() {
  const redis = redisEnvironment();
  const url = redis.url?.replace(/\/$/, "");
  const token = redis.token;
  return activeProbe("redis", "Redis 限流与缓存", Boolean(url && token), async () => {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([["PING"]]),
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Redis probe failed.");
  });
}

async function probeObjectStorage() {
  if (!isMediaUploadPolicyEnabled()) {
    return { name: "object-storage", label: "媒体上传", status: "configured", required: false, detail: "按零付费策略安全关闭；现有静态媒体继续可用" } satisfies ServiceHealth;
  }
  return activeProbe("object-storage", "S3 / R2 媒体存储", isMediaStorageConfigured(), probeMediaStorage);
}

export async function getSystemHealth(options: { fresh?: boolean } = {}): Promise<SystemHealthReport> {
  if (!options.fresh && cachedReport && cachedReport.expiresAt > Date.now()) return cachedReport.value;
  const [database, redis, storage] = await Promise.all([probeDatabase(), probeRedis(), probeObjectStorage()]);
  const services: ServiceHealth[] = [
    database,
    redis,
    storage,
    configured("email", "Resend 邮件", isEmailConfigured(), "发件身份已配置"),
    isMediaUploadPolicyEnabled()
      ? configured("media-scanner", "媒体恶意文件扫描", Boolean(process.env.MEDIA_SCAN_ENDPOINT && process.env.MEDIA_SCAN_TOKEN), "扫描服务已配置")
      : { name: "media-scanner", label: "媒体文件扫描", status: "configured", required: false, detail: "上传入口关闭，因此不接收待扫描文件" },
    configured("ai", "双模型有据对话", Boolean(
      process.env.OPENAI_API_KEY
      && process.env.OPENAI_RESPONSE_MODEL
      && process.env.DEEPSEEK_API_KEY
      && process.env.DEEPSEEK_RESPONSE_MODEL
    ), "OpenAI 主模型与 DeepSeek 回退模型已配置"),
    configured("error-monitoring", "Sentry 错误监控", Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN), "服务端与浏览器端 DSN 已配置"),
    configured("telemetry", "OpenTelemetry 导出", Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? process.env.SENTRY_OTLP_TRACES_URL), "Trace 导出端点已配置"),
  ];
  const productionRequired = process.env.REQUIRE_PRODUCTION_SERVICES === "1";
  const requiredFailure = services.some((service) => service.required && !["healthy", "configured"].includes(service.status));
  const degraded = services.some((service) => !["healthy", "configured"].includes(service.status));
  const value: SystemHealthReport = {
    status: requiredFailure ? "not-ready" : degraded ? "degraded" : "ready",
    checkedAt: new Date().toISOString(),
    mode: productionRequired ? "production-required" : "static-compatible",
    snapshotAvailable: true,
    services,
  };
  cachedReport = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export async function getOperationalMetrics() {
  if (!isDatabaseConfigured()) {
    return { databaseAvailable: false, outboxPending: 0, outboxFailed: 0, modelRunsFailed24h: 0, aiCostUsd24h: 0 };
  }
  const database = getDatabase();
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [pendingRows, failedRows, failedRunsRows, costRows] = await Promise.all([
    database.select({ value: count() }).from(databaseSchema.outboxEvents).where(eq(databaseSchema.outboxEvents.status, "pending")),
    database.select({ value: count() }).from(databaseSchema.outboxEvents).where(eq(databaseSchema.outboxEvents.status, "failed")),
    database.select({ value: count() }).from(databaseSchema.modelRuns).where(and(eq(databaseSchema.modelRuns.status, "failed"), gte(databaseSchema.modelRuns.createdAt, since))),
    database.select({ value: sum(databaseSchema.usageLedger.estimatedCostUsd) }).from(databaseSchema.usageLedger).where(gte(databaseSchema.usageLedger.createdAt, since)),
  ]);
  return {
    databaseAvailable: true,
    outboxPending: pendingRows[0]?.value ?? 0,
    outboxFailed: failedRows[0]?.value ?? 0,
    modelRunsFailed24h: failedRunsRows[0]?.value ?? 0,
    aiCostUsd24h: Number(costRows[0]?.value ?? 0),
  };
}
