"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main style={{ maxWidth: 680, margin: "12vh auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <p>ATLAS OF IDEAS</p>
          <h1>页面暂时无法显示</h1>
          <p>错误已经被记录。你可以刷新页面，或先返回思想星图首页继续阅读。</p>
          <Link href="/">返回首页</Link>
        </main>
      </body>
    </html>
  );
}
