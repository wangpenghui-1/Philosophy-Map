import { hasPermission } from "@atlas/domain";
import { getOperationalMetrics, getSystemHealth } from "../../../api/_lib/health";
import { requireAdminPrincipal } from "../../_lib/auth";
import styles from "../../admin.module.css";

const statusLabel = { healthy: "正常", configured: "已配置／已关闭", missing: "未配置", unhealthy: "异常" } as const;

export default async function AdminSystemPage() {
  const principal = await requireAdminPrincipal("/admin/system");
  if (!hasPermission(principal.role, "system:operate")) {
    return <section className={styles.panel}><div className={styles.panelHeading}><h1>没有系统运维权限</h1></div></section>;
  }
  const [health, metrics] = await Promise.all([getSystemHealth({ fresh: true }), getOperationalMetrics()]);
  return (
    <>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>OPERATIONS</span><h1>生产运行状态</h1><p>检查关键依赖、异步任务和 AI 费用。公开静态快照始终保持独立可用。</p></div>
      </header>
      <section className={styles.operationSummary}>
        <div><span>就绪状态</span><strong>{health.status}</strong><small>{health.mode}</small></div>
        <div><span>Outbox 待处理</span><strong>{metrics.outboxPending}</strong><small>当前队列</small></div>
        <div><span>Outbox 失败</span><strong>{metrics.outboxFailed}</strong><small>需要人工处理</small></div>
        <div><span>24h AI 费用</span><strong>${metrics.aiCostUsd24h.toFixed(4)}</strong><small>{metrics.modelRunsFailed24h} 次失败</small></div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>INTEGRATIONS</span><h2>关键服务</h2></div><span>{new Date(health.checkedAt).toLocaleString("zh-CN")}</span></div>
        <div className={styles.serviceGrid}>
          {health.services.map((service) => (
            <article key={service.name}>
              <div><h3>{service.label}</h3><span className={styles[`health_${service.status}`]}>{statusLabel[service.status]}</span></div>
              <p>{service.detail}</p>
              <small>{service.required ? "生产就绪必需" : "增强能力"}{service.latencyMs !== undefined ? ` · ${service.latencyMs} ms` : ""}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
