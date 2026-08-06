import type { EditorialStatus, EntityType } from "@atlas/domain";
import Link from "next/link";
import { listAdminContent } from "../../_lib/data";
import { requireAdminPrincipal } from "../../_lib/auth";
import styles from "../../admin.module.css";

const entityTypes = ["all", "person", "concept", "tradition", "work", "context", "place"] as const;
const statuses = ["all", "candidate", "edited", "reviewed", "published"] as const;

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const principal = await requireAdminPrincipal("/admin/content");
  const params = await searchParams;
  const type = entityTypes.includes(params.type as typeof entityTypes[number]) ? params.type as EntityType | "all" : "all";
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status as EditorialStatus | "all" : "all";
  const rows = await listAdminContent(principal, { q: params.q, type, status });

  return (
    <>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>KNOWLEDGE CONTENT</span><h1>知识内容</h1><p>候选、编辑、复核与发布版本保持独立，公开站只读取 published。</p></div>
        <Link className={styles.primaryAction} href="/admin/content/new">新建候选稿</Link>
      </header>
      <form className={styles.filters}>
        <label><span>搜索标题</span><input defaultValue={params.q} name="q" placeholder="人物、概念或 stable key" /></label>
        <label><span>类型</span><select defaultValue={type} name="type">{entityTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>状态</span><select defaultValue={status} name="status">{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="submit">筛选</button>
      </form>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{rows.length} 条结果</h2>{principal.mode === "local-preview" && <span>只读公开快照</span>}</div>
        <div className={styles.tableWrap}>
          <table><thead><tr><th>标题</th><th>类型</th><th>层级</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id}>
              <td><strong>{item.title}</strong><small>{item.slug}</small></td><td>{item.entityType}</td><td>{item.contentTier}</td><td>v{item.version}</td>
              <td><span className={`${styles.status} ${styles[`status_${item.status}`]}`}>{item.status}</span></td>
              <td>{item.publicHref ? <Link href={item.publicHref}>查看公开页</Link> : <Link href={`/admin/content/${item.id}`}>编辑版本</Link>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
