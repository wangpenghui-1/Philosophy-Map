import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

export async function register() {
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??= process.env.SENTRY_OTLP_TRACES_URL;
  registerOTel({ serviceName: "atlas-of-ideas" });
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
