"use client";

import { useState } from "react";
import styles from "./page.module.css";

export type BackendEndpoint = readonly [label: string, path: string];

type InspectionResult = {
  endpoint: BackendEndpoint;
  status: number;
  statusText: string;
  body: string;
  truncated: boolean;
};

const MAX_PREVIEW_LENGTH = 16_000;

function formatBody(value: unknown) {
  const body = JSON.stringify(value, null, 2);
  if (body.length <= MAX_PREVIEW_LENGTH) {
    return { body, truncated: false };
  }
  return {
    body: `${body.slice(0, MAX_PREVIEW_LENGTH)}\n\n… 响应较长，预览已截断。`,
    truncated: true,
  };
}

export function BackendApiInspector({ endpoints }: { endpoints: readonly BackendEndpoint[] }) {
  const [activePath, setActivePath] = useState<string>();
  const [result, setResult] = useState<InspectionResult>();
  const [error, setError] = useState<string>();

  async function inspect(endpoint: BackendEndpoint) {
    setActivePath(endpoint[1]);
    setError(undefined);

    try {
      const response = await fetch(endpoint[1], {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const text = await response.text();
      let payload: unknown = text;
      try {
        payload = JSON.parse(text);
      } catch {
        // Non-JSON errors remain readable as plain text.
      }
      const preview = typeof payload === "string"
        ? { body: payload.slice(0, MAX_PREVIEW_LENGTH), truncated: payload.length > MAX_PREVIEW_LENGTH }
        : formatBody(payload);
      setResult({
        endpoint,
        status: response.status,
        statusText: response.statusText,
        ...preview,
      });
    } catch (cause) {
      setResult(undefined);
      setError(cause instanceof Error ? cause.message : "请求失败，请检查本地服务是否仍在运行。");
    } finally {
      setActivePath(undefined);
    }
  }

  return (
    <section className={styles.endpoints}>
      <h2>API 验收入口</h2>
      <p className={styles.hint}>点击任一卡片，在本页检查实时响应。</p>
      <div>
        {endpoints.map((endpoint) => {
          const [label, path] = endpoint;
          const loading = activePath === path;
          return (
            <button
              className={styles.endpointButton}
              disabled={Boolean(activePath)}
              key={path}
              onClick={() => inspect(endpoint)}
              type="button"
            >
              <strong>{label}</strong>
              <code>{path}</code>
              <span>{loading ? "正在请求…" : "查看响应 →"}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.response} aria-live="polite">
        {!result && !error && <p>尚未选择接口。</p>}
        {error && <p className={styles.responseError}>请求失败：{error}</p>}
        {result && (
          <>
            <header>
              <strong>{result.endpoint[0]}</strong>
              <span className={result.status < 400 ? styles.responseOk : styles.responseError}>
                HTTP {result.status} {result.statusText}
              </span>
            </header>
            <pre>{result.body}</pre>
            {result.truncated && <small>这里只截取前 {MAX_PREVIEW_LENGTH.toLocaleString()} 个字符。</small>}
          </>
        )}
      </div>
    </section>
  );
}
