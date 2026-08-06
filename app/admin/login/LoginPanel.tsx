"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../admin.module.css";

export function LoginPanel({ databaseConfigured, nextPath }: { databaseConfigured: boolean; nextPath: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function finish(response: Response) {
    if (!response.ok) {
      const problem = await response.json().catch(() => ({})) as { title?: string; detail?: string };
      throw new Error(problem.detail ?? problem.title ?? "登录失败，请稍后重试。 ");
    }
    router.replace(nextPath);
    router.refresh();
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await finish(await fetch("/api/admin/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败。 ");
    } finally {
      setPending(false);
    }
  }

  async function preview() {
    setPending(true);
    setError(undefined);
    try {
      await finish(await fetch("/api/admin/v1/auth/preview", { method: "POST" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法进入预览。 ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.loginCard}>
      <span className={styles.eyebrow}>ATLAS EDITORIAL CONSOLE</span>
      <h1>进入思想星图内容后台</h1>
      <p>候选内容、来源核验、审核与发布在这里分阶段完成。公开站不会直接读取未发布版本。</p>

      {databaseConfigured ? (
        <form className={styles.loginForm} onSubmit={login}>
          <label><span>邮箱</span><input autoComplete="username" name="email" required type="email" /></label>
          <label><span>密码</span><input autoComplete="current-password" minLength={12} name="password" required type="password" /></label>
          <button disabled={pending} type="submit">{pending ? "正在验证…" : "登录管理后台"}</button>
        </form>
      ) : (
        <div className={styles.previewLogin}>
          <strong>当前没有连接开发数据库</strong>
          <p>可以先进入本机只读预览，查看后台信息架构和现有公开内容；创建、编辑、审核与发布均保持禁用。</p>
          <button disabled={pending} onClick={preview} type="button">{pending ? "正在进入…" : "进入本地只读预览"}</button>
        </div>
      )}

      {error && <p className={styles.formError} role="alert">{error}</p>}
      <small>正式账户必须由 owner 通过安全的数据库初始化命令创建，不提供公开注册入口。</small>
    </div>
  );
}
