"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./account.module.css";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";
const copy = { login: ["MEMBER LOGIN", "登录思想星图"], register: ["CREATE ACCOUNT", "创建会员账户"], forgot: ["RESET PASSWORD", "找回密码"], reset: ["NEW PASSWORD", "设置新密码"], verify: ["VERIFY EMAIL", "验证邮箱"] } as const;

export function AuthPanel({ mode, enabled, token, nextPath = "/account" }: { mode: Mode; enabled: boolean; token?: string; nextPath?: string }) {
  const router = useRouter(); const [pending, setPending] = useState(mode === "verify" && Boolean(token)); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string | undefined>(mode === "verify" && !token ? "验证链接缺少令牌。" : undefined);
  async function request(endpoint: string, body: unknown) { const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})) as { data?: { message?: string }; detail?: string; title?: string }; if (!response.ok) throw new Error(payload.detail ?? payload.title ?? "请求失败。"); return payload; }
  useEffect(() => { if (mode !== "verify" || !token) return; request("/api/v1/auth/verify", { token }).then(() => { setMessage("邮箱验证成功，正在进入账户中心…"); router.replace("/account"); router.refresh(); }).catch((cause) => setError(cause instanceof Error ? cause.message : "验证失败。")).finally(() => setPending(false)); }, [mode, router, token]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(undefined); setMessage(undefined); const form = new FormData(event.currentTarget);
    try {
      if (mode === "login") { await request("/api/v1/auth/login", { email: form.get("email"), password: form.get("password") }); router.replace(nextPath); router.refresh(); return; }
      if (mode === "register") { const result = await request("/api/v1/auth/register", { email: form.get("email"), password: form.get("password"), displayName: form.get("displayName"), acceptPrivacy: form.get("acceptPrivacy") === "on" }); setMessage(result.data?.message ?? "请检查邮箱并完成验证。"); }
      if (mode === "forgot") { const result = await request("/api/v1/auth/password-reset/request", { email: form.get("email") }); setMessage(result.data?.message ?? "如果账户存在，邮件会很快送达。"); }
      if (mode === "reset") { if (!token) throw new Error("重置链接缺少令牌。"); await request("/api/v1/auth/password-reset", { token, password: form.get("password") }); setMessage("密码已更新，请重新登录。"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "请求失败。"); } finally { setPending(false); }
  }
  return <section className={styles.authCard}><span className={styles.eyebrow}>{copy[mode][0]}</span><h1>{copy[mode][1]}</h1><p>{enabled ? mode === "register" ? "注册后需要通过邮箱验证；收藏、阅读进度与对话会在账户中跨设备保存。" : "账户数据由思想星图自行管理，不依赖模型供应商保存会话。" : "当前环境尚未配置数据库和邮件服务，会员功能暂不可用。"}</p>
    {mode !== "verify" && <form className={styles.form} onSubmit={submit}>{["login", "register", "forgot"].includes(mode) && <label>邮箱<input autoComplete="email" disabled={!enabled} name="email" required type="email" /></label>}{mode === "register" && <label>显示名称<input disabled={!enabled} maxLength={120} name="displayName" required /></label>}{["login", "register", "reset"].includes(mode) && <label>密码<input autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={!enabled} minLength={mode === "login" ? 1 : 12} name="password" required type="password" /></label>}{mode === "register" && <label><span><input disabled={!enabled} name="acceptPrivacy" required type="checkbox" /> 我同意隐私政策并允许保存账户数据</span></label>}<button disabled={!enabled || pending}>{pending ? "处理中…" : mode === "login" ? "登录" : mode === "register" ? "发送验证邮件" : mode === "forgot" ? "发送重置邮件" : "更新密码"}</button></form>}
    {pending && mode === "verify" && <p>正在验证…</p>}{message && <p className={styles.success}>{message}</p>}{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.links}>{mode !== "login" && <Link href="/account/login">返回登录</Link>}{mode === "login" && <><Link href="/account/register">创建账户</Link><Link href="/account/forgot-password">忘记密码</Link></>}{mode === "reset" && message && <Link href="/account/login">前往登录</Link>}</div>
  </section>;
}
