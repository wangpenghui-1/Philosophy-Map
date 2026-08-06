import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./account.module.css";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}><header className={styles.header}><Link className={styles.brand} href="/"><span>I</span><strong>思想星图<small>ATLAS OF IDEAS</small></strong></Link><nav><Link href="/knowledge">知识库</Link><Link href="/explore">3D探索</Link><Link href="/account">我的账户</Link></nav></header><main className={styles.main}>{children}</main></div>;
}
