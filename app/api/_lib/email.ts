function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!apiKey || !from || !baseUrl) throw Object.assign(new Error("邮件服务尚未配置。"), { status: 503 });
  return { apiKey, from, baseUrl: baseUrl.replace(/\/$/, "") };
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_BASE_URL);
}

async function sendEmail(to: string, subject: string, html: string) {
  const config = emailConfig();
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from: config.from, to: [to], subject, html }) });
  if (!response.ok) throw Object.assign(new Error(`邮件服务返回 HTTP ${response.status}。`), { status: 502 });
}

export async function sendVerificationEmail(email: string, token: string) {
  const config = emailConfig(); const url = `${config.baseUrl}/account/verify?token=${encodeURIComponent(token)}`;
  await sendEmail(email, "验证你的思想星图账户", `<p>请点击下面的链接验证邮箱。链接将在24小时后失效。</p><p><a href="${url}">验证思想星图账户</a></p><p>如果这不是你的操作，请忽略本邮件。</p>`);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const config = emailConfig(); const url = `${config.baseUrl}/account/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(email, "重置你的思想星图密码", `<p>请点击下面的链接重置密码。链接将在1小时后失效，使用后立即作废。</p><p><a href="${url}">重置密码</a></p><p>如果这不是你的操作，请忽略本邮件。</p>`);
}
